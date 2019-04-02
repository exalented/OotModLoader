--[[/*
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
*/]] --
memory.usememorydomain("RDRAM")

local json = require("json")
require("OotUtils")
local socket = require("socket")
local tcp
local udp
local triggerNext = false
local hasDownloadedSave = false
local save = require("SaveDataHandler")
local actor = require("ActorDataHandler")
local VERSION = "@major@.@minor@.@buildNumber@.@release_type@"

local open = io.open

local function write_file(path, content)
    local file = open(path, "w") -- r read mode and b binary mode
    file:write(content)
    file:close()
end

local packet_cache = {}

function _sendPacket(id, data, template, net)
    if (data == nil) then return false end
    local payload = {}
    payload["packet_id"] = id
    if (template.readHandler ~= nil) then payload["writeHandler"] = template.readHandler end
    if (template.protocol ~= nil) then payload["protocol"] = template.protocol end
    payload["data"] = data
    if (packet_cache[id] ~= nil) then
        if (equals(packet_cache[id], payload, true)) then return false end
    end
    local d = json.encode(payload)
    local length = string.len(d)
    net:send(tostring(length) .. "#" .. d)
    packet_cache[id] = payload
    return true
end

function sendPacket(id, data, template) _sendPacket(id, data, template, tcp) end

function sendPacketUDP(id, data, template) _sendPacket(id, data, template, udp) end

function downloadSaveData(flag) end

function connectToNode()
    if (readFourBytesUnsigned(0x1C8514) == 0x00100000 or readFourBytesUnsigned(0x1C8514) == 0x0) then return false end
    tcp = socket.tcp()
    udp = socket.udp()
    console.writeline("Connecting...")
    local t = tcp:connect("127.0.0.1", 1337)
    tcp:settimeout(0)
    -- udp2:setsockname("*", 60001);
    udp:setpeername('127.0.0.1', 1337)
    udp:settimeout(0)
    -- udp2:settimeout(0);
    return t == 1
end

display_messages = {}
display_message = {
    msg = "",
    icon = "",
    sx = 0,
    sy = 0,
    sw = 16,
    sh = 16,
    sound = "",
    mute = true
}
displayMessageTimer = 0
displayMessageTimerMax = 100
local tokenStorage = {}
local readhandlers = {}
local writehandlers = {}
local packethandlers = {}
local packetbuilders = {}
local frameHooks = {}
local actorhooks = {}
local linkTriggerStorage = {}
local DEBUG_MESSAGES = false
local freeze_packets = {}

function addFreezePacket(packet) table.insert(freeze_packets, packet) end

function sendMessage(msg)
    table.insert(
        display_messages,
        {
            msg = msg,
            icon = "",
            sound = "",
            sx = 0,
            sy = 0,
            sw = 16,
            sh = 16,
            mute = true
        }
    )
end

function sendMessageWithIcon(msg, icon, sx, sy)
    table.insert(
        display_messages,
        {
            msg = msg,
            icon = icon,
            sound = "",
            sx = sx,
            sy = sy,
            sw = 16,
            sh = 16,
            mute = true
        }
    )
end

function sendMessageWithIconAndSound(msg, icon, sx, sy, soundid)
    table.insert(
        display_messages,
        {
            msg = msg,
            icon = icon,
            sound = soundid,
            sx = sx,
            sy = sy,
            sw = 16,
            sh = 16,
            mute = true
        }
    )
end

function playSound(id)
    local addr = 0x600108
    local addr2 = addr + 0x4
    writeFourBytesUnsigned(addr2, id)
    writeFourBytesUnsigned(addr, 0x0003)
end

