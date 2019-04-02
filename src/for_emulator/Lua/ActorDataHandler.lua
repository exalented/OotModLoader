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
*/]]--

require("OotUtils")

local context = 0x600000
local offset = 0x1E0
local counter = readByte(context + 0x11E0)

local ACTOR_DATA_HANDLER = {}
ACTOR_DATA_HANDLER["console"] = {}
ACTOR_DATA_HANDLER.console["log"] = function(msg) end
ACTOR_DATA_HANDLER["send"] = function(data) end
ACTOR_DATA_HANDLER["reset"] = function() counter = 0 end

ACTOR_DATA_HANDLER["hook"] = function()
    local addr = context + offset + (counter * 16)
    local package = {}
    package["type"] = readFourBytesUnsigned(addr)
    if (package.type ~= 0 and package.type ~= 0xFFFFFFFF) then
        if (package.type ~= 0 and package.type ~= 1 and package.type ~= 2 and package.type ~= 3) then
            writeFourBytesUnsigned(addr, 0xFFFFFFFF)
            package.type = readFourBytesUnsigned(addr)
            counter = counter + 1
            if (counter == 0x100) then counter = 0x0 end
            return;
        end
        if (package.type == 3) then
            package["pointer"] = readPointer(addr + 4)
            if (package.pointer > 0) then
                writeTwoByteUnsigned(addr + 12, readTwoByteUnsigned(package.pointer))
                package["actorID"] = readTwoByteUnsigned(addr + 12)
                package["variable"] = readTwoByteUnsigned(addr + 14)
                package["uuid"] = package["actorID"] .. "_" .. package["variable"] .. "_" .. readTwoByteUnsigned(0x1C8544) .. "_" .. readByte(0x1DA15C) .. "_" .. hashRange(package["pointer"] + 0x8, 0x12)
                ACTOR_DATA_HANDLER.send(package)
                writeFourBytesUnsigned(addr, 0x00000000)
            else
                writeFourBytesUnsigned(addr, 0xFFFFFFFF)
            end
        else
            if (readFourBytesUnsigned(addr + 4) > 0) then
                package["pointer"] = readPointer(addr + 4)
                package["uuid"] = readFourBytesUnsigned(addr + 8)
                writeTwoByteUnsigned(addr + 12, readTwoByteUnsigned(package.pointer))
                package["actorID"] = readTwoByteUnsigned(addr + 12)
                if (package.pointer > 0 and package.uuid > 0) then ACTOR_DATA_HANDLER.send(package) end
                writeFourBytesUnsigned(addr, 0x00000000)
            else
                writeFourBytesUnsigned(addr, 0xFFFFFFFF)
            end
        end
        counter = counter + 1
        if (counter == 0x100) then counter = 0x0 end
    end
end

return ACTOR_DATA_HANDLER
