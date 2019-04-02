/*
    SceneSync - Keep actors in sync across clients.
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

const api = require(global.OotRunDir + "/OotAPI");
const emulator = require(global.OotRunDir + "/OotBizHawk");
const logger = require(global.OotRunDir + "/OotLogger")("SceneSync");
const client = require(global.OotRunDir + "/OotClient");
const CONFIG = require(global.OotRunDir + "/OotConfig");
const scene_api = require('./modules/SceneSyncAPI.opm');

let INSTANCE;


class Flags {
    constructor(map) {
        this._raw = map;
    }
}

class SceneSync {
    constructor() {
        this._name = "SceneSync";
        this._scene = -1;
        this._room = -1;
        this._lastSeenEntrance = -1;
        this._forbidSync = false;
        this._sceneStorage = {};
        this._computeList = [];
        this._forbidHandler;
        this._needRoomCheck = false;
        this._api = new scene_api(this, emulator, api);
    }

    get api() {
        return this._api;
    }

    preinit() {
        api.registerEvent("onSceneContextUpdate");
        api.registerPacket(__dirname + "/packets/scene_flags.json");
        api.registerEvent("syncSafety");
        api.registerEvent("ZeldaDespawned");
        this._api.init(api);
    }

    init() {
        (function (inst) {
            // SCENE FLAG HANDLER IS HERE FOR CTRL+F.
            api.registerClientSidePacketHook("scene_flags", function (data) {
                if (inst._forbidSync) {
                    logger.log("Not sending scene flags due to lock!", "yellow");
                    return false;
                }
                //logger.log("Sending scene flag update.", "green");
                // 00-1F Permanent flags
                // 20-37 Temporary flags
                // 38-3F Local flags
                let switches = new Flags(data.data.switch_flags.data);
                let chests = new Flags(data.data.chest_flags.data);
                let clear = new Flags(data.data.room_clear.data);
                let collect = new Flags(data.data.collectable_flags.data);
                api.postEvent({ id: "onSceneContextUpdate", data: { switches: switches, chests: chests, clear: clear, collect: collect }, scene: data.data.scene.data, room: data.data.room.data });
                inst._sceneStorage[inst._scene] = {
                    switches: switches,
                    chests: chests,
                    clear: clear
                };
                client.sendDataToMasterOnChannel("scenesync", {
                    packet_id: "switch_flag_sync",
                    writeHandler: "rangeCache",
                    addr: api.getTokenStorage()["@switch_flags@"],
                    offset: 0x0,
                    data: switches._raw,
                    scene: data.data.scene.data,
                    room: data.data.room.data
                });
                client.sendDataToMasterOnChannel("scenesync", {
                    packet_id: "chest_flag_sync",
                    writeHandler: "rangeCache",
                    addr: api.getTokenStorage()["@chest_flags@"],
                    offset: 0x0,
                    data: chests._raw,
                    scene: data.data.scene.data,
                    room: data.data.room.data
                });
                client.sendDataToMasterOnChannel("scenesync", {
                    packet_id: "clear_flag_sync",
                    writeHandler: "rangeCache",
                    addr: api.getTokenStorage()["@room_clear@"],
                    offset: 0x0,
                    data: clear._raw,
                    scene: data.data.scene.data,
                    room: data.data.room.data
                });
                return false;
            });

            api.registerPacketTransformer("switch_flag_sync", function (packet) {
                //logger.log("Received scene data from other client.");
                return packet;
            });
        })(this);
    }

    clearHooks(){
        emulator.sendViaSocket({packet_id: "clearHooks", writeHandler: "clearActorHooks", data: 0, addr: 0, offset: 0});
    }

    clearhooks_roomLevel(){
        emulator.sendViaSocket({packet_id: "clearHooks", writeHandler: "clearActorHooks_room", data: 0, addr: 0, offset: 0});
    }

    postinit() {
        (function (inst) {
            api.registerPacketRoute("scenesync", "scenesync");

            // SERVER SIDE
            api.registerServerChannel("scenesync", function (server, data) {
                let parse = data;
                let people = server.getAllClientsInMyScene(parse.room, parse.uuid);
                for (let i = 0; i < people.length; i++) {
                    server._ws_server.to(people[i]).emit("msg", data);
                }
                return false;
            });

            api.registerEventHandler("preSceneChange", function (event) {
                let packet = event.data;
                if (inst._lastSeenEntrance !== packet.data["link_entrance"].data) {
                    inst._lastSeenEntrance = packet.data["link_entrance"].data;
                    inst.api.forbidAllSync();
                }
            });

            api.registerEventHandler("onLinkBusy", function (event) {
                if (event.data === true) {
                    //inst.forbidAllSync();
                    inst.clearhooks_roomLevel();
                }
            });

            api.registerEventHandler("onSceneChange", function (event) {
                if (event.player.isMe) {
                    if (inst._scene === event.scene) {
                        return;
                    }
                    inst._scene = event.scene;
                    inst.api.forbidAllSync();
                }
            });
            api.registerEventHandler("onRoomChange", function (event) {
                if (event.player.isMe) {
                    if (inst._room === event.room || event.room === 255) {
                        return;
                    }
                    inst._room = event.room;
                    logger.log("Room changed: " + inst._room + ".");
                    //inst._needRoomCheck = true;
                    //inst.clearhooks_roomLevel();
                }
            });
            api.registerEventHandler("onLinkBusy", function (event) {
                if (!event.data) {
                } else {
                    inst.api.forbidAllSync(false);
                }
            });
            api.registerEventHandler("onLinkDespawn", function (event) {
                inst.api.forbidAllSync();
                inst.clearHooks();
            });
            api.registerEventHandler("onLinkRespawn", function (event) {
            });
            api.registerEventHandler("onLinkLoading", function (event) {
                if (!event.safe) {
                    inst.api.forbidAllSync();
                }
            });
            api.registerEventHandler("preSceneChange", function (event) {
                inst.api.forbidAllSync();
            });
            api.registerEventHandler("onSceneChange", function (event) {
                if (event.isMe) {
                    inst.api.forbidAllSync();
                    inst._scene = event.scene;
                    client.sendDataToMaster({
                        packet_id: "clearCache",
                        writeHandler: "clearCache"
                    });
                }
            });
            api.registerEventHandler("onSoftReset", function (event) {
                inst.api.forbidAllSync();
                inst.clearHooks();
            });
        })(this);
    }
}

INSTANCE = new SceneSync();
module.exports = INSTANCE;
