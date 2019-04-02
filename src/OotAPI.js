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

const emulator = require(global.OotRunDir + "/OotBizHawk");
const logger = require('./OotLogger')("API");

class OotAPI {
    constructor() {
        this._transformerFn = function () { };
        this._eventHandlers = {};
        this._routeFn = function () { };
        this._clienthookFn = function () { };
        this._tokenStorage = {};
        this._channelFn = function () { };
        this.GAME_VERSION = "10";
        this._plugindir = "";
        this._serverSideStorage = function () { };
        this._ModuleStorage = {};
    }

    set plugindir(dir) {
        logger.log("Plugin directory set to " + dir + ".");
        this._plugindir = dir;
    }

    registerModule(name, m) {
        this._ModuleStorage[name] = m;
    }

    getModule(name) {
        return this._ModuleStorage[name];
    }

    getServerSideStorage(room) {
        return this._serverSideStorage(room);
    }

    setServerSideStorage(fn) {
        this._serverSideStorage = fn;
    }
    
    getTokenStorage() {
        return this._tokenStorage;
    }

    setTransformerFn(fn) {
        this._transformerFn = fn;
    }

    setRouteFn(fn) {
        this._routeFn = fn;
    }

    setClientHookFn(fn) {
        this._clienthookFn = fn;
    }

    setChannelFn(fn) {
        this._channelFn = fn;
    }

    postEvent(event) {
        if (this._eventHandlers.hasOwnProperty(event.id)) {
            for (let i = 0; i < this._eventHandlers[event.id].length; i++) {
                try {
                    this._eventHandlers[event.id][i](event);
                } catch (err) {
                    logger.log("Error posting event " + event.id + " due to:", "red");
                    logger.log(err.stack, "red");
                    continue;
                }
            }
        }
    }

    registerClientSidePacketHook(packet_id, hook) {
        this._clienthookFn(packet_id, hook);
    }

    registerPacketRoute(packet_id, route) {
        this._routeFn(packet_id, route);
    }

    registerServerChannel(name, fn) {
        this._channelFn(name, fn);
    }

    registerConfigCategory(name, options) {
        //stub
    }

    registerPacket(packet) {
        let p = packet;
        if (typeof packet === "string") {
            p = require(packet);
        }
        emulator.registerDynamicPacket({ packet_id: "registerPacket", data: p });
    }

    registerEvent(eventid) {
        if (!this._eventHandlers.hasOwnProperty(eventid)){
            this._eventHandlers[eventid] = [];
        }
    }

    registerEventHandler(eventid, handler) {
        if (!this._eventHandlers.hasOwnProperty(eventid)) {
            this.registerEvent(eventid);
        }
        return this._eventHandlers[eventid].push(handler) - 1;
    }

    unregisterEventHandler(eventid, handlerid) {
        this._eventHandlers[eventid].splice(handlerid, 1);
    }

    registerToken(token) {
        let p = token;
        if (typeof token === "string") {
            p = require(token);
        }
        emulator.registerDynamicPacket({ packet_id: "registerToken", data: p });
        this.getTokenStorage()[p.token] = p.replace;
    }

    registerPacketTransformer(packet_id, fn) {
        this._transformerFn(packet_id, fn);
    }

    loadVariables(name) {
        try {
            let LOAD_YOU = require(this._plugindir +
                "/versions/" +
                this.GAME_VERSION +
                "/" +
                name);
            return LOAD_YOU;
        } catch (err) {
            logger.log(err.stack, "red");
        }
    }
}

module.exports = new OotAPI();
