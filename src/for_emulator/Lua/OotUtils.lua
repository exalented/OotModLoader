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

function toBits(num)
    -- returns a table of bits, most significant first.
    bits = 8;
    local t = {} -- will contain the bits
    for b = bits, 1, -1 do
        t[b] = math.fmod(num, 2)
        num = math.floor((num - t[b]) / 2)
    end
    return t
end

function fromBits(b)
    local binary = tonumber(table.concat(b));
    if (binary == nil) then
        return 0;
    end
    local bin = string.reverse(binary)
    local sum = 0
    local num;
    for i = 1, string.len(bin) do
        num = string.sub(bin, i, i) == "1" and 1 or 0
        sum = sum + num * math.pow(2, i - 1)
    end
    return sum;
end

function DEC_HEX(IN)
    return "0x" .. bizstring.hex(IN);
end

function serializeDumpStraight(d)
    local save_me = {};
    for k, v in pairs(d) do
        save_me[k + 1] = v;
    end
	return save_me
end

function serializeDumpStraight_asBinaryHex(d)
    local save_me = {};
    for k, v in pairs(d) do
        save_me[DEC_HEX(k)] = toBits(v);
    end
    return save_me
end

function reverseDumpStraight_asBinaryHex(base, data)
    local t = {};
    for k, v in pairs(data) do
        t[base + tonumber(k)] = fromBits(v);
    end
    return t;
end

function serializeDumpStraight_asBinary(d)
    local save_me = {};
    for k, v in pairs(d) do
        save_me[k + 1] = toBits(v);
    end
    return save_me
end

function reverseDumpStraight_asBinary(base, data)
    local t = {};
    for k, v in pairs(data) do
        t[base + (tonumber(k) - 1)] = fromBits(v);
    end
    return t;
end

function reverseDumpStraight(base, data)
    local t = {};
    for k, v in pairs(data) do
        t[base + (tonumber(k) - 1)] = v;
    end
    return t;
end

function equals(o1, o2, ignore_mt)
    if o1 == o2 then return true end
    local o1Type = type(o1)
    local o2Type = type(o2)
    if o1Type ~= o2Type then return false end
    if o1Type ~= 'table' then return false end

    if not ignore_mt then
        local mt1 = getmetatable(o1)
        if mt1 and mt1.__eq then
            --compare using built in method
            return o1 == o2
        end
    end

    local keySet = {}

    for key1, value1 in pairs(o1) do
        local value2 = o2[key1]
        if value2 == nil or equals(value1, value2, ignore_mt) == false then
            return false
        end
        keySet[key1] = true
    end

    for key2, _ in pairs(o2) do
        if not keySet[key2] then return false end
    end
    return true
end

function hashRange(addr, size) 
    return memory.hash_region(addr, size);
end

function readTwoByteUnsigned(addr)
    return memory.read_u16_be(addr);
end

function writeTwoByteUnsigned(addr, value)
    memory.write_u16_be(addr, value);
end

function readByte(addr)
    return memory.readbyte(addr);
end

function readByteAsBinary(addr) 
    return toBits(readByte(addr));
end

function writeByte(addr, value)
    memory.writebyte(addr, value);
end

function writeByteAsBinary(addr, value)
    writeByte(addr, fromBits(value));
 end

function readFourBytesUnsigned(addr)
    return memory.read_u32_be(addr);
end

function writeFourBytesUnsigned(addr, value)
    return memory.write_u32_be(addr, value);
end

function readByteRange(base, size)
    return serializeDumpStraight(memory.readbyterange(base, size));
end

function readByteRange_asBinary(base, size)
    return serializeDumpStraight_asBinary(memory.readbyterange(base, size));
end

function writeByteRange_asBinary(base, data) 
	memory.writebyterange(reverseDumpStraight_asBinary(base, data));
end

function readByteRange_asBinaryHex(base, size)
    return serializeDumpStraight_asBinaryHex(memory.readbyterange(base, size));
end

function writeByteRange_asBinaryHex(base, data) 
	memory.writebyterange(reverseDumpStraight_asBinaryHex(base, data));
end

function writeByteRange(base, data)
    memory.writebyterange(reverseDumpStraight(base, data));
end

function readPointer(base)
    return memory.read_u32_be(base) - 0x80000000;
end

function readRomByte(addr) 
    return memory.readbyte(addr, "ROM");
end

function drawSprite(path, sx, sy, sw, sh, x, y)
    gui.drawImageRegion(path, sx, sy, sw, sh, x, y);
 end