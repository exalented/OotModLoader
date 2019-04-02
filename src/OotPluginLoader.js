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

const loadPlugins = require('plugin-system');
const logger = require('./OotLogger')("PluginManager");
const fs = require("fs");
const gameshark = require(global.OotRunDir + "/GamesharkToInjectConverter");
const emulator = require(global.OotRunDir + "/OotBizHawk");
var util = require('util');
const api = require(global.OotRunDir + "/OotAPI");

class PluginLoader {
    constructor() {
    }

    load(callback) {
        loadPlugins(
            {
                paths: [
                    process.cwd() + '/plugins/',
                ],
                custom: [],
            })
            .then(function onSuccess(plugins) {
                logger.log("Starting preinit phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Preinit: " + plugins[i]._name);
                    plugins[i].preinit();
                }
                logger.log("Starting init phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Init: " + plugins[i]._name);
                    plugins[i].init();
                }
                logger.log("Starting postinit phase.", "green");
                for (let i = 0; i < plugins.length; i++) {
                    logger.log("Plugin Postinit: " + plugins[i]._name);
                    plugins[i].postinit();
                }
                logger.log("Plugin loading complete.", "green");
                callback();
            })
            .catch(function onError(err) {
                logger.log(err, "red");
                logger.log(err.stack, "red");
            });
        let payloads = fs.readdirSync(process.cwd() + '/plugins/payloads_10');
        let p = [];
        logger.log("Starting payload loading phase.", "green");
        Object.keys(payloads).forEach(function (key) {
            if (payloads[key].indexOf(".payload") > -1) {
                logger.log("Loading payload: " + payloads[key] + ".");
                let j = gameshark.read(process.cwd() + '/plugins/payloads_10/' + payloads[key]);
                p.push(j);
            }
        });
        emulator.setConnectedFn(function () {
            for (let i = 0; i < p.length; i++) {
                if (p[i].params.event !== undefined) {
                    api.registerEventHandler(p[i].params.event, function (event) {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                    });
                } else {
                    if (p[i].params.delay !== undefined) {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes, delay: Number(p[i].params.delay) });
                    } else {
                        emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                    }
                    api.registerEventHandler("onSoftReset_Post", function (event) {
                        if (p[i].params.delay !== undefined) {
                            emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes, delay: Number(p[i].params.delay) });
                        } else {
                            emulator.sendViaSocket({ packet_id: "gs", codes: p[i].codes });
                        }
                    });
                }
            }
        });
    }
}

module.exports = new PluginLoader();