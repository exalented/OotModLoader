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

const dgram = require('dgram');
const encoder = require('./OotEncoder');

class OotUDPServer {
    constructor(port, name) {
        this._server = dgram.createSocket('udp4');
        this._port = port;
        this._logger = require('./OotLogger')(name);
        this._onDataFn = function (msg) { };
    }

    get logger() {
        return this._logger;
    }

    get port() {
        return this._port;
    }

    set port(p) {
        this._port = p;
    }

    get server() {
        return this._server;
    }

    setDataFn(fn) {
        this._onDataFn = fn;
    }

    sendTo(address, port, msg) {
        let data = JSON.stringify(msg);
        this._server.send(Buffer.from(data.length + "#" + data), port, address, (err) => {
        });
    }

    sendTo_InternalUseOnly(address, port, msg) {
        let data = JSON.stringify(msg) + "\r\n";
        this._server.send(Buffer.from(data), port, address, (err) => {
        });
    }

    send(address, msg) {
        let data = JSON.stringify(msg);
        this._server.send(Buffer.from(data.length + "#" + data), this.port, address, (err) => {
        });
    }

    setup() {
        (function (inst) {
            inst.server.on('message', (msg, rinfo) => {
                inst._onDataFn(JSON.parse(Buffer.from(msg).toString().split("#")[1]));
            });

            inst.server.on('listening', () => {
                const address = inst.server.address();
                inst.logger.log(`listening ${address.address}:${address.port}`);
                inst.port = address.port;
            });
            inst.server.bind(inst.port);
        })(this);
    }
}

class OotUDPClient {
    constructor(port, name) {
        this._server = dgram.createSocket('udp4');
        this._port = port;
        this._logger = require('./OotLogger')(name);
        this._onDataFn = function (msg) { };
    }

    get logger() {
        return this._logger;
    }

    get port() {
        return this._port;
    }

    set port(p) {
        this._port = p;
    }

    get server() {
        return this._server;
    }

    setDataFn(fn) {
        this._onDataFn = fn;
    }

    sendTo(address, port, msg) {
        let data = JSON.stringify(msg);
        this._server.send(Buffer.from(data.length + "#" + data), port, address, (err) => {
        });
    }

    send(address, msg) {
        let data = JSON.stringify(msg);
        this._server.send(Buffer.from(data.length + "#" + data), this.port, address, (err) => {
        });
    }

    setup() {
        (function (inst) {
            inst.server.on('message', (msg, rinfo) => {
                let p = JSON.parse(Buffer.from(msg).toString().split("#")[1]);
                if (p.hasOwnProperty("payload")) {
                    p.payload = encoder.decompressData(p.payload);
                }
                inst._onDataFn(p);
            });

            inst.server.on('listening', () => {
                const address = inst.server.address();
                inst.logger.log(`listening ${address.address}:${address.port}`);
                inst.port = address.port;
            });
            inst.server.bind(inst.port);
        })(this);
    }
}

function createNewServer(port, name) {
    return new OotUDPServer(port, name);
}

function createNewClient(port, name) {
    return new OotUDPClient(port, name);
}

module.exports = { server: createNewServer, client: createNewClient };