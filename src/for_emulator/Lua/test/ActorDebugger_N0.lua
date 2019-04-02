memory.usememorydomain("RDRAM");
local json = require("json");
require("OotUtils");

local open = io.open

local function read_file(path)
    local file = open(path, "rb") -- r read mode and b binary mode
    if not file then return nil end
    local content = file:read "*a" -- *a or *all reads the whole file
    file:close()
    return bizstring.remove(content, 0, 3);
end

local global = 0x1C84A0;
local offset = 0x1C30;

function findPointersInTable()
	local name_data = json.decode(read_file("ACTOR_NAMES.json"));
    local num = 1;
    local count = 0;
    local names = {
        "Switches",
        "Prop (1)",
        "Player",
        "Bomb",
        "NPC",
        "Enemy",
        "Prop",
        "Item/Action",
        "Misc",
        "Boss",
        "Door",
        "Chests"
    };
    local actorMap = {};
    while (num ~= 13) do
        actorMap[names[num]] = {};
        local numOfActors = readFourBytesUnsigned(global + offset + count);
        console.log(names[num]);
        console.log("Count: " .. tostring(numOfActors));
        count = count + 4;
        console.log("List Start: " .. DEC_HEX(global + offset + count));
        local actorPointer = readFourBytesUnsigned(global + offset + count);
        if (actorPointer > 0) then
            local rPointer = readPointer(global + offset + count);
			local id = DEC_HEX(readTwoByteUnsigned(rPointer));
			local name = "";
			if (name_data[id] ~= nil) then
				console.log(DEC_HEX(rPointer) .. " " .. id .. " " .. name_data[id]);
			else
				console.log(DEC_HEX(rPointer) .. " " .. id);
			end
            table.insert(actorMap[names[num]], rPointer);
            rPointer = readPointer(rPointer + 0x124);
            while (rPointer > 0) do
                table.insert(actorMap[names[num]], rPointer);
                local id = DEC_HEX(readTwoByteUnsigned(rPointer));
				local name = "";
				if (name_data[id] ~= nil) then
					console.log(DEC_HEX(rPointer) .. " " .. id .. " " .. name_data[id]);
				else
					console.log(DEC_HEX(rPointer) .. " " .. id);
				end
				   rPointer = readPointer(rPointer + 0x124);
				end
        end
        count = count + 4;
        num = num + 1;
    end
    return actorMap;
end

local frameHooks = {};

function addFramehook(fn, max) table.insert(frameHooks, {fn = fn, max = max, count = 0}) end

local offset_start = 0x00;
local size = 0x260;
local image = 0;
local flip = false;
local iterator = 4
local folder = "top";
local msg = "";
local size_original = size;
local offset_start_original = offset_start;
local actorid = 0x52;

function tryGanon() 
    savestate.loadslot(2);
    local map = findPointersInTable();
    local storage = {};
    local con = true;
    local pass = 1;
    if (flip) then 
        pass = 2;
        msg = "Pass " .. tostring(pass) .. "/2. Iteration " .. tostring(image) .. "/" .. tostring(tonumber(offset_start / 4));
        if (offset_start == 0) then 
            con = false;
        end
    else
        msg = "Pass " .. tostring(pass) .. "/2. Iteration " .. tostring(image) .. "/" .. tostring(tonumber(size / 4));
        if (size == 0) then 
            con = false;
        end
    end
    for k, v in pairs(map.Boss) do 
        local id = readTwoByteUnsigned(v);
        if (id == actorid) then 
            console.log("Found Ganondorf in savestate 2.");
            console.log(DEC_HEX(offset_start));
            console.log(DEC_HEX(size));
            for i=offset_start,size,iterator do 
                if (readByte(v + i) ~= 0x80) then 
                    storage[i] = readFourBytesUnsigned(v + i);
                    console.log("Storing " .. DEC_HEX(storage[i]) .. " for offset " .. DEC_HEX(i));
                else
                    console.log("Ignoring offset " .. DEC_HEX(i) .. " because it is a pointer.");
                end
            end
        end
    end
    savestate.loadslot(1);
    for k, v in pairs(map.Boss) do 
        local id = readTwoByteUnsigned(v);
        if (id == actorid) then 
            for j, k in pairs(storage) do 
                console.log("Writing " .. DEC_HEX(k) .. " to offset " .. DEC_HEX(j));
                writeFourBytesUnsigned(v + j, k);
            end
            writeFourBytesUnsigned(v + 0x184, 0x801E81E8);
        end
    end

    addFramehook(function() 
        client.screenshot("./GANON/" .. folder .. "/" .. tostring(image) .. ".png");
        image = image + 1;
        if (flip) then 
            offset_start = offset_start - 4;
            size = size + 4;
        else
            offset_start = offset_start + 4;
            size = size - 4;
        end
    end, 500);
    addFramehook(function() 
        console.clear()
        if (con) then 
            tryGanon();
        else
            if (flip ~= true) then 
                size = size_original;
                offset_start = offset_start_original;
                local temp = size;
                local temp2 = offset_start;
                size = temp2;
                offset_start = temp;
                iterator = iterator / -1;
                flip = true;
                image = 0;
                folder = "bottom";
                tryGanon();
            end
            msg = "";
        end
    end, 100);
end

function elim() 
    savestate.loadslot(2);
    local g = 0x20B520;
    local storage = {};
    console.log("{");
    for i=0x110,0x1C2,4 do 
        local mem = readFourBytesUnsigned(g + i);
        if (readByte(g + i) ~= 0x80 and mem > 0) then 
            console.log("   " .. DEC_HEX(i) .. ":" .. DEC_HEX(mem) .. ",");
            storage[i] = mem;
        end
    end 
    console.log("}");
    savestate.loadslot(1);
    for k, v in pairs(storage) do 
        writeFourBytesUnsigned(g + k, v);
    end
    writeFourBytesUnsigned(g + 0x184, 0x801E81E8);
end

addFramehook(function() 
    --tryGanon();
    
   -- elim();
end, 100);

local actors = findPointersInTable();


local loc = readByteRange(0x1DAA30 + 0x24, 0xC);


while true do
    if (next(frameHooks) ~= nil) then
        if (frameHooks[1].count >= frameHooks[1].max) then
            local n = table.remove(frameHooks, 1)
            n.fn()
        else
            frameHooks[1].count = frameHooks[1].count + 1
        end
    end
    gui.drawString(0, 0, msg)
    emu.frameadvance()
end