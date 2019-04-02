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

const natUpnp = require("nat-upnp");
const hri = require("human-readable-ids").hri;
const encoder = require("./OotEncoder");
const CONFIG = require("./OotConfig");
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const udp = require("./OotUDP");
const logger = require("./OotLogger")("Server");
const time = require("./OotTimeEmulation");
const api = require("./OotAPI");
const version = require('./OotVersion');

const _channelHandlers = {};

class MasterServer {
    constructor() {
        this._upnp_client = natUpnp.createClient();
        this._ws_server = {};
        this._udp = udp.server(60000, "MasterUDP");
    }

    preSetup() {
        (function (inst) {
            api.setChannelFn(inst.registerChannel);
            api.setServerSideStorage(function (room) {
                return inst.getRoomsArray()[room];
            });
        })(this);
    }

    getRoomsArray() {
        return this._ws_server.sockets.adapter.rooms;
    }

    get ws_server() {
        return this._ws_server;
    }

    set ws_server(value) {
        this._ws_server = value;
    }

    sendPacketTo(dest, packet) {
        this._ws_server.sockets.to(dest).emit('msg', packet);
    }

    registerChannel(name, fn) {
        _channelHandlers[name] = fn;
    }

    getAllClientsInMyScene(room, uuid) {
        let r = [];
        (function (inst) {
            try {
                if (
                    inst._ws_server.sockets.adapter.rooms[room].hasOwnProperty("scenes")
                ) {
                    Object.keys(
                        inst._ws_server.sockets.adapter.rooms[room]["scenes"]
                    ).forEach(function (key) {
                        if (
                            inst._ws_server.sockets.adapter.rooms[room]["scenes"][uuid] ===
                            inst._ws_server.sockets.adapter.rooms[room]["scenes"][key]
                        ) {
                            if (uuid !== key) {
                                r.push(key);
                            }
                        }
                    });
                }
            } catch (all) {
                // Shh...
            }
        })(this);
        return r;
    }

    doesRoomExist(room) {
        return this.getRoomsArray().hasOwnProperty(room);
    }