function checkMessages()
    if (displayMessageTimer < displayMessageTimerMax) then
        if (display_message.icon == '') then
            gui.drawString(0, 0, display_message.msg)
        else
            gui.drawString(16, 0, display_message.msg)
            drawSprite(
                display_message.icon,
                display_message.sx,
                display_message.sy,
                display_message.sw,
                display_message.sh,
                0,
                0
            )
        end
        if (display_message.sound == '') then
        else
            if (display_message.mute ~= true) then
                playSound(tonumber(display_message.sound))
                display_message.mute = true
            end
        end
        displayMessageTimer = displayMessageTimer + 1
    else
        if next(display_messages) ~= nil then
            display_message = table.remove(display_messages, 1)
            displayMessageTimer = 0
        end
    end
    -- gui.drawString(0, 20, "Pending Tasks: " .. tostring(#frameHooks));
end

function reloadCoreState()
    client.pause()
    local save = memorysavestate.savecorestate()
    memorysavestate.loadcorestate(save)
    memorysavestate.removestate(save)
    client.unpause()
end

function parseGSCode(code)
    if (code.type == "81") then
        memory.usememorydomain("RDRAM")
        writeTwoByteUnsigned(tonumber(code.addr), tonumber(code.payload))
    elseif (code.type == "80") then
        memory.usememorydomain("RDRAM")
        writeByte(tonumber(code.addr), tonumber(code.payload))
    elseif (code.type == "82") then
        memory.usememorydomain("ROM")
        writeByte(tonumber(code.addr), tonumber(code.payload))
        memory.usememorydomain("RDRAM")
    elseif (code.type == "83") then
        memory.usememorydomain("ROM")
        writeTwoByteUnsigned(tonumber(code.addr), tonumber(code.payload))
        memory.usememorydomain("RDRAM")
    end
end

function copyWords(addr, offset, size)
    local data = {}
    if (size <= 0x140 and size >= 0x110) then
        for i = 0, size, 4 do data[i] = readFourBytesUnsigned(addr + offset + i) end
    end
    return data
end

function addActorhook(fn, addr, offset, readHandler, hash, template)
    local duplicateHook = false
    for k, v in pairs(actorhooks) do if (hash == v.hash) then duplicateHook = true end end
    if (duplicateHook) then return end
    if (DEBUG_MESSAGES) then
        if (type(template.actorType) == "string") then
            sendMessage("Hooked actor at " .. DEC_HEX(addr) .. "." .. " Type: " .. template.actorType .. " " .. readHandler)
        else
            sendMessage("Hooked actor at " .. DEC_HEX(addr) .. "." .. " Type: " .. DEC_HEX(template.actorType) .. " " .. readHandler)
        end
    end
    local hook = {
        fn = fn,
        removeMeNextFrame = false,
        hash = hash,
        addr = addr,
        offset = offset,
        readHandler = readHandler,
        template = template,
        knownValue = 0,
        ignoreForFrames = 0,
        roomFlag = readByte(addr + 0x03),
        type = template.type,
        checksum = readFourBytesUnsigned(addr + 0x138)
    }
    if (template.size ~= nil) then hook["size"] = template.size end
    actorhooks[hash] = hook
    actorhooks[hash].knownValue = readhandlers[actorhooks[hash].readHandler](actorhooks[hash])
end

function addFramehook(fn, max) table.insert(frameHooks, {fn = fn, max = max, count = 0}) end

function isTitleScreen()
    if (tokenStorage["@save_data@"] ~= nil) then
        if (readTwoByteUnsigned(tokenStorage["@save_data@"] + 0x1352) == 0) then return true end
    end
end

readhandlers["actor_behavior"] = function(d)
    local sub_start = readPointer(d.addr + d.offset)
    local actorid = tonumber(d.template.actorType)
    local b = sub_start - readPointer(tokenStorage["@overlay_table@"] + (actorid * 32) + 0x10)
    return b
end

readhandlers["80"] = function(d)
    return readByte(tonumber(d.addr) + tonumber(d.offset))
end

readhandlers["81"] = function(d)
    return readTwoByteUnsigned(tonumber(d.addr) + tonumber(d.offset))
end

readhandlers["fourBytes"] = function(d)
    return readFourBytesUnsigned(tonumber(d.addr) + tonumber(d.offset))
end

readhandlers["commandBuffer"] = function(d)
    return {
        command = readFourBytesUnsigned(tonumber(d.addr) + tonumber(d.offset)),
        params = readFourBytesUnsigned(tonumber(d.addr) + 4 + tonumber(d.offset))
    }
end

local rangeCache = {}

readhandlers["range"] = function(d)
    return readByteRange(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.size)
    )
end

readhandlers["range_sizeCheck"] = function(d)
    local comparision = readPointer(tonumber(d.comparision.stop)) - readPointer(tonumber(d.comparision.start))
    if (comparision == tonumber(d.comparision.expected)) then
        return readByteRange(
            readPointer(tonumber(d.addr)) + tonumber(d.offset),
            tonumber(d.size)
        )
    else
        return {}
    end
end

readhandlers["range_binary"] = function(d)
    return readByteRange_asBinary(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.size)
    )
