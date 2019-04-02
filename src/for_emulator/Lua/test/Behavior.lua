require('OotUtils');
memory.usememorydomain("RDRAM");

local actor_instance = 0x1EC9F0;
local actor_offset = 0x180;
local sub_start = 0x0;
local actor_id = 0x0;

local overlay_table = 0x0E8530;

function getOverlayEntry(actorid) 
    return overlay_table + (actorid * 32);
end

function getBehaviorStart(overlay) 
    return overlay + 0x10;
end

function findSubroutineOffset(start, pointer)
    return start - pointer;
 end

actor_id = readTwoByteUnsigned(actor_instance);
local o = getOverlayEntry(actor_id);
local bs = getBehaviorStart(o);
local realPointer = readPointer(bs);
sub_start = readPointer(actor_instance + actor_offset);
local sub = findSubroutineOffset(sub_start, realPointer);

console.log(DEC_HEX(sub));