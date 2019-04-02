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

// This is Lynn the fake test client.
// She mimics a normal OotRandoCoop client for testing purposes during development.

const IO_Client = require('socket.io-client');
const crypto = require('crypto');
const fs = require("fs");
const jpack = require('jsonpack');

let master_server_ip = "127.0.0.1";
let master_server_port = "8081";
let GAME_ROOM = "test";
let nickname = "Lynn";
let my_uuid = "";
let logger = require('./OotLogger')("Lynn");

let encoder = require('./OotEncoder');

const socket = IO_Client.connect("http://" + master_server_ip + ":" + master_server_port);

function sendDataToMaster(data){
    socket.emit('msg', {
        channel: 'msg',
        room: GAME_ROOM,
        uuid: my_uuid,
        nickname: nickname,
        payload: encoder.compressData(data)
    });
}

function sendDataToMasterRaw(data){
    socket.emit('msg', {
        channel: 'msg',
        room: GAME_ROOM,
        uuid: my_uuid,
        nickname: nickname,
        payload: data
    });
}

function sendDataToMasterOnChannel(channel, data){
    socket.emit('msg', {
        channel: channel,
        room: GAME_ROOM,
        uuid: my_uuid,
        nickname: nickname,
        payload: encoder.compressData(data)
    });
}

let o = false;
let int = null;

function runDemo(){
    setTimeout(function(){
        console.log("Starting demo...");
        let m = JSON.parse(fs.readFileSync("movement_test.json"));
        setTimeout(function(){
            int = setInterval(function(){
                if (m.length > 0){
                    let packet = m.shift();
                    sendDataToMasterRaw(packet);
                }else{
                    clearInterval(int);
                    int = null;
                    logger.log("Demo end.");
                }
            }, 50);
        }, 100);
    }, 5000);
}

let save = [];

let recording = false;

let minutes = 5;

function startRecording(scene){
    console.log("Starting recording...");
    sendDataToMasterOnChannel('scene', {packet_id: "scene", writeHandler: "81", data: scene});
    setTimeout(stopRecording, (minutes * 60) * 1000);
    recording = true;
}

function stopRecording(){
    sendDataToMasterOnChannel('scene', {packet_id: "scene", writeHandler: "81", data: -1});
    console.log("Stopping recording...");
    recording = false;
}

function record(data){
    if (recording){
        save.push(data);
        fs.writeFileSync("movement_test.json", JSON.stringify(save));
    }
}

socket.on('connect', function(){
    o = false;
    socket.on('id', function(data){
        my_uuid = data.id;
        logger.log("Client: My UUID: " + my_uuid);
        socket.emit('room', {room: GAME_ROOM});
    });
    socket.on('room', function(data){
        logger.log(data.msg);
        socket.emit('room_ping', {room: GAME_ROOM, uuid: my_uuid, nickname: nickname});
    });
    socket.on('joined', function(data){
        logger.log(data.uuid + " joined.");
    });
    socket.on('room_ping', function(data){
        logger.log("Got ping from " + data.nickname + ".");
        socket.emit('room_pong', {room: GAME_ROOM, uuid: my_uuid, nickname: nickname});
    });
    socket.on('room_pong', function(data){
        logger.log("Got pong from " + data.nickname + ".");
    });
    socket.on('msg', function(data){
        if (!o){
            //startRecording(encoder.decompressData(data.payload).data);
            runDemo();
            o = true;
        }
        record(data.payload);
    });
});