end

writehandlers["range_binary"] = function(d)
    writeByteRange_asBinary(tonumber(d.addr) + tonumber(d.offset), d.data)
end

readhandlers["range_binaryhex"] = function(d)
    return readByteRange_asBinaryHex(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.size)
    )
end

writehandlers["range_binaryhex"] = function(d)
    writeByteRange_asBinaryHex(tonumber(d.addr) + tonumber(d.offset), d.data)
end

writehandlers["pauseHooks"] = function(d) addFramehook(function() end, tonumber(d.frames)) end

writehandlers["clearFramehooks"] = function(d) frameHooks = {} end

writehandlers["actorHook"] = function(d)
    addFramehook(
        function()
            local okToHook = true
            if (d.filter ~= nil) then
                local filterTest = readByte(tonumber(d.pointer) + tonumber(d.filter.offset))
                if (d.filter["extended"] ~= nil) then
                    filterTest = readTwoByteUnsigned(tonumber(d.pointer) + tonumber(d.filter.offset))
                end
                if (filterTest ~= tonumber(d.filter.data)) then okToHook = false end
            end
            if (okToHook) then
                local hash = DEC_HEX(tonumber(d.actorType)) .. "-" .. DEC_HEX(tonumber(d.hook)) .. "-" .. tostring(readTwoByteUnsigned(tokenStorage["@scene@"])) .. "-" .. tostring(readByte(tokenStorage["@room@"])) .. "-" .. d.uuid
                addActorhook(
                    function(hook)
                        if (hook.checksum ~= readFourBytesUnsigned(hook.addr + 0x138)) then
                            hook.removeMeNextFrame = true
                            return
                        end
                        if (hook.ignoreForFrames == 0) then
                            local data = {}
                            data["value"] = readhandlers[hook.readHandler](hook)
                            data["hash"] = hook.hash
                            if (equals(hook.knownValue, data.value) ~= true) then
                                hook.knownValue = data.value
                                sendPacket(d.packet_id, data, hook.template)
                            end
                        else
                            hook.ignoreForFrames = hook.ignoreForFrames - 1
                        end
                    end,
                    tonumber(d.pointer),
                    tonumber(d.hook),
                    d.hook_readHandler,
                    hash,
                    d
                )
            end
        end,
        1
    )
end

writehandlers["actorHook_old"] = function(d)
    local actorId = 0
    addFramehook(
        function()
            local current = readPointer(tonumber(d.addr) + tonumber(d.offset))
            while (current > 0) do
                local okToHook = true
                if (d.actorType ~= "*") then
                    if (readTwoByteUnsigned(current) ~= tonumber(d.actorType)) then okToHook = false end
                end
                if (d.filter ~= nil) then
                    local filterTest = readByte(current + tonumber(d.filter.offset))
                    if (filterTest ~= tonumber(d.filter.data)) then okToHook = false end
                end
                if (okToHook) then
                    local hash = tostring(d.actorType) .. "-" .. d.hook .. "-" .. tostring(readTwoByteUnsigned(tokenStorage["@scene@"])) .. "-" .. tostring(readByte(tokenStorage["@room@"])) .. "-" .. tostring(actorId)
                    actorId = actorId + 1
                    addActorhook(
                        function(hook)
                            if (hook.ignoreForFrames == 0) then
                                local data = {}
                                data["value"] = readhandlers[hook.readHandler](hook)
                                data["hash"] = hook.hash
                                if (equals(hook.knownValue, data.value) ~= true) then
                                    hook.knownValue = data.value
                                    sendPacket(d.packet_id, data, hook.template)
                                end
                            else
                                hook.ignoreForFrames = hook.ignoreForFrames - 1
                            end
                        end,
                        current,
                        tonumber(d.hook),
                        d.hook_readHandler,
                        hash,
                        d
                    )
                end
                current = readPointer(current + tonumber(d.data))
            end
        end,
        1
    )
