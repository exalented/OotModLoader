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

const net = require('net');
JsonSocket = require('json-socket');
const CONFIG = require('./OotConfig');
const udp = require('./OotUDP');
const logger = require('./OotLogger')("BizHawkTCP");
const LOCAL_PORT = 1337;
const LOCAL_PORT_UDP = 60001;

class EmuConnection {
    constructor() {
        this._emuhawk = null;
        this._packet_buffer = "";
        this._awaiting_send = [];
        this._processDataFn = function () { };
        this._connectedtoEmuCallcack = function () { };
        this._dynamicPackets = [];
        this._udp = udp.server(LOCAL_PORT, "BizHawkUDP");
        this._droppedPackets = 0;
        this._jSocket = null;
        if (CONFIG.isClient) {
            (function (inst) {
                inst._zServer = net.createServer(function (socket) {
                    inst._emuhawk = socket;
                    inst._jSocket = new JsonSocket(socket);
                    logger.log("Connected to BizHawk!");
                    inst._connectedtoEmuCallcack();
                    inst._dynamicPackets.forEach(function (packet) {
                        inst.sendViaSocket(packet);
                    });
                    inst._jSocket.on('message', function (data) {
                        inst._processDataFn(data);
                    });
                    inst._jSocket.on('error', function(error){
                        //logger.log(error, "red");
                    });
                    while (inst._awaiting_send.length > 0) {
                        let p = inst._awaiting_send.shift();
                        inst.sendViaSocket(p);
                    }
                });
                inst._zServer.listen(LOCAL_PORT, '127.0.0.1', function () {
                    logger.log("Awaiting connection. Please load the .lua script in Bizhawk.");
                    inst._udp.setDataFn(inst._processDataFn);
                    inst._udp.setup();
                });
            })(this);
        }
    }

    registerDynamicPacket(packet) {
        return this._dynamicPackets[this._dynamicPackets.push(packet) - 1];
    }

    setDataParseFn(fn) {
        this._processDataFn = fn;
    }

    setConnectedFn(fn) {
        this._connectedtoEmuCallcack = fn;
    }

    sendViaUDP(data) {
        this._udp.sendTo_InternalUseOnly("127.0.0.1", LOCAL_PORT_UDP, data);
    }

    sendViaSocket(data) {
        try {
            let json = JSON.stringify(data);
            if (this._emuhawk === null) {
                this.awaiting_send.push(data);
            } else {
                this._emuhawk.write(json + "\r\n");
            }
        } catch (error) {
        }
    }

    get emuhawk() {
        return this._emuhawk;
    }

    set emuhawk(value) {
        this._emuhawk = value;
    }

    get packet_buffer() {
        return this._packet_buffer;
    }

    set packet_buffer(value) {
        this._packet_buffer = value;
    }

    get awaiting_send() {
        return this._awaiting_send;
    }

    set awaiting_send(value) {
        this._awaiting_send = value;
    }

    get zServer() {
        return this._zServer;
    }

    set zServer(value) {
        this._zServer = value;
    }

    get server() {
        return this._server;
    }

    set server(value) {
        this._server = value;
    }
}

module.exports = new EmuConnection();