/*
    OotOnline - See other players in your Hyrule.
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

const CONFIG = require(global.OotRunDir + "/OotConfig");
const client = require(global.OotRunDir + "/OotClient");
const emulator = require(global.OotRunDir + "/OotBizHawk");
const encoder = require(global.OotRunDir + "/OotEncoder");
const logger = require(global.OotRunDir + "/OotLogger")("OotOnline");
const fs = require("fs");
const colors = require(global.OotRunDir + "/OotColors");

let ears;
let shadow;

let context;
let puppet_spawn_param;
let current_puppet_buffer_slot;

let isSafeToSpawnPuppets = true;

class Puppet {
    constructor() {
        this._pointer;
        this._isSpawnedInCurrentScene = false;
        this._isDead = false;
        this._trigger = current_puppet_buffer_slot;
        current_puppet_buffer_slot += 4;
        this._params = current_puppet_buffer_slot;
        current_puppet_buffer_slot += 4;
        this._pointer = this._params;
        logger.log("Allocated puppet at: 80" + this._pointer.toString(16).toUpperCase(), "green");
        (function (inst) {
            api.registerPacket({
                packet_id: inst._trigger.toString(16).toUpperCase(),
                addr: inst._trigger,
                offset: "0x0",
                readHandler: "commandBuffer"
            });
            api.registerClientSidePacketHook(inst._trigger.toString(16).toUpperCase(), function (packet) {
                if (packet.data.command === 0 && packet.data.params !== puppet_spawn_param && packet.data.params !== 0 && packet.data.params !== 0xFFFFFFFF) {
                    logger.log(packet.data.command.toString(16) + " | " + packet.data.params.toString(16));
                    emulator.sendViaSocket({
                        packet_id: "spawnActor",
                        writeHandler: "range_delay",
                        addr: inst._pointer,
                        offset: "0x280",
                        isPointer: true,
                        data: ears,
                        delay: 1
                    });
                }
            });
        })(this);
    }

    get isSpawnedInCurrentScene() {
        return this._isSpawnedInCurrentScene;
    }

    set isSpawnedInCurrentScene(value) {
        this._isSpawnedInCurrentScene = value;
    }

    clearPointer() {
        emulator.sendViaSocket({
            packet_id: "clearPuppetPointer",
            writeHandler: "fourBytes",
            addr: this._pointer,
            offset: "0x0",
            data: "0xFFFFFFFF"
        });
        emulator.sendViaSocket({
            packet_id: "clearPuppetPointer",
            writeHandler: "fourBytes",
            addr: this._params,
            offset: "0x0",
            data: "0xFFFFFFFF"
        });
    }

    setup() {
    }

    spawn() {
        if (!this._isSpawnedInCurrentScene) {
            emulator.sendViaSocket({ packet_id: "reloadCoreState", addr: 0, offset: 0, data: {} });
            api.postEvent({ id: "onPuppetSpawn", instance: this });
            emulator.sendViaSocket({
                packet_id: "spawnActor",
                writeHandler: "fourBytes",
                addr: this._params,
                offset: "0x0",
                data: puppet_spawn_param
            });
            emulator.sendViaSocket({
                packet_id: "spawnActor",
                writeHandler: "fourBytes",
                addr: this._trigger,
                offset: "0x0",
                data: "0x00000001",
                delay: 1
            });
            this.isSpawnedInCurrentScene = true;
            logger.log("Spawning puppet " + "0x" + this._pointer.toString(16).toUpperCase() + ".");
        }
    }

    despawn() {
        if (this._isSpawnedInCurrentScene) {
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "fourBytesDelay",
                addr: this._pointer,
                isPointer: true,
                offset: "0x130",
                data: "0x000000",
                delay: 1
            });
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "fourBytesDelay",
                addr: this._pointer,
                isPointer: true,
                offset: "0x134",
                data: "0x000000",
                delay: 20
            });
            emulator.sendViaSocket({
                packet_id: "clearPuppetPointer",
                writeHandler: "fourBytesDelay",
                addr: this._pointer,
                offset: "0x0",
                data: "0xFFFFFFFF",
                delay: 1
            });
            this._isSpawnedInCurrentScene = false;
            logger.log("Despawning puppet " + this._pointer + ".");
        }
    }

    shovelPuppet() {
        if (this._isSpawnedInCurrentScene) {
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "80_delay",
                addr: this._pointer,
                isPointer: true,
                offset: "0x24",
                data: "0x46",
                delay: 1
            });
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "80_delay",
                addr: this._pointer,
                isPointer: true,
                offset: "0x28",
                data: "0xC5",
                delay: 1
            });
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "80_delay",
                addr: this._pointer,
                isPointer: true,
                offset: "0x2C",
                data: "0x46",
                delay: 1
            });
            emulator.sendViaSocket({
                packet_id: "shovelPuppet",
                writeHandler: "range",
                addr: this._pointer,
                isPointer: true,
                offset: "0xC0",
                data: shadow,
                delay: 1
            });
            logger.log("Shoveling puppet " + this._pointer + ".");
        }
    }
}

class OotOnline {
    // name field required.
    constructor() {
        this._name = "OotOnline";
        this._playerToPuppetMap = {};
        this._PuppetMap = [];
        this._scene = -1;
        this._sceneList = {};
        this._forbidSync = false;
        this._tunic_colors = [];
        this._age = -1;
        this._puppetSpawnHandle = null;
        this._lastSeenState = -1;
        this._puppetsAwaitingSpawn = [];
        this._puppetsAwaitingSpawn_task = {};
    }

    get PuppetMap() {
        return this._PuppetMap;
    }

    setupTunics(){
        let temp = {};
        if (CONFIG.TunicColors.kokiri !== "") {
            logger.log("Setting Kokiri tunic color to " + CONFIG.TunicColors.kokiri + ".");
            temp = colors.toRBG(CONFIG.TunicColors.kokiri);
            this._tunic_colors[0] = [temp.red, temp.green, temp.blue];
        }
        if (CONFIG.TunicColors.goron !== "") {
            logger.log("Setting Goron tunic color to " + CONFIG.TunicColors.goron + ".");
            temp = colors.toRBG(CONFIG.TunicColors.goron);
            this._tunic_colors[1] = [temp.red, temp.green, temp.blue];
        }
        if (CONFIG.TunicColors.zora !== "") {
            logger.log("Setting Zora tunic color to " + CONFIG.TunicColors.zora + ".");
            temp = colors.toRBG(CONFIG.TunicColors.zora);
            this._tunic_colors[2] = [temp.red, temp.green, temp.blue];
        }
    }

    // Load json files in here.
    preinit() {
        this.setupTunics();
        api.registerPacket(__dirname + "/packets/link_packet.json");
        api.registerPacket(__dirname + "/packets/link_loading.json");
        api.registerPacket(__dirname + "/packets/link_sound.json");
        ears = api.loadVariables("ears");
        shadow = api.loadVariables("shadow");
        context = 0x600000;
        logger.log("Starting context at: 80" + context.toString(16).toUpperCase());
        api.registerToken({
            token: "@OotOnline_Context@",
            replace: "0x" + context.toString(16).toUpperCase()
        });
        puppet_spawn_param = context + 0x0140;
        puppet_spawn_param += 0x80000000;
        logger.log("Spawn params: " + puppet_spawn_param.toString(16).toUpperCase());
        current_puppet_buffer_slot = context + 0x0090;
        logger.log("Command Buffer: 80" + current_puppet_buffer_slot.toString(16).toUpperCase());
    }

    // setup business logic here.
    init() {
        //CLIENT SIDE
        (function (inst) {
            api.registerEvent("onPuppetSpawn");
            api.registerEvent("onLinkLoading");
            api.registerEventHandler("preSceneChange", function (event) {
                let packet = event.data;
                if (
                    (packet.data["link_loading"].data !== 0x01) !==
                    isSafeToSpawnPuppets
                ) {
                    isSafeToSpawnPuppets = packet.data["link_loading"].data !== 0x01;
                    api.postEvent({ id: "onLinkLoading", safe: isSafeToSpawnPuppets });
                }
            });

            api.registerEventHandler("syncSafety", function (event) {
                inst._forbidSync = event.safe;
                logger.log("Locking/Unlocking puppet data stream.");
            });

            api.registerClientSidePacketHook("link_sound", function (packet) {
                if (packet.data.sfx.data > 0) {
                    emulator.sendViaSocket({
                        packet_id: "sfx_clear",
                        writeHandler: "81",
                        addr: api.getTokenStorage()["@OotOnline_Context@"],
                        offset: 0x88,
                        data: 0
                    });
                    return true;
                }
                return false;
            });

            api.registerPacketTransformer("link_sound", function (data) {
                if (inst._forbidSync) {
                    return null;
                } else {
                    data.payload.data["sfx"]["addr"] =
                        inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data["sfx"]["offset"] = 0x266;
                    data.payload.data["sfx"]["isPointer"] = true;
                }
                return data;
            });

            api.registerClientSidePacketHook("OotOnline", function (packet) {
                if (packet.data["link_tunic_color"].data in inst._tunic_colors) {
                    packet.data["override"] = inst._tunic_colors[packet.data["link_tunic_color"].data];
                }
                return true;
            });

            api.registerPacketTransformer("OotOnline", function (data) {
                if (inst._forbidSync) {
                    return null;
                } else {
                    if (data.payload.data["link_age"].data !== inst._age) {
                        return null;
                    }
                    data.payload.data["link_anim"]["addr"] =
                        inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data["link_anim"]["offset"] = 0x1E0;
                    data.payload.data["link_anim"]["isPointer"] = true;

                    data.payload.data["link_pos"]["addr"] =
                        inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data["link_pos"]["offset"] = "0x24";
                    data.payload.data["link_pos"]["isPointer"] = true;

                    data.payload.data["link_rot"]["addr"] =
                        inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data["link_rot"]["offset"] = "0xB4";
                    data.payload.data["link_rot"]["isPointer"] = true;

                    if (data.payload.data.override !== null) {
                        data.payload.data["link_tunic_color"]["addr"] =
                            inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                        data.payload.data.link_tunic_color["data"] = data.payload.data.override;
                        data.payload.data.link_tunic_color["offset"] = 0x154;
                        data.payload.data.link_tunic_color["writeHandler"] = "range";
                        data.payload.data.link_tunic_color["isPointer"] = true;
                        delete data.payload.data.override;
                    } else {
                        let index = data.payload.data["link_tunic_color"]["data"] * 0x3;
                        data.payload.data["link_tunic_color"]["addr"] = "0x000F7AD8";
                        data.payload.data["link_tunic_color"]["offset"] =
                            "0x" + index.toString(16);
                        data.payload.data["link_tunic_color"]["writeHandler"] = "copy";
                        data.payload.data["link_tunic_color"]["data_isPointer"] = true;
                        data.payload.data["link_tunic_color"]["data"] =
                            inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                        data.payload.data["link_tunic_color"]["data_offset"] = "0x154";
                        data.payload.data["link_tunic_color"]["size"] = "0x3";
                    }

                    /*if (data.payload.data["link_health"].data === 0) {
                        if (!inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._isDead) {
                            inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._isDead = true;
                            setTimeout(function () {
                                inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet.shovelPuppet();
                                inst._forbidSync = true;
                            }, 3000);
                        }
                    } else {
                        if (inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._isDead) {
                            inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._isDead = false;
                            setTimeout(function () {
                                inst._forbidSync = false;
                            }, 5000);
                        }
                    }*/

                    data.payload.data.puppet_0x140.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x140["isPointer"] = true;
                    data.payload.data.puppet_0x140.offset = 0x140;

                    data.payload.data.puppet_0x14C.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x14C["isPointer"] = true;
                    data.payload.data.puppet_0x14C.offset = 0x14C;

                    data.payload.data.puppet_0x159.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x159["isPointer"] = true;
                    data.payload.data.puppet_0x159.offset = 0x159;

                    data.payload.data.puppet_0x15A.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x15A["isPointer"] = true;
                    data.payload.data.puppet_0x15A.offset = 0x15A;

                    data.payload.data.puppet_0x160.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x160["isPointer"] = true;
                    data.payload.data.puppet_0x160.offset = 0x160;

                    data.payload.data.puppet_0x164.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x164["isPointer"] = true;
                    data.payload.data.puppet_0x164.offset = 0x164;

                    data.payload.data.puppet_0x15B.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x15B["isPointer"] = true;
                    data.payload.data.puppet_0x15B.offset = 0x15B;

                    data.payload.data.puppet_0x16C.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x16C["isPointer"] = true;
                    data.payload.data.puppet_0x16C.offset = 0x16C;

                    data.payload.data.puppet_0x171.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x171["isPointer"] = true;
                    data.payload.data.puppet_0x171.offset = 0x171;

                    data.payload.data.puppet_0x172.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x172["isPointer"] = true;
                    data.payload.data.puppet_0x172.offset = 0x172;

                    data.payload.data.link_gauntlets.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.link_gauntlets["isPointer"] = true;
                    data.payload.data.link_gauntlets.offset = 0x173;

                    data.payload.data.puppet_0x174.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                    data.payload.data.puppet_0x174["isPointer"] = true;
                    data.payload.data.puppet_0x174.offset = 0x174;

                    if (data.payload.data.hasOwnProperty("link_shadow")) {
                        data.payload.data.link_shadow.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                        data.payload.data.link_shadow["isPointer"] = true;
                        data.payload.data.link_shadow.offset = 0xC0;
                    }

                    if (data.payload.data.hasOwnProperty("link_velocity")) {
                        data.payload.data.link_velocity.addr = inst.PuppetMap[inst._playerToPuppetMap[data.uuid]].puppet._pointer;
                        data.payload.data.link_velocity["isPointer"] = true;
                        data.payload.data.link_velocity.offset = 0x5C;
                    }

                    delete data.payload.data["link_health"];
                    delete data.payload.data["link_age"];
                }
                return data;
            });

            api.registerPacketRoute("OotOnline", "ootonline");

            // SERVER SIDE
            api.registerServerChannel("ootonline", function (server, data) {
                let parse = data;
                let people = server.getAllClientsInMyScene(parse.room, parse.uuid);
                for (let i = 0; i < people.length; i++) {
                    server._ws_server.to(people[i]).emit("msg", data);
                }
                return false;
            });

            Object.keys(inst.PuppetMap).forEach(function (player) {
                inst.PuppetMap[player].puppet.isSpawnedInCurrentScene = false;
                inst.PuppetMap[player].puppet.clearPointer();
            });

        })(this);
    }

    // setup event handlers here.
    postinit() {
        (function (inst) {

            for (let i = 0; i < 3; i++) {
                inst.PuppetMap.push({ uuid: "", puppet: new Puppet() });
            }

            Object.keys(inst.PuppetMap).forEach(function (key) {
                inst.PuppetMap[key].puppet.setup();
            });

            api.registerEventHandler("preSceneChange", function (event) {
            });

            api.registerEventHandler("onSceneChange", function (event) {
                if (!inst._sceneList.hasOwnProperty(event.player.uuid)) {
                    inst._sceneList[event.player.uuid] = { current: -1, previous: -1 };
                    logger.log("First time seeing player " + event.player.nickname + ".");
                }
                if (event.player.isMe) {
                    if (inst._scene === event.scene) {
                        return;
                    }
                    // Is this me? Look for others.
                    inst._scene = event.scene;
                    logger.log("I" + " moved to scene " + event.scene + ".");
                } else {
                    if (event.scene === inst._sceneList[event.player.uuid].current) {
                        return;
                    }
                    logger.log(event.player.nickname + " moved to scene " + event.scene + ".");
                    inst._sceneList[event.player.uuid].previous =
                        inst._sceneList[event.player.uuid].current;
                    inst._sceneList[event.player.uuid].current = event.scene;
                    if (inst._scene === event.scene) {
                        // Player is joining my scene. Spawn their puppet.
                        //inst._puppetsAwaitingSpawn.push(inst.PuppetMap[inst._playerToPuppetMap[event.player.uuid]].puppet);
                    } else {
                        // Player is leaving my scene. Despawn their puppet.
                        try {
                            inst.PuppetMap[inst._playerToPuppetMap[event.player.uuid]].puppet.shovelPuppet();
                        } catch (err) {
                            // Shh
                        }
                    }
                }
            });

            api.registerEventHandler("onLinkDespawn", function (event) {
                // Clear old puppets.
                Object.keys(inst.PuppetMap).forEach(function (player) {
                    if (inst.PuppetMap[player].puppet.isSpawnedInCurrentScene) {
                        inst.PuppetMap[player].puppet.clearPointer();
                        inst.PuppetMap[player].puppet.isSpawnedInCurrentScene = false;
                    }
                });
            });

            api.registerEventHandler("onRoomChange", function (event) {
                if (event.player.isMe) {
                    if (event.room === 255) {
                        // Clear old puppets.
                        Object.keys(inst.PuppetMap).forEach(function (player) {
                            if (inst.PuppetMap[player].puppet.isSpawnedInCurrentScene) {
                                inst.PuppetMap[player].puppet.clearPointer();
                                inst.PuppetMap[player].puppet.isSpawnedInCurrentScene = false;
                            }
                        });
                    }
                }
            });

            api.registerEventHandler("onSoftReset", function (event) {
                // Clear old puppets.
                Object.keys(inst.PuppetMap).forEach(function (player) {
                    if (inst.PuppetMap[player].puppet.isSpawnedInCurrentScene) {
                        inst.PuppetMap[player].puppet.clearPointer();
                        inst.PuppetMap[player].puppet.isSpawnedInCurrentScene = false;
                    }
                });
            });

            api.registerEventHandler("onLinkRespawn", function (event) {
            });

            api.registerEventHandler("onFrameCount", function(event){
                if (event.data.data.bool){
                    inst._puppetSpawnHandle = true;
                    logger.log("Preparing for puppet spawning...");
                    Object.keys(inst._tunic_colors).forEach(function (index) {
                        emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                    });
                }
            });

            api.registerEventHandler("onStateChanged", function (event) {
                inst._lastSeenState = event.state;
                logger.log(event);
                if (inst._puppetSpawnHandle && event.state === 0) {
                    logger.log("Starting puppet spawning.");
                    inst._puppetSpawnHandle = false;
                    Object.keys(inst.PuppetMap).forEach(function (player) {
                        inst.PuppetMap[player].puppet.spawn();
                    });
                    logger.log("Ending puppet spawning.");
                }
            });

            api.registerEventHandler("onAgeChanged", function (event) {
                inst._age = event.age;
            })

            api.registerEventHandler("ZeldaDespawned", function (event) {
                logger.log(event);
                if (event.uuid === "0x179-0x130-14-0-0x33D213C" || event.uuid === "0x179-0x130-15-0-0x344F060") {
                    // This is where the game crashes due to puppets.
                    Object.keys(inst.PuppetMap).forEach(function (player) {
                        inst.PuppetMap[player].puppet.despawn();
                    });
                }
            });

            api.registerEventHandler("onActorSpawned", function (event) {
                if (event.uuid === 54440188) {
                    setTimeout(function () {
                        Object.keys(inst.PuppetMap).forEach(function (player) {
                            inst.PuppetMap[player].puppet.spawn();
                        });
                    }, 1000);
                }
                if (event.uuid === 54849632) {
                    setTimeout(function () {
                        Object.keys(inst.PuppetMap).forEach(function (player) {
                            //inst.PuppetMap[player].puppet.despawn();
                        });
                    }, 1000);
                }
            });

            api.registerEventHandler("onPlayerJoined", function (event) {
                let playerSlot = -1;
                for (let i = 0; i < inst.PuppetMap.length; i++) {
                    if (inst.PuppetMap[i].uuid === "") {
                        playerSlot = i;
                        break;
                    }
                }
                if (playerSlot > -1) {
                    inst.PuppetMap[playerSlot].uuid = event.player.uuid;
                    logger.log("Assigning " + event.player.nickname + " to puppet " + inst.PuppetMap[playerSlot].puppet._pointer + ".", "yellow");
                    inst._playerToPuppetMap[event.player.uuid] = playerSlot;
                    emulator.sendViaSocket({
                        packet_id: "clearCache",
                        writeHandler: "clearCache"
                    });
                } else {
                    logger.log("PLAYER LIMIT REACHED", "red");
                }
            });

            api.registerEventHandler("onPlayerDisconnected", function (event) {
                try {
                    inst.PuppetMap[inst._playerToPuppetMap[event.player.uuid]].uuid = "";
                    inst.PuppetMap[inst._playerToPuppetMap[event.player.uuid]].puppet.shovelPuppet();
                    delete inst._playerToPuppetMap[event.player.uuid];
                    logger.log(
                        "Removing player " + event.player.uuid + " from puppet manager."
                    );
                } catch (err) { }
            });

            api.registerEventHandler("onServerConnection", function (event) {
                Object.keys(inst.PuppetMap).forEach(function (player) {
                    inst.PuppetMap[player].uuid = "";
                    inst.PuppetMap[player].puppet.shovelPuppet();
                });
                inst._playerToPuppetMap = {};
            });

            api.registerEventHandler("onConfigUpdate", function(event){
                inst.setupTunics();
                Object.keys(inst._tunic_colors).forEach(function (index) {
                    emulator.sendViaSocket({ packet_id: "changeColor", data: inst._tunic_colors[index], writeHandler: "range", addr: "0x000F7AD8", offset: index * 3 });
                });
            });
        })(this);
    }
}

const ooto = new OotOnline();

api.registerModule("OotOnline", ooto);
module.exports = ooto;