end

writehandlers["bit"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    local temp = toBits(readByte(tonumber(d.addr) + tonumber(d.offset)))
    d.bitset = tonumber(d.bitset) + 1
    temp[d.bitset] = tonumber(d.data)
    writeByte(
        tonumber(d.addr) + tonumber(d.offset),
        fromBits(temp)
    )
end

writehandlers["bit_copy"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    local temp = toBits(readByte(tonumber(d.addr) + tonumber(d.offset)))
    local temp2 = toBits(readByte(tonumber(d.data) + tonumber(d.data_offset)))
    d.bitset = tonumber(d.bitset) + 1
    temp2[d.bitset] = temp[d.bitset]
    writeByte(
        tonumber(d.data) + tonumber(d.data_offset),
        fromBits(temp2)
    )
end

writehandlers["retrieveWord"] = function(d)
    addFramehook(
        function()
            if (d.isPointer ~= nil) then
                if (d.isPointer) then
                    d.addr = readPointer(tonumber(d.addr))
                    if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
                end
            end
            local r = readFourBytesUnsigned(tonumber(d.addr))
            sendPacket(d.packet_id, r, {})
        end,
        d.delay
    )
end

writehandlers["81_subtract"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeTwoByteUnsigned(
        tonumber(d.addr) + tonumber(d.offset),
        (readTwoByteUnsigned(tonumber(d.addr) + tonumber(d.offset)) - tonumber(d.data))
    )
end

writehandlers["delete_all_actors"] = function(d)
    local current = readPointer(tonumber(d.addr) + tonumber(d.offset))
    while (current > 0) do
        writeFourBytesUnsigned(current + 0x130, 0x00000000)
        writeFourBytesUnsigned(current + 0x134, 0x00000000)
        current = readPointer(tonumber(d.addr) + tonumber(d.offset))
    end
end

writehandlers["actorRange"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        writeByteRange(v.addr + tonumber(d.offset), d.data)
        local size = 0
        for i, k in pairs(d.data) do size = size + 1 end
        v.knownValue = readByteRange(v.addr + tonumber(d.offset), size)
        v.ignoreForFrames = 50
    end
end

writehandlers["actor_word"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        writeFourBytesUnsigned(v.addr + tonumber(d.offset), tonumber(d.data))
        v.knownValue = readFourBytesUnsigned(v.addr + tonumber(d.offset))
    end
end

writehandlers["actor_word_copy"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        writeFourBytesUnsigned(
            v.addr + tonumber(d.offset),
            readFourBytesUnsigned(tonumber(d.data))
        )
        v.knownValue = readFourBytesUnsigned(v.addr + tonumber(d.offset))
    end
end

writehandlers["actor_word_copy_reverse"] = function(d)
    if (actorhooks[d.data] ~= nil) then
        local v = actorhooks[d.data]
        writeFourBytesUnsigned(
            readPointer(tonumber(d.addr)) + tonumber(d.offset),
            tonumber(v.addr) + 0x80000000
        )
    end
end

writehandlers["actor_80"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        writeByte(v.addr + tonumber(d.offset), tonumber(d.data))
        v.knownValue = readByte(v.addr + tonumber(d.offset))
    end
end

writehandlers["actor_behavior"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        local slot = readTwoByteUnsigned(v.addr) * 0x20
        local overlay_entry = 0x0E8530 + slot
        local r = overlay_entry + 0x10
        local sub = readFourBytesUnsigned(r) + tonumber(d.data)
        writeFourBytesUnsigned(v.addr + tonumber(d.offset), sub)
        v.knownValue = readFourBytesUnsigned(v.addr + tonumber(d.offset))
        v.ignoreForFrames = 50
    end
end

writehandlers["actor"] = function(d)
    if (actorhooks[d.addr] ~= nil) then
        local v = actorhooks[d.addr]
        writeTwoByteUnsigned(v.addr + tonumber(d.offset), tonumber(d.data))
        v.knownValue = readTwoByteUnsigned(v.addr + tonumber(d.offset))
    end
end

writehandlers["null"] = function(d) end

writehandlers["80"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeByte(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.data)
    )
end

writehandlers["80_binary"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeByte(
        tonumber(d.addr) + tonumber(d.offset),
        fromBits(d.data)
    )
end

writehandlers["80_delay"] = function(d)
    addFramehook(
        function()
            if (d.isPointer ~= nil) then
                if (d.isPointer) then
                    d.addr = readPointer(tonumber(d.addr))
                    if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
                end
            end
            writeByte(
                tonumber(d.addr) + tonumber(d.offset),
                tonumber(d.data)
            )
        end,
        tonumber(d.delay)
    )
end

writehandlers["81"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeTwoByteUnsigned(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.data)
    )
end

writehandlers["81_delay"] = function(d)
    addFramehook(
        function()
            if (d.isPointer ~= nil) then
                if (d.isPointer) then
                    d.addr = readPointer(tonumber(d.addr))
                    if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
                end
            end
            writeTwoByteUnsigned(
                tonumber(d.addr) + tonumber(d.offset),
                tonumber(d.data)
            )
        end,
        tonumber(d.delay)
    )
end

writehandlers["fourBytes"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeFourBytesUnsigned(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.data)
    )
end

writehandlers["fourBytesDelay"] = function(d)
    addFramehook(
        function()
            if (d.isPointer ~= nil) then
                if (d.isPointer) then
                    d.addr = readPointer(tonumber(d.addr))
                    if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
                end
            end
            writeFourBytesUnsigned(
                tonumber(d.addr) + tonumber(d.offset),
                tonumber(d.data)
            )
        end,
        d.delay
    )
end

writehandlers["rangeCache"] = function(d)
    if (rangeCache[tonumber(d.addr) + tonumber(d.offset)] == nil) then
        rangeCache[tonumber(d.addr) + tonumber(d.offset)] = {}
    end
    if (equals(
        rangeCache[tonumber(d.addr) + tonumber(d.offset)],
        d.data,
        true
    )) then

    else
        if (d.isPointer ~= nil) then
            if (d.isPointer) then
                d.addr = readPointer(tonumber(d.addr))
                if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
            end
        end
        writeByteRange(tonumber(d.addr) + tonumber(d.offset), d.data)
        local size = 0
        for i, k in pairs(d.data) do size = size + 1 end
        rangeCache[tonumber(d.addr) + tonumber(d.offset)] = readByteRange(tonumber(d.addr) + tonumber(d.offset), size)
    end
end

writehandlers["range"] = function(d)
    if (d.isPointer ~= nil) then
        if (d.isPointer) then
            d.addr = readPointer(tonumber(d.addr))
            if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
        end
    end
    writeByteRange(tonumber(d.addr) + tonumber(d.offset), d.data)
end

writehandlers["range_delay"] = function(d)
    addFramehook(
        function()
            if (d.isPointer ~= nil) then
                if (d.isPointer) then
                    d.addr = readPointer(tonumber(d.addr))
                    if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
                end
            end
            writeByteRange(tonumber(d.addr) + tonumber(d.offset), d.data)
        end,
        d.delay
    )
end

local frozen_values = {}

writehandlers["freeze"] = function(d)
    d.writeHandler = d.writeHandler_freeze
    table.insert(frozen_values, d)
end

function makeFrozen()
    for k, v in pairs(frozen_values) do packethandlers["genericWrite"](v) end
end

function doCopy(d)
    if (d.data_isPointer ~= nil) then
        d.data = readPointer(tonumber(d.data))
        if (d.data == 0x7FFFFFFF or d.data <= 0x0) then return end
    end
    if (d.isPointer ~= nil) then
        d.addr = readPointer(tonumber(d.addr))
        if (d.addr == 0x7FFFFFFF or d.addr <= 0x0) then return end
    end
    if (d.data_offset ~= nil) then d.data = tonumber(d.data) + tonumber(d.data_offset) end
    if (d.offset ~= nil) then d.addr = tonumber(d.addr) + tonumber(d.offset) end
    local copy = readByteRange(tonumber(d.addr), tonumber(d.size))
    writeByteRange(tonumber(d.data), copy)
end

writehandlers["copy"] = function(d)
    if (d.delay ~= nil) then
        addFramehook(function() doCopy(d) end, tonumber(d.delay))
    else
        doCopy(d)
    end
end

writehandlers["bundle"] = function(d)
    for k, v in pairs(d.data) do writehandlers[v.writeHandler](v) end
end

writehandlers["delay_wrap"] = function(d)
    addFramehook(function() writehandlers[d.writeHandler2](d) end, 1)
end

writehandlers["clearCache"] = function(d)
    for k, v in pairs(packet_cache) do packet_cache[k] = nil end
end

writehandlers["clearActorHooks_room"] = function(d)
    for k, v in pairs(actorhooks) do if (v.type ~= 1) then v.removeMeNextFrame = true end end
end

writehandlers["clearActorHooks"] = function(d)
    for k, v in pairs(actorhooks) do v.removeMeNextFrame = true end
end

writehandlers["clearActorHooks_r"] = function(d)
    local c = {}
    for k, v in pairs(actorhooks) do if (v.roomFlag == 0xFF) then c[k] = v end end
    actorhooks = c
end

writehandlers["clearActorHook"] = function(d)
    sendMessage("Removed hook for actor " .. d.hook .. ".")
    actorhooks[d.hook] = nil
end

writehandlers["msg"] = function(d)
    if (d.icon ~= nil) then
        if (d.sound ~= nil) then
            sendMessageWithIconAndSound(d.msg, d.icon, d.sx, d.sy, d.sound)
        else
            sendMessageWithIcon(d.msg, d.icon, d.sx, d.sy)
        end
    else
        sendMessage(d.msg)
    end
end

writehandlers["hash"] = function(d)
    local hash = memory.hash_region(
        tonumber(d.addr) + tonumber(d.offset),
        tonumber(d.size)
    )
    sendPacket("hash", {hash = hash, random = math.random()}, {})
    triggerNext = true
end

packethandlers["reloadCoreState"] = function(parse) reloadCoreState() end

packethandlers["gs"] = function(parse)
    if (parse.delay ~= nil) then
        addFramehook(
            function() for k, v in pairs(parse.codes) do parseGSCode(v) end end,
            parse.delay
        )
    else
        for k, v in pairs(parse.codes) do parseGSCode(v) end
    end
end

local checksum_cache = {}

writehandlers["loadRom"] = function(packet) client.openrom(packet.rom) end

packethandlers["registerPacket"] = function(parse)
    local data = parse.data
    if (data.bundles ~= nil) then
        for k, v in ipairs(data.bundles) do
            if (tokenStorage[v.addr] ~= nil) then v.addr = tokenStorage[v.addr] end
        end
        packetbuilders[data.packet_id] = function()
            local bundle = {}
            for k, v in ipairs(data.bundles) do
                bundle[v.key] = {}
                bundle[v.key]["data"] = readhandlers[v.readHandler](v)
                bundle[v.key]["writeHandler"] = v.readHandler
            end
            if (data.protocol ~= nil) then
                if (data.protocol == "udp") then sendPacketUDP(data.packet_id, bundle, data) end
            else
                sendPacket(data.packet_id, bundle, data)
            end
        end
    else
        if (tokenStorage[data.addr] ~= nil) then data.addr = tokenStorage[data.addr] end
        packetbuilders[data.packet_id] = function()
            local d = readhandlers[data.readHandler](data)
            if (data.protocol ~= nil) then
                if (data.protocol == "udp") then sendPacketUDP(data.packet_id, d, data) end
            else
                sendPacket(data.packet_id, d, data)
            end
        end
    end
    if (data.notEveryFrame ~= nil) then
        local fn = packetbuilders[data.packet_id]
        linkTriggerStorage[data.packet_id] = fn
        packetbuilders[data.packet_id] = nil
    end
end

packethandlers["registerToken"] = function(parse)
    local data = parse.data
    tokenStorage[data.token] = tonumber(data.replace)
    -- sendMessage("Created token " .. data.token .. " = " .. data.replace .. ".");
end

packethandlers["genericWrite"] = function(parse)
    if (parse.writeHandler ~= nil) then
        if (pcall(function() writehandlers[parse.writeHandler](parse) end) ~= true) then console.log(json.encode(parse)) end
    else
        pcall(function()
            sendMessage("Dropped packet " .. parse.packet_id .. " due to no handler!")
        end)
    end
end

packethandlers["multiPacket"] = function(parse)
    for k, v in pairs(parse.data) do packethandlers["genericWrite"](v) end
end

function doesLinkExist()
    if (gameinfo.getromname() == "Null") then return false end
    if (tokenStorage["@link_instance@"] == nil) then return false end
    if (readFourBytesUnsigned(tokenStorage["@link_instance@"]) == 0x000002FF) then
        -- gui.drawString(0, 20, "Link Exists");
        if (tokenStorage["@save_data@"] ~= nil) then
            if (readFourBytesUnsigned(tokenStorage["@save_data@"] + 0x1352) > 0) then
                -- gui.drawString(0, 40, "Not on Title Screen");
                if (tokenStorage["@isPaused@"] ~= nil) then
                    -- if (readTwoByteUnsigned(tokenStorage["@isPaused@"]) == 0x03) then
                    -- gui.drawString(0, 60, "Not Paused.");
                    return true
                    -- end
                end
            end
        end
    end
    -- gui.drawString(0, 80, "Failed checks.");
    return false
end

local void_out_flag = false
local has_been_in_game = false

local chk_debug = 0x275A39E0
local chk_N0 = 0x275A2440

function checkForSoftReset()
    local chk = readFourBytesUnsigned(0x00000004)
    if (chk == chk_N0) then has_been_in_game = true end
    if (chk ~= chk_N0 and has_been_in_game) then
        has_been_in_game = false
        downloadSaveData()
        sendPacket("softReset", math.random(), {})
        actor:reset()
        return true
    end
    return false
end

function checkForVoidOut()
    if (void_out_cooldown ~= true) then
        if (tokenStorage["@save_data@"] == nil) then return false end
        if (tokenStorage["@continue_state@"] == nil) then return false end
        if (readTwoByteUnsigned(tokenStorage["@save_data@"] + 0x1352) > 0) then
            if (readFourBytesUnsigned(tokenStorage["@continue_state@"]) == 0) then
                local scene = readTwoByteUnsigned(tokenStorage["@scene@"])
                if (scene < 800) then
                    if (void_out_flag == false) then
                        sendPacket("LinkGone", {r = math.random()}, {})
                        void_out_flag = true
                    end
                end
            else
                if (void_out_flag == true) then
                    sendPacket(
                        "LinkBack",
                        {
                            r = math.random(),
                            age = readFourBytesUnsigned(tokenStorage["@save_data@"] + 0x004),
                            scene = readTwoByteUnsigned(tokenStorage["@scene@"])
                        },
                        {}
                    )
                    void_out_flag = false
                end
            end
        end
    end
end

local frame_count_flag = false

function checkFrameCount()
    if (frame_count_flag ~= true) then
        if (tokenStorage["@save_data@"] == nil) then return false end
        if (tokenStorage["@frame_counter@"] == nil) then return false end
        if (readTwoByteUnsigned(tokenStorage["@save_data@"] + 0x1352) > 0) then
            if (readFourBytesUnsigned(tokenStorage["@frame_counter@"]) == 0) then
                local scene = readTwoByteUnsigned(tokenStorage["@scene@"])
                if (scene < 800) then
                    if (frame_count_flag == false) then
                        sendPacket("FrameCountReset", {r = math.random(), bool = true}, {})
                        frame_count_flag = true
                    end
                end
            else
                if (void_out_flag == true) then
                    sendPacket(
                        "FrameCountStarted",
                        {
                            r = math.random(),
                            age = readFourBytesUnsigned(tokenStorage["@save_data@"] + 0x004),
                            scene = readTwoByteUnsigned(tokenStorage["@scene@"]),
                            bool = false
                        },
                        {}
                    )
                    frame_count_flag = false
                end
            end
        end
    end
end

console.clear()

sendMessage("OotModLoader v" .. VERSION)
local connected = false

local packet_queue = {}

function packetGet(net)
    if (connected == false) then
        connected = connectToNode()
        return
    end
    local s, status, partial = net:receive()
    while (s ~= nil and s ~= "") do
        local parse
        pcall(function() parse = json.decode(bizstring.replace(s, "\r\n", "")) end)
        if (parse == nil) then return end
        if (parse.packet_id == "gs" or parse.packet_id == "registerToken") then
            packethandlers[parse.packet_id](parse)
        else
            if (parse.override ~= nil) then
                packethandlers["genericWrite"](parse)
            else
                table.insert(packet_queue, parse)
            end
        end
        s, status, partial = net:receive()
    end
    if (status == "closed" and connected) then
        sendMessage("Connection lost!")
        connected = false
    end
end

mainLoopHooks = {}

function registerMainLoopHook(hook) table.insert(mainLoopHooks, hook) end

registerMainLoopHook(checkForVoidOut)
registerMainLoopHook(checkForSoftReset)
registerMainLoopHook(makeFrozen)
registerMainLoopHook(checkFrameCount);

local triggerNext = false

function updateSaveData()
    if (tokenStorage["@link_instance@"] == nil) then return false end
    if (tokenStorage["@link_state@"] == nil) then return false end
    if (doesLinkExist() ~= true) then return end
    local state = readByte(tokenStorage["@link_instance@"] + tokenStorage["@link_state@"])
    if (state == 0x20 or state == 0x30) then triggerNext = true end
    if (readByte(tokenStorage["@link_instance@"] + tokenStorage["@link_state@"]) == 0x0) then
        if (triggerNext == true) then
            -- sendMessage("Updating save data...");
            save:hook()
            triggerNext = false
        end
    end
end

save["send"] = function(name, data) sendPacket(name, {data = data}, {}) end
save["console"] = console
save["link_exists"] = doesLinkExist
save["clearCache"] = writehandlers["clearCache"]
writehandlers["saveData"] = save.writeHandler
writehandlers["sceneTrigger"] = save.sceneTrigger
actor["console"] = console
actor["send"] = function(data) sendPacket("actorSpawned", {data = data}, {}) end
registerMainLoopHook(updateSaveData)
registerMainLoopHook(save.debug_hook)
registerMainLoopHook(actor.hook)

function mainLoop()
    checkMessages()
    if (doesLinkExist()) then
        while (next(packet_queue) ~= nil) do
            local v = table.remove(packet_queue, 1)
            -- write_file("crash.json", json.encode(v));
            if (packethandlers[v.packet_id] ~= nil) then
                packethandlers[v.packet_id](v)
            else
                packethandlers["genericWrite"](v)
            end
        end
        for k, v in pairs(packetbuilders) do v() end
    end
    if (next(frameHooks) ~= nil) then
        if (frameHooks[1].count >= frameHooks[1].max) then
            local n = table.remove(frameHooks, 1)
            n.fn()
        else
            frameHooks[1].count = frameHooks[1].count + 1
        end
    end
    if (next(actorhooks) ~= nil) then
        for k, v in pairs(actorhooks) do
            if (actorhooks[k].removeMeNextFrame) then
                actorhooks[k] = nil
            else
                actorhooks[k].fn(actorhooks[k])
            end
        end
    end
    packetGet(tcp)
    for k, v in pairs(mainLoopHooks) do v() end
end

while true do
    if (memory["prefetch"] ~= nil) then memory.prefetch() end
    local safe, error = pcall(mainLoop)
    if (safe ~= true) then console.log(error) end
    emu.frameadvance()
end
