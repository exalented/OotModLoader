/*
    OotModLoader - Adding networking functions and mod loading capability to Ocarina of Time.
    Copyright (C) 2019  Team Ooto

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

global.OotRunDir = __dirname;

const original_console = console.log;
let console_hook = function(msg){};

console.log = function(msg){
    original_console(msg);
    console_hook(msg);
}

const CONFIG = require('./OotConfig');

let master = require('./OotMasterServer');
let client = require('./OotClient');
let emu = require('./OotBizHawk');
let api = require('./OotAPI');
let plugins = require('./OotPluginLoader');
const encoder = require(global.OotRunDir + '/OotEncoder');
let gs = require('./GamesharkToInjectConverter');
let logger = require('./OotLogger')('Core');
const fs = require("fs");
const colors = require('./OotColors');
const localizer = require('./OotLocalizer');
const BUILD_TYPE = "@BUILD_TYPE@";
const download = require('download-file');
const unzip = require('unzip');
var ncp = require('ncp').ncp;
var https = require('https');
var url = require('url');
var path = require("path");
const spawn = require('cross-spawn');

let packetTransformers = {};
let packetRoutes = {};
let clientsideHooks = {};
let rom = "";
let console_log = [];

console_hook = function(msg){
    if (typeof (str) === "string") {
        console_log.push(msg)
    } else {
        console_log.push(JSON.stringify(msg))
    }
};

fs.readdirSync("./rom").forEach(file => {
    if (file.indexOf(".z64") > -1) {
        rom = "./rom/" + file;
    }
});

if (rom !== "") {
    logger.log(rom);
}

api.registerEvent("BPSPatchDownloaded");
api.registerEvent("onBizHawkInstall");

emu.setDataParseFn(parseData);
client.setProcessFn(processData);
api.setRouteFn(registerPacketRoute);
api.setTransformerFn(registerPacketTransformer);
api.setClientHookFn(registerClientSidePacketHook);
client.setOnPlayerConnected(onPlayerConnected);

master.preSetup();
logger.log("Loading plugins...");
plugins.load(function () {

    if (BUILD_TYPE !== "GUI") {
        if (CONFIG.isMaster) {
            master.setup();
        }
        if (CONFIG.isClient) {
            client.setProcessFn(processData);
            client.setup();
        }
    } else {
        if (!fs.existsSync("./BizHawk")) {
            fs.mkdirSync("./BizHawk");
        }
        var LUA_LOC = ".";
        ncp.limit = 16;
        if (fs.existsSync("OotOnlinePayloadConverter.exe")) {
            logger.log("Dev env detected.");
            ncp(LUA_LOC + "/src/for_emulator/Lua", "./BizHawk/Lua", function (err) {
                if (err) {
                    return console.error(err);
                }
                logger.log("Installed Lua files!");
            });
            ncp(LUA_LOC + "/luasocket/mime", "./BizHawk/mime", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
            ncp(LUA_LOC + "/luasocket/socket", "./BizHawk/socket", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
        } else {
            ncp(LUA_LOC + "/Lua", "./BizHawk/Lua", function (err) {
                if (err) {
                    return console.error(err);
                }
                logger.log("Installed Lua files!");
            });
            ncp(LUA_LOC + "/mime", "./BizHawk/mime", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
            ncp(LUA_LOC + "/socket", "./BizHawk/socket", function (err) {
                if (err) {
                    return console.error(err);
                }
            });
        }
        if (!fs.existsSync("./BizHawk/config.ini")) {
            fs.copyFileSync(LUA_LOC + "/config.ini", "./BizHawk/config.ini");
        }
        if (!fs.existsSync("./bizhawk_prereqs_v2.1.zip")) {
            logger.log("Downloading BizHawk Prereqs...");
            var asdf = "https://github.com/TASVideos/BizHawk-Prereqs/releases/download/2.1/bizhawk_prereqs_v2.1.zip"
            https.get(asdf, function (res) {
                // Detect a redirect
                if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
                    // The location for some (most) redirects will only contain the path,  not the hostname;
                    // detect this and add the host to the path.
                    if (url.parse(res.headers.location).hostname) {
                        // Hostname included; make request to res.headers.location
                        asdf = res.headers.location;
                        var options = {
                            directory: ".",
                            filename: "bizhawk_prereqs_v2.1.zip"
                        }
                        download(asdf, options, function (err) {
                            if (err) {
                                logger.log(err, "red")
                            } else {
                                logger.log("Unzipping BizHawk Prereqs...");
                                fs.createReadStream('./bizhawk_prereqs_v2.1.zip').pipe(unzip.Extract({ path: './BizHawk' })).on('close', function () {
                                });
                            }
                        })
                    }
                }
            });
        };

        if (!fs.existsSync("./BizHawk-2.3.1.zip")) {
            logger.log("Downloading BizHawk...");
            api.postEvent({id: "onBizHawkInstall", done: false});
            var asdf2 = "https://github.com/TASVideos/BizHawk/releases/download/2.3.1/BizHawk-2.3.1.zip"
            https.get(asdf2, function (res) {
                // Detect a redirect
                if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location) {
                    // The location for some (most) redirects will only contain the path,  not the hostname;
                    // detect this and add the host to the path.
                    if (url.parse(res.headers.location).hostname) {
                        // Hostname included; make request to res.headers.location
                        asdf2 = res.headers.location;
                        var options = {
                            directory: ".",
                            filename: "BizHawk-2.3.1.zip"
                        }
                        download(asdf2, options, function (err) {
                            if (err) {
                                logger.log(err, "red")
                            } else {
                                logger.log("Unzipping BizHawk...");
                                fs.createReadStream('./BizHawk-2.3.1.zip').pipe(unzip.Extract({ path: './BizHawk' })).on('close', function () {
                                    api.postEvent({id: "onBizHawkInstall", done: true});
                                });
                            }
                        })
                    }
                }
            });
        };
        api.registerEvent("GUI_StartButtonPressed");
        logger.log("Awaiting start command from GUI.");
        api.registerEventHandler("GUI_StartButtonPressed", function (event) {
            if (CONFIG.isMaster) {
                master.setup();
            }
            if (CONFIG.isClient) {
                client.setProcessFn(processData);
                client.setup();
            }
            logger.log("Starting BizHawk...");
            var child = spawn('./BizHawk/EmuHawk.exe', ['--lua=' + path.resolve("./BizHawk/Lua/OotModLoader.lua"), path.resolve(rom)], { stdio: 'inherit' });
        });
        api.registerEvent("GUI_ConfigChanged");
        api.registerEvent("onConfigUpdate");
        api.registerEventHandler("GUI_ConfigChanged", function (event) {
            logger.log(event);
            Object.keys(event.config).forEach(function (key) {
                if (CONFIG.hasOwnProperty(key)) {
                    if (event.config[key] == 'on') {
                        event.config[key] = true;
                    }
                    if (event.config[key] == "off") {
                        event.config[key] = false;
                    }
                    CONFIG[key] = event.config[key];
                } else if (CONFIG._tunic_colors.hasOwnProperty(key)) {
                    CONFIG._tunic_colors[key] = event.config[key];
                }
            });
            CONFIG.save();
            setTimeout(function () {
                api.postEvent({ id: "onConfigUpdate", config: CONFIG });
            }, 1000);
        });
    }
});

function registerPacketRoute(packet_id, route) {
    packetRoutes[packet_id] = route;
}

function registerPacketTransformer(packet_id, fn) {
    packetTransformers[packet_id] = fn;
}

function registerClientSidePacketHook(packet_id, hook) {
    clientsideHooks[packet_id] = hook;
}

// Going out to server.
function parseData(data) {
    try {
        let sendToMaster = true;
        let incoming = data;
        if (clientsideHooks.hasOwnProperty(incoming.packet_id)) {
            sendToMaster = clientsideHooks[incoming.packet_id](incoming);
        }
        if (sendToMaster) {
            if (packetRoutes.hasOwnProperty(incoming.packet_id)) {
                client.sendDataToMasterOnChannel(packetRoutes[incoming.packet_id], incoming);
            } else {
                client.sendDataToMaster(incoming);
            }
        }
    } catch (err) {
        if (err) {
            logger.log(err.toString(), "red");
            logger.log(err.stack, "red");
            logger.log("---------------------", "red");
            logger.log("Something went wrong!", "red");
            logger.log("---------------------", "red");
            logger.log(data, "red");
        }
    }
}

function writeToFile(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Coming in from server.
function processData(data) {
    try {
        if (packetTransformers.hasOwnProperty(data["payload"]["packet_id"])) {
            data = packetTransformers[data["payload"]["packet_id"]](data);
        }
        if (data !== null) {
            emu.sendViaSocket(data.payload);
        }
    } catch (err) {
        if (err) {
            logger.log(err.toString(), "red");
            logger.log(err.stack, "red");
            logger.log("---------------------", "red");
            logger.log("Something went wrong!", "red");
            logger.log("---------------------", "red");
            logger.log(data, "red");
        }
    }
}

function onPlayerConnected(nickname, uuid) {
    api.postEvent({ id: "onPlayerJoined", player: { nickname: nickname, uuid: uuid } });
}

api.registerEventHandler("BPSPatchDownloaded", function (event) {
    if (!fs.existsSync("./temp")) {
        fs.mkdirSync("./temp");
    }
    fs.writeFileSync("./temp/temp.bps", event.data);
    let bps_class = require('./OotBPS');
    let bps = new bps_class();
    try {
        var newRom = bps.tryPatch(rom, "./temp/temp.bps");
        emu.sendViaSocket({ packet_id: "loadrom", writeHandler: "loadRom", rom: path.resolve(newRom) });
    } catch (err) {
        logger.log(JSON.stringify(err));
    }
});

module.exports = { api: api, config: CONFIG, console: console_log};