memory.usememorydomain("RDRAM")
require("OotUtils")

local context = 0x600000
local buffer_offset = 0x90
local link_instance = 0x1DAA30

function getPuppet(slot)
	local slots = {}
	local s = 0;
	for i=1,3,1 do 
		if (i == 1) then 
			s = s + 4;
		else
			s = s + 8;
		end
		table.insert(slots, s);
	end
	console.log(slots);
    return readPointer(context + buffer_offset + tonumber(slots[slot]))
end

function hex2rgb(hex)
    hex = hex:gsub("#", "")
    return tonumber("0x" .. hex:sub(1, 2)), tonumber("0x" .. hex:sub(3, 4)), tonumber("0x" .. hex:sub(5, 6))
end

function ranndomHexColor() 
	local r = math.random(255);
	local g = math.random(255);
	local b = math.random(255);
	return r, g, b
end

local run = true

form = forms.newform(
    250,
    500,
    "OotOnline Puppet Debugger",
    function() run = false end
)
local ypos = 0

function increasePos() ypos = ypos + 20 end

function drawString(str, pos)
    local pb = forms.pictureBox(form, 0, pos, 500, 20)
    forms.drawString(pb, 0, 0, str)
end

function drawLabel(str, pos) forms.label(form, str, 0, pos, 500, 20) end

local locked_puppet = getPuppet(1)

drawString("Puppet Found: " .. DEC_HEX(locked_puppet), ypos)
increasePos()

forms.button(
    form,
    "Move Puppet to me.",
    function()
        local pos = readByteRange(link_instance + 0x24, 0xC)
        writeByteRange(locked_puppet + 0x24, pos)
    end,
    0,
    ypos,
    200,
    20
)
increasePos()

local anim_box = forms.checkbox(form, "Animate it.", 5, ypos)
increasePos()
increasePos()
drawLabel("Tunic Color", ypos)
increasePos()
local color = forms.textbox(form, "#eb41f4", 50, 50, nil, 5, ypos)
increasePos()
drawLabel("Right Hand", ypos)
increasePos()
local rhand = forms.dropdown(
    form,
    {"Empty", "OoT", "Closed Fist", "Bow", "Hookshot"},
    5,
    ypos,
    100,
    20
)
increasePos()

local rhand_table = {}
rhand_table["Empty"] = 0x800F7918
rhand_table["OoT"] = 0x800F7988
rhand_table["Closed Fist"] = 0x800F7928
rhand_table["Bow"] = 0x800F7938
rhand_table["Hookshot"] = 0x800F79A8

drawLabel("Left Hand", ypos)
increasePos()
local lhand = forms.dropdown(form, {"Empty", "Bottle"}, 5, ypos, 100, 20)
increasePos()

local lhand_table = {}
lhand_table["Empty"] = 0x800F78D8
lhand_table["Bottle"] = 0x800F79D8

drawLabel("Sheath", ypos)
increasePos()
local sheath = forms.dropdown(form, {"Empty", "Master Sword"}, 5, ypos, 100, 20)
increasePos()

local sheath_table = {}
sheath_table["Empty"] = 0x800F7958
sheath_table["Master Sword"] = 0x800F77F8

local frameHooks = {}

function addFramehook(fn, max) table.insert(frameHooks, {fn = fn, max = max, count = 0}) end

for i = 1, 3, 1 do
    addFramehook(
        function()
			local p = getPuppet(i)
			console.log(DEC_HEX(p));
            local anim = readByteRange(context, 0x86)
            writeByteRange(p + 0x1E0, anim)
            writeFourBytesUnsigned(p + 0x140, rhand_table[forms.gettext(rhand)])
            writeFourBytesUnsigned(p + 0x144, lhand_table[forms.gettext(lhand)])
            writeFourBytesUnsigned(p + 0x148, sheath_table[forms.gettext(sheath)])
			local pos = readByteRange(link_instance + 0x24, 0xC)
			local r, g, b = ranndomHexColor()
			writeByte(p + 0x154, r)
			writeByte(p + 0x155, g)
			writeByte(p + 0x156, b)
            writeByteRange(p + 0x24, pos)
        end,
        100
    )
end

while run do
    if (forms.ischecked(anim_box)) then
        local anim = readByteRange(context, 0x86)
        writeByteRange(locked_puppet + 0x1E0, anim)
    end
    pcall(function()
        local r, g, b = hex2rgb(forms.gettext(color))
        writeByte(locked_puppet + 0x154, r)
        writeByte(locked_puppet + 0x155, g)
        writeByte(locked_puppet + 0x156, b)
    end)
    writeFourBytesUnsigned(
        locked_puppet + 0x140,
        rhand_table[forms.gettext(rhand)]
    )
    writeFourBytesUnsigned(
        locked_puppet + 0x144,
        lhand_table[forms.gettext(lhand)]
    )
    writeFourBytesUnsigned(
        locked_puppet + 0x148,
        sheath_table[forms.gettext(sheath)]
    )
    if (next(frameHooks) ~= nil) then
        if (frameHooks[1].count >= frameHooks[1].max) then
            local n = table.remove(frameHooks, 1)
            n.fn()
        else
            frameHooks[1].count = frameHooks[1].count + 1
        end
    end
    emu.frameadvance()
end