    setup() {
        this._upnp_client.portMapping(
            {
                public: CONFIG.master_server_port,
                private: CONFIG.master_server_port,
                ttl: 10
            },
            function (err) {
                if (err) {
                    logger.log(
                        "Master: Please open port " +
                        CONFIG.master_server_port +
                        " on your router in order to host a game.",
                        "red"
                    );
                } else {
                    logger.log(
                        "Master: Port " +
                        CONFIG.master_server_port +
                        " opened successfully!",
                        "green"
                    );
                }
            }
        );
        logger.log("Setting up master server...");
        CONFIG.master_server_ip = "127.0.0.1";
        http.listen(Number(CONFIG.master_server_port), function () {
            logger.log(
                "Master Server listening on port ".concat(CONFIG.master_server_port)
            );
        });
        this._ws_server = io;
        (function (server, inst) {
            inst._upnp_client.portMapping(
                {
                    public: inst._udp.port,
                    private: inst._udp.port,
                    ttl: 10
                },
                function (err) {
                    if (err) {
                        logger.log(
                            "Master: Please open port " +
                            inst._udp.port +
                            " on your router in order to host a game.",
                            "red"
                        );
                    } else {
                        logger.log(
                            "Master: Port " + inst._udp.port + " opened successfully!",
                            "green"
                        );
                    }
                }
            );
            server["OotClientList"] = {};
            server.on("connection", function (socket) {
                //logger.log(server.OotClientList);
                socket.on('version', function(data){
                    if (data.version === version){
                        logger.log("Client " + socket.id + " version verified.");
                        server.to(socket.id).emit("id", encoder.compressData({ id: socket.id }));
                    }else{
                        server.to(socket.id).emit("versionMisMatch", {client: data.version, server: version});
                    }
                });
                socket.on("room", function (data) {
                    try{
                        data = encoder.decompressData(data);
                    }catch(err){
                        logger.log(err.message, "red")
                    }
                    if (!inst.getRoomsArray().hasOwnProperty(data.room)) {
                        logger.log("Room " + data.room + " claimed by " + socket.id + ".");
                        socket.join(data.room);
                        server
                            .to(socket.id)
                            .emit("room", { msg: "Joined room " + data.room + "." });
                        server.OotClientList[data.room] = {};
                        api.postEvent({ id: "onPlayerJoined_ServerSide", player: { uuid: socket.id, room: data.room, nickname: data.nickname }, server: inst });
                        if (data.hasOwnProperty("patchFile")) {
                            if (data.patchFile !== "") {
                                server.to(socket.id).emit("requestPatch", encoder.compressData({ patchFile: data.patchFile, room: data.room }));
                            }
                        }
                    } else {
                        logger.log("Room " + data.room + " joined by " + socket.id + ".");
                        socket.join(data.room);
                        server.to(socket.id).emit("room", { msg: "Joined room " + data.room + "." });
                        socket.to(data.room).emit("joined", { uuid: socket.id, nickname: data.nickname });
                        if (inst.getRoomsArray()[data.room].hasOwnProperty("patchFile")) {
                            logger.log("Sending patch to user.");
                            server.to(socket.id).emit('receivePatch', { data: inst.getRoomsArray()[data.room].patchFile })
                        }
                        socket["ootRoom"] = data.room;
                    }
                    server.OotClientList[data.room][socket.id] = {
                        ip: socket.request.connection.remoteAddress.split(":")[3],
                        port: "unknown"
                    };
                    server.to(socket.id).emit("udp", { port: inst._udp.port });
                });
                socket.on("sendPatch", function (data) {
                    logger.log("Received patch file for room " + data.room + ". Size: " + data.patch.byteLength + ".");
                    inst.getRoomsArray()[data.room]["patchFile"] = data.patch;
                    server.to(socket.id).emit('receivePatch', { data: inst.getRoomsArray()[data.room].patchFile })
                });
                socket.on("disconnect", function () {
                    server.to(socket.ootRoom).emit("left", { uuid: socket.id });
                    delete server.OotClientList[socket.id];
                });
                socket.on("room_ping", function (data) {
                    let d = encoder.decompressData(data);
                    socket.to(d.room).emit("room_ping", data);
                });
                socket.on("room_pong", function (data) {
                    let d = encoder.decompressData(data);
                    socket.to(d.target.uuid).emit("room_pong", data);
                });
                socket.on("msg", function (data) {
                    if (_channelHandlers.hasOwnProperty(data.channel)) {
                        if (_channelHandlers[data.channel](inst, data)) {
                            socket.to(data.room).emit("msg", data);
                        }
                    } else {
                        socket.to(data.room).emit("msg", data);
                    }
                });
            });
            inst._udp.setDataFn(function (msg) {
                if (msg.packet_id === "udpPunch") {
                    server.OotClientList[msg.room][msg.uuid].port = msg.punchthrough;
                    inst._udp.sendTo(
                        server.OotClientList[msg.room][msg.uuid].ip,
                        msg.punchthrough,
                        {
                            packet_id: "udpPunch",
                            payload: encoder.compressData({
                                packet_id: "udpPunch",
                                writeHandler: "null",
                                port: msg.punchthrough,
                                server: inst._udp.port
                            })
                        }
                    );
                } else {
                    if (_channelHandlers.hasOwnProperty(msg.channel)) {
                        if (_channelHandlers[msg.channel](inst, msg)) {
                            Object.keys(server.OotClientList[msg.room]).forEach(function (key) {
                                if (key !== msg.uuid) {
                                    inst._udp.sendTo(
                                        server.OotClientList[msg.room][key].ip,
                                        msg.punchthrough,
                                        msg
                                    );
                                }
                            });
                        }
                    } else {
                        Object.keys(server.OotClientList[msg.room]).forEach(function (key) {
                            if (key !== msg.uuid) {
                                inst._udp.sendTo(
                                    server.OotClientList[msg.room][key].ip,
                                    msg.punchthrough,
                                    msg
                                );
                            }
                        });
                    }
                }
            });
            inst._udp.setup();
        })(this._ws_server, this);
    }
}

module.exports = new MasterServer();
