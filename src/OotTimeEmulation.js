
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
const api = require('./OotAPI');
const logger = require('./OotLogger')("TimeEmulator");
const encoder = require('./OotEncoder');

class OotTimeEmulation {
    constructor(room, master_server) {
        this._room = room;
        this._worldTime = 0x8000;
        this._maxTime = 65555;
        this._tickRate = 60;
        this._counter = {};
        this._sender = {};
        this._checker = {};
        this._addr = 0x15E660;
        this._changeRates = {
            day: 0xC,
            night: 0x12
        };
        this._ms = master_server;
        (function (inst) {
            inst._counter = setInterval(function () {
                if (inst._worldTime >= 0x4500 && inst._worldTime <= 0xC000) {
                    inst._worldTime += inst._changeRates.day;
                } else {
                    inst._worldTime += inst._changeRates.night;
                }
                if (inst._worldTime > inst._maxTime) {
                    inst._worldTime = 0;
                }
            }, inst._tickRate);

            inst._sender = setInterval(function () {
                //inst._ms._ws_server.sockets.to(inst._room).emit('msg', { packet_id: "time", nickname: "System", uuid: "-1", payload: encoder.compressData({ packet_id: "time", writeHandler: "81", addr: inst._addr, offset: 0x00C, data: inst._worldTime }) });
            }, 60);

            inst._checker = setInterval(function () {
                if (!inst._ms.doesRoomExist(inst._room)) {
                    clearInterval(inst._checker);
                    clearInterval(inst._counter);
                    clearInterval(inst._sender);
                    //api.unregisterEventHandler("onSceneChange", inst._sender);
                }
            }, 50);
        })(this);
        logger.log("Created time emulator for room " + this._room + ".");
    }
}

module.exports = function (room, server) {
    return new OotTimeEmulation(room, server);
}