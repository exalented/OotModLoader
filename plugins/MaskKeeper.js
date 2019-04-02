/*
    MaskKeeper - Retain your mask through loading zones and removing it from the C-buttons.
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
const logger = require(global.OotRunDir + "/OotLogger")("MaskKeeper");

class MaskKeeper {
    constructor() {
        this._name = "MaskKeeper";
        this._lastKnownMask = 0;
        this._isSceneChanging = false;
        this._isChild = false;
    }

    preinit() {
        api.registerPacket({
            packet_id: "mask_id",
            addr: "@link_instance@",
            offset: "0x14F",
            readHandler: "80"
        });
        api.registerEvent("onMaskChange");
    }

    init() {
        api.registerClientSidePacketHook("mask_id", function (packet) {
            if (packet.data !== 0xFF) {
                api.postEvent({ id: "onMaskChange", mask: packet.data });
            }
            return false;
        });
    }

    postinit() {
        (function (inst) {
            emulator.sendViaSocket({
                packet_id: "masksStay",
                writeHandler: "freeze",
                writeHandler_freeze: "fourBytes",
                addr: "0x38a8bc",
                offset: 0,
                data: 0x00000000
            });
            api.registerEventHandler("onMaskChange", function (event) {
                if (!inst._isSceneChanging && inst._isChild) {
                    inst._lastKnownMask = event.mask;
                    logger.log(event);
                }
            });
            api.registerEventHandler("preSceneChange", function (event) {
                inst._isSceneChanging = true;
            });
            api.registerEventHandler("onStateChanged", function (event) {
                if (event.state !== 0) {
                    inst._isSceneChanging = true;
                } else {
                    inst._isSceneChanging = false;
                }
            });
            api.registerEventHandler("onLinkRespawn", function (event) {
                setTimeout(function () {
                    inst._isSceneChanging = false;
                    if (inst._isChild) {
                        let packet = {
                            packet_id: "changeMask",
                            writeHandler: "80",
                            addr: api.getTokenStorage()["@link_instance@"],
                            offset: "0x14F",
                            data: inst._lastKnownMask
                        }
                        emulator.sendViaSocket(packet);
                        logger.log(packet);
                    }
                }, 1000);
            });
            api.registerEventHandler("onAgeChanged", function (event) {
                if (event.player.isMe) {
                    if (event.age === 0x803A9D5C) {
                        inst._isChild = true;
                        logger.log("Player is now child link.");
                        if (inst._isChild) {
                            let packet = {
                                packet_id: "changeMask",
                                writeHandler: "80",
                                addr: api.getTokenStorage()["@link_instance@"],
                                offset: "0x14F",
                                data: inst._lastKnownMask
                            }
                            emulator.sendViaSocket(packet);
                            logger.log(packet);
                        }
                    } else {
                        logger.log("Player is now adult link.");
                        inst._isChild = false;
                    }
                }
            });
        })(this)
    }
}

module.exports = new MaskKeeper();