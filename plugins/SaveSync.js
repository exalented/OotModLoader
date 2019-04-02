/*
    SaveSync - Share your save data with other players.
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

const emulator = require(global.OotRunDir + "/OotBizHawk");
const api = require(global.OotRunDir + "/OotAPI");
const logger = require(global.OotRunDir + "/OotLogger")("SaveSync");
const localization = require(global.OotRunDir + "/OotLocalizer");
const encoder = require(global.OotRunDir + "/OotEncoder");

class IntegerStorage {
    constructor(name) {
        this._name = name;
        this._int = 255;
        this._lastValue = 255;
        this._check = function (inst, packet) {
            let value = inst._int;
            if (value === 255) {
                value = -1;
            }
            let v2 = packet.data.data;
            if (v2 === 255) {
                v2 = -1;
            }
            return v2 > value;
        }
    }

    update(packet) {
        let bool = false;
        let last = false;
        if (packet.data.data !== 255) {
            bool = packet.data.data !== this._int;
            if (this._check(this, packet)) {
                last = this._lastValue < this._int;
                this._lastValue = this._int;
                this._int = packet.data.data;
                logger.log("Setting " + packet.packet_id + " to " + this._int.toString() + ".");
            }
        }
        return { int: this._int, bool: bool, last: last };
    }
}

class IntegerArrayStorage {
    constructor(name) {
        this._name = name;
        this._array = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    update(packet) {
        if (packet.data.data !== 255) {
            (function (inst) {
                Object.keys(inst._array).forEach(function (key) {
                    if (inst._array[key] === 0 && packet.data.data[key] === 1) {
                        inst._array[key] = packet.data.data[key];
                        logger.log(inst._name + " | " + key);
                    }
                });
            })(this);
        }
        return this._array;
    }
}

class SaveSync {
    constructor() {
        this._name = "SaveSync";
        this._download = true;
        this._lang = localization.create("en_US");
        this._inventorySlotToLangKey = localization.create("item_numbers");
        this._icons = localization.icons("icon_coordinates");
        //
        this._inventory = {};
        this._inventory["bottle_slots"] = ["inventory_slot_18", "inventory_slot_19", "inventory_slot_20", "inventory_slot_21"];
        this._inventory["trade_slots"] = ["inventory_slot_23"];
        this._upgrades = {};
        this._equipment = {};
        this._quest = {};
        this._heart_containers = {};
        this._magic = {};
        this._scenes = {};
        this._events = {};
        this._item_flags = {};
        this._inf_flags = {};
        this._dungeon_items = {};
        this._skulltulas = {};
        this._savePacketHandlers = {};
    }

    preinit() {
        (function (inst) {
            api.registerPacketRoute("requestSaveData", "savesync");
            api.registerPacketRoute("savesync_data", "savesync");
            let temp = function (text) {
                let items = localization.text(text);
                Object.keys(items.getData()).forEach(function (key) {
                    api.registerPacketRoute(items.getData()[key], "savesync");
                });
            };
            temp("item_packets.txt");
            temp("equipment_packets.txt");
            temp("quest_packets.txt");
            temp("misc_packets.txt");
            temp("upgrade_packets.txt");
            temp("event_flag_packets.txt");
            temp("inf_flag_packets.txt");
            temp("skulltula_packets.txt");
            temp("item_flag_packets.txt");
            temp("scene_packets.txt");
            temp("dungeon_packets.txt");
        })(this);
    }

    init() {
        (function (inst) {
            inst._savePacketHandlers["inventory_slot_"] = function (server, packet, decompress) {
                if (!inst._inventory.hasOwnProperty(decompress.packet_id)) {
                    inst._inventory[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                    if (inst._inventory.bottle_slots.includes(decompress.packet_id)) {
                        inst._inventory[decompress.packet_id]._check = function (inst, packet) {
                            // 20
                            let value = inst._int;
                            if (value === 255) {
                                value = -1;
                            }
                            let v2 = packet.data.data;
                            if (v2 === 255) {
                                v2 = -1;
                            }
                            return v2 !== value;
                        };
                    } else if (inst._inventory.trade_slots.includes(decompress.packet_id)) {
                        inst._inventory[decompress.packet_id]._check = function (inst, packet) {
                            let value = inst._int;
                            if (value === 255) {
                                value = -1;
                            }
                            let v2 = packet.data.data;
                            if (v2 === 255) {
                                v2 = -1;
                            }
                            if (v2 === 44) {
                                return false;
                            }
                            if (value === 44) {
                                return true;
                            }
                            return v2 > value;
                        }
                    }
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "inventory";
                let u = inst._inventory[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let key = inst._inventorySlotToLangKey.getLocalizedString(decompress.data.data);
                            let icon = inst._icons.getIcon(key);
                            let str = inst._lang.getLocalizedString(key);
                            logger.log({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" });
                            logger.log(decompress);
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "inventory_msg", payload: encoder.compressData({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["upgrade_"] = function (server, packet, decompress) {
                if (!inst._upgrades.hasOwnProperty(decompress.packet_id)) {
                    inst._upgrades[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "upgrade";
                let u = inst._upgrades[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let icon = inst._icons.getIcon(decompress.packet_id + "_" + decompress.data.data.toString());
                            let str = inst._lang.getLocalizedString(decompress.packet_id + "_" + decompress.data.data.toString());
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "upgrade_msg", payload: encoder.compressData({ packet_id: "upgrade_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            };
            inst._savePacketHandlers["equipment_slot_"] = function (server, packet, decompress) {
                if (!inst._equipment.hasOwnProperty(decompress.packet_id)) {
                    inst._equipment[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "equipment";
                let u = inst._equipment[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let icon = inst._icons.getIcon(decompress.packet_id);
                            let str = inst._lang.getLocalizedString(decompress.packet_id);
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "equipment_msg", payload: encoder.compressData({ packet_id: "equipment_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err.message, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["quest_slot_"] = function (server, packet, decompress) {
                if (!inst._quest.hasOwnProperty(decompress.packet_id)) {
                    inst._quest[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "quest";
                let u = inst._quest[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let icon = inst._icons.getIcon(decompress.packet_id);
                            let str = inst._lang.getLocalizedString(decompress.packet_id);
                            logger.log({ packet_id: "quest_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str });
                            logger.log(decompress);
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "quest_msg", payload: encoder.compressData({ packet_id: "quest_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["biggoron"] = function (server, packet, decompress) {
                if (!inst._quest.hasOwnProperty(decompress.packet_id)) {
                    inst._quest[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "biggoron";
                let u = inst._quest[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let icon = inst._icons.getIcon("equipment_slot_12");
                            let str = inst._lang.getLocalizedString("equipment_slot_12_quest");
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "biggoron_msg", payload: encoder.compressData({ packet_id: "biggoron_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err.message, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["heart_containers"] = function (server, packet, decompress) {
                if (!inst._heart_containers.hasOwnProperty(decompress.packet_id)) {
                    inst._heart_containers[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                    inst._heart_containers[decompress.packet_id]._check = function (inst, packet) {
                        let value = inst._int;
                        if (value === 0xFFFF) {
                            value = -1;
                        }
                        return packet.data.data > value;
                    }
                    inst._heart_containers[decompress.packet_id]._int = 0xFFFF;
                }
                let u = inst._heart_containers[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "heart_containers";
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 0xFFFF) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.last) {
                            let icon = inst._icons.getIcon("item_piece_of_heart");
                            let str = inst._lang.getLocalizedString("item_heart_container");
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "heart_msg", payload: encoder.compressData({ packet_id: "heart_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["double_defense"] = function (server, packet, decompress) {
                if (!inst._heart_containers.hasOwnProperty(decompress.packet_id)) {
                    inst._heart_containers[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                let u = inst._heart_containers[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "double_defense";
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.last) {
                            let icon = inst._icons.getIcon(decompress.packet_id);
                            let str = inst._lang.getLocalizedString(decompress.packet_id);
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "dd_msg", payload: encoder.compressData({ packet_id: "dd_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["magic_bool"] = function (server, packet, decompress) {
                if (!inst._magic.hasOwnProperty(decompress.packet_id)) {
                    inst._magic[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                let u = inst._magic[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "magic_bool";
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.last) {
                            let icon = inst._icons.getIcon("item_small_magic_jar");
                            let str = inst._lang.getLocalizedString("item_small_magic_jar");
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "magic_msg", payload: encoder.compressData({ packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["magic_size"] = function (server, packet, decompress) {
                if (!inst._magic.hasOwnProperty(decompress.packet_id)) {
                    inst._magic[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                let u = inst._magic[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "magic_size";
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.last) {
                            let icon = inst._icons.getIcon("item_large_magic_jar");
                            let str = inst._lang.getLocalizedString("item_large_magic_jar");
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "magic_msg", payload: encoder.compressData({ packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["scene_"] = function (server, packet, decompress) {
                if (!inst._scenes.hasOwnProperty(decompress.packet_id)) {
                    inst._scenes[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._scenes[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "scene";
                decompress["byte"] = Number(decompress.packet_id.replace("scene_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        //let icon = inst._icons.getIcon("item_large_magic_jar");
                        //let str = inst._lang.getLocalizedString("item_large_magic_jar");
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        //server._ws_server.sockets.to(packet.room).emit('msg', {packet_id: "magic_msg", payload: encoder.compressData({packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx:icon.x * 16, sy:icon.y * 16, sw: 16, sh: 16, msg: str})});
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["event_flag_"] = function (server, packet, decompress) {
                if (!inst._events.hasOwnProperty(decompress.packet_id)) {
                    inst._events[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._events[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "events";
                decompress["byte"] = Number(decompress.packet_id.replace("event_flag_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        //let icon = inst._icons.getIcon("item_large_magic_jar");
                        //let str = inst._lang.getLocalizedString("item_large_magic_jar");
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        //server._ws_server.sockets.to(packet.room).emit('msg', {packet_id: "magic_msg", payload: encoder.compressData({packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx:icon.x * 16, sy:icon.y * 16, sw: 16, sh: 16, msg: str})});
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["item_flag_"] = function (server, packet, decompress) {
                if (!inst._item_flags.hasOwnProperty(decompress.packet_id)) {
                    inst._item_flags[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._item_flags[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "item_flags";
                decompress["byte"] = Number(decompress.packet_id.replace("item_flag_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        //let icon = inst._icons.getIcon("item_large_magic_jar");
                        //let str = inst._lang.getLocalizedString("item_large_magic_jar");
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        //server._ws_server.sockets.to(packet.room).emit('msg', {packet_id: "magic_msg", payload: encoder.compressData({packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx:icon.x * 16, sy:icon.y * 16, sw: 16, sh: 16, msg: str})});
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["inf_table_"] = function (server, packet, decompress) {
                if (!inst._inf_flags.hasOwnProperty(decompress.packet_id)) {
                    inst._inf_flags[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._inf_flags[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "inf_flags";
                decompress["byte"] = Number(decompress.packet_id.replace("inf_table_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        //let icon = inst._icons.getIcon("item_large_magic_jar");
                        //let str = inst._lang.getLocalizedString("item_large_magic_jar");
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        //server._ws_server.sockets.to(packet.room).emit('msg', {packet_id: "magic_msg", payload: encoder.compressData({packet_id: "magic_msg", writeHandler: "msg", icon: "pixel_icons.png", sx:icon.x * 16, sy:icon.y * 16, sw: 16, sh: 16, msg: str})});
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["dungeon_items_"] = function (server, packet, decompress) {
                if (!inst._dungeon_items.hasOwnProperty(decompress.packet_id)) {
                    inst._dungeon_items[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._dungeon_items[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "dungeon_items";
                decompress["byte"] = Number(decompress.packet_id.replace("dungeon_items_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    server._ws_server.sockets.to(packet.room).emit('msg', packet);
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["skulltula_flag_"] = function (server, packet, decompress) {
                if (!inst._skulltulas.hasOwnProperty(decompress.packet_id)) {
                    inst._skulltulas[decompress.packet_id] = new IntegerArrayStorage(decompress.packet_id);
                }
                decompress.data.data = inst._skulltulas[decompress.packet_id].update(decompress);
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "skulltula_flag";
                decompress["byte"] = Number(decompress.packet_id.replace("skulltula_flag_", ""));
                packet.payload = encoder.compressData(decompress);
                try {
                    server._ws_server.sockets.to(packet.room).emit('msg', packet);
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            inst._savePacketHandlers["skulltula_count"] = function (server, packet, decompress) {
                if (!inst._skulltulas.hasOwnProperty(decompress.packet_id)) {
                    inst._skulltulas[decompress.packet_id] = new IntegerStorage(decompress.packet_id);
                }
                decompress["writeHandler"] = "saveData";
                decompress["typeHandler"] = "skulltula_count";
                let u = inst._skulltulas[decompress.packet_id].update(decompress);
                decompress.data.data = u.int;
                packet.payload = encoder.compressData(decompress);
                try {
                    if (decompress.data.data !== 255) {
                        server._ws_server.sockets.to(packet.room).emit('msg', packet);
                        if (u.bool) {
                            let key = "item_gold_skulltula_token";
                            let icon = inst._icons.getIcon(key);
                            let str = inst._lang.getLocalizedString(key);
                            logger.log({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4831" });
                            logger.log(decompress);
                            server._ws_server.sockets.to(packet.room).emit('msg', { packet_id: "inventory_msg", payload: encoder.compressData({ packet_id: "inventory_msg", writeHandler: "msg", icon: "pixel_icons.png", sx: icon.x * 16, sy: icon.y * 16, sw: 16, sh: 16, msg: str, sound: "0x4843" }) });
                        }
                    }
                } catch (err) {
                    logger.log(err, "red");
                    logger.log(decompress);
                }
            }
            api.registerServerChannel("savesync", function (server, packet) {
                let decompress = encoder.decompressData(packet.payload);
                Object.keys(inst._savePacketHandlers).forEach(function (key) {
                    if (decompress.packet_id.indexOf(key) > -1) {
                        inst._savePacketHandlers[key](server, packet, decompress);
                    }
                });
                return false;
            });
        })(this);
    }

    postinit() {
        (function (inst) {
            api.registerEventHandler("onSceneContextUpdate", function (event) {
                let start = 0x00D4;
                let target = start + (event.scene * 0x1C);
                emulator.sendViaSocket({ packet_id: "forceUpdateScene", data: event.data.chests._raw, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target });
                let perm_switch = [];
                for (let i = 0; i < 4; i++) {
                    perm_switch[i] = event.data.switches._raw[i];
                }
                emulator.sendViaSocket({ packet_id: "forceUpdateScene2", data: perm_switch, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target + 4 });
                perm_switch = [];
                for (let i = 0; i < 4; i++) {
                    perm_switch[i] = event.data.collect._raw[i];
                }
                emulator.sendViaSocket({ packet_id: "forceUpdateScene3", data: perm_switch, writeHandler: "rangeCache", addr: api.getTokenStorage()["@save_data@"], offset: target + 0xC });
                emulator.sendViaSocket({ packet_id: "forceSceneUpdate", data: 0, writeHandler: "sceneTrigger", addr: 0, offset: 0 });
            });
        })(this);
    }
}

var ss = new SaveSync();

module.exports = ss;