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

SAVE_DATA_HANDLER = {}
SAVE_DATA_HANDLER["console"] = {}
SAVE_DATA_HANDLER["clearCache"] = function(d) end

local status_message

function setStatusMessage(msg) status_message = msg end

local update_buffer = {}

function addToBuffer(fn) table.insert(update_buffer, fn) end

local save_context = 0x11A5D0
local save_handler_context = 0x600150
local save_handler_context_map = {}

local inventory_offset = 0x0074
local equipment_offset = 0x009C
local quest_offset = 0x00A5
local biggoron_offset = 0x003E
local heart_container_offset = 0x002E
local death_offset = 0x0022
local magic_beans_offset = 0x009B
local defense_offset = 0x00CF
local big_poes_offset = 0x0EBE
local scene_addr = 0x1C8544
local c_button_offset = 0x0068

local magic_offsets = {bool = 0x3A, size = 0x3C, limit = 0x13F4, qty = 0x0033}

local inventory_slot_addresses = {}

local current_byte = -1

function assignByte()
    current_byte = current_byte + 1
    return current_byte
end

save_handler_context_map["inventory"] = {}
save_handler_context_map["inventory"]["read"] = {}
save_handler_context_map["inventory"]["write"] = {}

for i = 0, 23, 1 do
    local b = assignByte()
    save_handler_context_map.inventory.write["inventory_slot_" .. tostring(i)] = b
    save_handler_context_map.inventory.read["inventory_slot_" .. tostring(i)] = save_context + inventory_offset + i
end

save_handler_context_map["upgrades"] = {}
save_handler_context_map.upgrades["upgrade_deku_nuts"] = assignByte()
save_handler_context_map.upgrades["upgrade_deku_stick"] = assignByte()
save_handler_context_map.upgrades["upgrade_deku_seeds"] = assignByte()
save_handler_context_map.upgrades["upgrade_wallet"] = assignByte()
save_handler_context_map.upgrades["upgrade_scale"] = assignByte()
save_handler_context_map.upgrades["upgrade_strength"] = assignByte()
save_handler_context_map.upgrades["upgrade_bombs"] = assignByte()
save_handler_context_map.upgrades["upgrade_quiver"] = assignByte()

local save_handler_upgrade_to_inv = {
    upgrade_deku_stick = 0,
    upgrade_deku_nuts = 1,
    upgrade_bombs = 2,
    upgrade_quiver = 3,
    upgrade_deku_seeds = 6
}

save_handler_context_map["equipment"] = {}
save_handler_context_map["equipment"]["write"] = {}
for i = 0, 15, 1 do
    local b = assignByte()
    save_handler_context_map.equipment.write["equipment_slot_" .. tostring(i)] = b
end

save_handler_context_map["quest"] = {}
save_handler_context_map["quest"]["write"] = {}
for i = 0, 23, 1 do
    local b = assignByte()
    save_handler_context_map.quest.write["quest_slot_" .. tostring(i)] = b
end

save_handler_context_map["biggoron"] = {}
save_handler_context_map["biggoron"]["write"] = {}
save_handler_context_map["biggoron"]["write"]["flag"] = assignByte()

save_handler_context_map["heart_containers"] = {}
save_handler_context_map["heart_containers"]["write"] = {}
save_handler_context_map["heart_containers"]["write"]["count"] = assignByte()
save_handler_context_map["heart_containers"]["write"]["this_is_two_bytes"] = assignByte()

save_handler_context_map["death_counter"] = {}
save_handler_context_map["death_counter"]["write"] = {}
save_handler_context_map["death_counter"]["write"]["count"] = assignByte()
save_handler_context_map["death_counter"]["write"]["this_is_two_bytes"] = assignByte()

save_handler_context_map["magic_beans"] = {}
save_handler_context_map["magic_beans"]["write"] = {}
save_handler_context_map["magic_beans"]["write"]["count"] = assignByte()

save_handler_context_map["double_defense"] = {}
save_handler_context_map["double_defense"]["write"] = {}
save_handler_context_map["double_defense"]["write"]["count"] = assignByte()

save_handler_context_map["big_poes"] = {}
save_handler_context_map["big_poes"]["write"] = {}
save_handler_context_map["big_poes"]["write"]["count"] = assignByte()
save_handler_context_map["big_poes"]["write"]["this_is_two_bytes"] = assignByte()

save_handler_context_map["magic"] = {}
save_handler_context_map["magic"]["write"] = {}
save_handler_context_map["magic"]["write"]["bool"] = assignByte()
save_handler_context_map["magic"]["write"]["size"] = assignByte()
save_handler_context_map["magic"]["write"]["limit"] = assignByte()
save_handler_context_map["magic"]["write"]["this_is_two_bytes"] = assignByte()

save_handler_context_map["skulltula"] = {}
save_handler_context_map["skulltula"]["write"] = {}
save_handler_context_map["skulltula"]["write"]["count"] = assignByte()
save_handler_context_map["skulltula"]["write"]["this_is_two_bytes"] = assignByte()

save_handler_context_map["scratch"] = {}
save_handler_context_map["scratch"]["write"] = {}
for i = 1, 8, 1 do
    local b = assignByte()
    save_handler_context_map.scratch.write["scratch_pad_" .. tostring(i)] = b
end

save_handler_context_map["DEBUG"] = {}
save_handler_context_map["DEBUG"]["write"] = {}
save_handler_context_map["DEBUG"]["write"]["spacer"] = assignByte()
save_handler_context_map["DEBUG"]["write"]["addr"] = assignByte()
save_handler_context_map["DEBUG"]["write"]["addr2"] = assignByte()
save_handler_context_map["DEBUG"]["write"]["addr3"] = assignByte()
save_handler_context_map["DEBUG"]["write"]["addr4"] = assignByte()

save_handler_context_map["DEBUG"]["write"]["trigger"] = assignByte()

save_handler_context_map["scene"] = {}
save_handler_context_map["scene"]["previous"] = assignByte()
save_handler_context_map["scene"]["this_is_two_bytes"] = assignByte()
save_handler_context_map["scene"]["current"] = assignByte()
save_handler_context_map["scene"]["this_is_two_bytes_as_well"] = assignByte()

local upgrades_offset = 0x00A1
local upgrade_1_targets = {
    upgrade_deku_nuts = {2, 3, 4},
    upgrade_deku_stick = {5, 6, 7}
}
local upgrade_1_payloads = {
    upgrade_deku_nuts = {
        level_0 = {0, 0, 0},
        level_1 = {0, 0, 1},
        level_2 = {0, 1, 0},
        level_3 = {0, 1, 1}
    },
    upgrade_deku_stick = {
        level_0 = {0, 0, 0},
        level_1 = {0, 0, 1},
        level_2 = {0, 1, 0},
        level_3 = {0, 1, 1}
    }
}
local upgrade_1_quantities = {
    upgrade_deku_nuts = {level_0 = 0, level_1 = 20, level_2 = 30, level_3 = 40},
    upgrade_deku_stick = {level_0 = 0, level_1 = 10, level_2 = 20, level_3 = 30}
}

local upgrade_2_targets = {
    upgrade_deku_seeds = {1, 2},
    upgrade_wallet = {3, 4},
    upgrade_scale = {6, 7}
}
local upgrade_2_payloads = {
    upgrade_deku_seeds = {
        level_0 = {0, 0},
        level_2 = {0, 1},
        level_3 = {1, 0},
        level_4 = {1, 1}
    },
    upgrade_wallet = {level_0 = {0, 0}, level_1 = {0, 1}, level_2 = {1, 0}},
    upgrade_scale = {level_0 = {0, 0}, level_1 = {0, 1}, level_2 = {1, 0}}
}
local upgrade_2_quantities = {
    upgrade_deku_seeds = {level_0 = 0, level_1 = 30, level_2 = 40, level_3 = 50},
    upgrade_wallet = {level_0 = 99, level_1 = 200, level_2 = 500, level_3 = 9999},
    upgrade_scale = {level_0 = 0, level_1 = 0, level_2 = 0}
}

local upgrade_3_targets = {
    upgrade_strength = {1, 2, 3},
    upgrade_bombs = {4, 5},
    upgrade_quiver = {7, 8}
}
local upgrade_3_payloads = {
    upgrade_strength = {
        level_0 = {0, 0, 0},
        level_1 = {0, 1, 0},
        level_2 = {1, 0, 0},
        level_3 = {1, 1, 0}
    },
    upgrade_bombs = {
        level_0 = {0, 0},
        level_1 = {0, 1},
        level_2 = {1, 0},
        level_3 = {1, 1}
    },
    upgrade_quiver = {
        level_0 = {0, 0},
        level_1 = {0, 1},
        level_2 = {1, 0},
        level_3 = {1, 1}
    }
}
local upgrade_3_quantities = {
    upgrade_strength = {level_0 = 0, level_1 = 0, level_2 = 0, level_3 = 0},
    upgrade_bombs = {level_0 = 0, level_1 = 20, level_2 = 30, level_3 = 40},
    upgrade_quiver = {level_0 = 0, level_1 = 30, level_2 = 40, level_3 = 50}
}

local upgrade_objects = {
    byte_0 = {
        targets = upgrade_1_targets,
        payloads = upgrade_1_payloads,
        qty = upgrade_1_quantities
    },
    byte_1 = {
        targets = upgrade_2_targets,
        payloads = upgrade_2_payloads,
        qty = upgrade_2_quantities
    },
    byte_2 = {
        targets = upgrade_3_targets,
        payloads = upgrade_3_payloads,
        qty = upgrade_3_quantities
    }
}

local upgrade_lookup_table = {
    upgrade_deku_nuts = "byte_0",
    upgrade_deku_stick = "byte_0",
    upgrade_deku_seeds = "byte_1",
    upgrade_wallet = "byte_1",
    upgrade_scale = "byte_1",
    upgrade_strength = "byte_2",
    upgrade_bombs = "byte_2",
    upgrade_quiver = "byte_2"
}

local upgrade_address_lookup_table = {
    byte_0 = save_context + upgrades_offset + 0,
    byte_1 = save_context + upgrades_offset + 1,
    byte_2 = save_context + upgrades_offset + 2
}

local sendSavePacket_stub = function(name, data)
    -- Do shit
end

SAVE_DATA_HANDLER["send"] = sendSavePacket_stub

function levelToInt(level)
    if (level == "level_0") then
        return 0xFF
    elseif (level == "level_1") then
        return 1
    elseif (level == "level_2") then
        return 2
    elseif (level == "level_3") then
        return 3
    elseif (level == "level_4") then
        return 4
    end
end

function IntToLevel(level)
    if (level == 0xFF) then
        return "level_0"
    elseif (level == 1) then
        return "level_1"
    elseif (level == 2) then
        return "level_2"
    elseif (level == 3) then
        return "level_3"
    elseif (level == 4) then
        return "level_4"
    end
end

function update_inventory(bool)
    for k, v in pairs(save_handler_context_map.inventory.read) do
        addToBuffer(function()
            setStatusMessage("Updating " .. k .. ".")
            local r = readByte(v)
            if (bool) then
                writeByte(
                    save_handler_context + save_handler_context_map.inventory.write[k],
                    r
                )
            end
            SAVE_DATA_HANDLER["send"](
                k,
                readByte(save_handler_context + save_handler_context_map.inventory.write[k])
            )
        end)
    end
end

function update_upgrades(byte, bool)
    local key = "byte_" .. tostring(byte)
    local obj = upgrade_objects[key]
    local r = readByteAsBinary(save_context + upgrades_offset + byte)
    for k, v in pairs(obj.targets) do
        addToBuffer(function()
            setStatusMessage("Updating " .. k .. ".")
            local payloads = obj.payloads[k]
            local temp = {}
            for a, b in pairs(v) do table.insert(temp, r[b]) end
            for c, d in pairs(payloads) do
                if (equals(temp, d, true)) then
                    if (bool) then
                        writeByte(
                            save_handler_context + save_handler_context_map.upgrades[k],
                            levelToInt(c)
                        )
                    end
                    SAVE_DATA_HANDLER["send"](
                        k,
                        readByte(save_handler_context + save_handler_context_map.upgrades[k])
                    )
                end
            end
        end)
    end
end

local equipment_lookup_table = {}
local equipment_bit_lookup_table = {}

function setup_equipment_table()
    local c = 0
    for k, v in pairs(readByteAsBinary(save_context + equipment_offset + 0)) do
        local key = "equipment_slot_" .. tostring(c)
        equipment_lookup_table[key] = save_context + equipment_offset + 0
        equipment_bit_lookup_table[key] = k
        c = c + 1
    end
    for k, v in pairs(readByteAsBinary(save_context + equipment_offset + 1)) do
        local key = "equipment_slot_" .. tostring(c)
        equipment_lookup_table[key] = save_context + equipment_offset + 1
        equipment_bit_lookup_table[key] = k
        c = c + 1
    end
end

setup_equipment_table()

function update_equipment(bool)
    addToBuffer(function()
        setStatusMessage("Updating equipment...")
        -- Two bytes.
        local a = readByteAsBinary(save_context + equipment_offset + 0)
        local b = readByteAsBinary(save_context + equipment_offset + 1)
        local c = 0
        for k, v in pairs(a) do
            local key = "equipment_slot_" .. tostring(c)
            if (bool) then
                if (v > 0) then
                    writeByte(
                        save_handler_context + save_handler_context_map.equipment.write[key],
                        v
                    )
                else
                    writeByte(
                        save_handler_context + save_handler_context_map.equipment.write[key],
                        0xFF
                    )
                end
            end
            SAVE_DATA_HANDLER["send"](
                key,
                readByte(save_handler_context + save_handler_context_map.equipment.write[key])
            )
            c = c + 1
        end
        for k, v in pairs(b) do
            local key = "equipment_slot_" .. tostring(c)
            if (bool) then
                if (v > 0) then
                    writeByte(
                        save_handler_context + save_handler_context_map.equipment.write[key],
                        v
                    )
                else
                    writeByte(
                        save_handler_context + save_handler_context_map.equipment.write[key],
                        0xFF
                    )
                end
            end
            SAVE_DATA_HANDLER["send"](
                key,
                readByte(save_handler_context + save_handler_context_map.equipment.write[key])
            )
            c = c + 1
        end
    end)
end

local quest_lookup_table = {}
local quest_bit_lookup_table = {}

function setupQuestTable()
    local d = 0
    for k, v in pairs(readByteAsBinary(save_context + quest_offset + 0)) do
        local key = "quest_slot_" .. tostring(d)
        quest_lookup_table[key] = save_context + quest_offset + 0
        quest_bit_lookup_table[key] = k
        d = d + 1
    end
    for k, v in pairs(readByteAsBinary(save_context + quest_offset + 1)) do
        local key = "quest_slot_" .. tostring(d)
        quest_lookup_table[key] = save_context + quest_offset + 1
        quest_bit_lookup_table[key] = k
        d = d + 1
    end
    for k, v in pairs(readByteAsBinary(save_context + quest_offset + 2)) do
        local key = "quest_slot_" .. tostring(d)
        quest_lookup_table[key] = save_context + quest_offset + 2
        quest_bit_lookup_table[key] = k
        d = d + 1
    end
end

setupQuestTable()

function update_quest(bool)
    -- Three bytes.
    addToBuffer(function()
        setStatusMessage("Updating quest items...")
        local a = readByteAsBinary(save_context + quest_offset + 0)
        local b = readByteAsBinary(save_context + quest_offset + 1)
        local c = readByteAsBinary(save_context + quest_offset + 2)
        local d = 0
        for k, v in pairs(a) do
            local key = "quest_slot_" .. tostring(d)
            if (bool) then
                if (v > 0) then
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        v
                    )
                else
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        0xFF
                    )
                end
            end
            SAVE_DATA_HANDLER["send"](
                key,
                readByte(save_handler_context + save_handler_context_map.quest.write[key])
            )
            d = d + 1
        end
        for k, v in pairs(b) do
            local key = "quest_slot_" .. tostring(d)
            if (bool) then
                if (v > 0) then
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        v
                    )
                else
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        0xFF
                    )
                end
            end
            SAVE_DATA_HANDLER["send"](
                key,
                readByte(save_handler_context + save_handler_context_map.quest.write[key])
            )
            d = d + 1
        end
        for k, v in pairs(c) do
            local key = "quest_slot_" .. tostring(d)
            if (bool) then
                if (v > 0) then
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        v
                    )
                else
                    writeByte(
                        save_handler_context + save_handler_context_map.quest.write[key],
                        0xFF
                    )
                end
            end
            SAVE_DATA_HANDLER["send"](
                key,
                readByte(save_handler_context + save_handler_context_map.quest.write[key])
            )
            d = d + 1
        end
    end)
end

function update_biggoron(bool)
    addToBuffer(function()
        local a = readByte(save_context + biggoron_offset)
        if (bool) then
            if (a > 0) then
                writeByte(
                    save_handler_context + save_handler_context_map.biggoron.write.flag,
                    a
                )
            else
                writeByte(
                    save_handler_context + save_handler_context_map.biggoron.write.flag,
                    0xFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "biggoron",
            readByte(save_handler_context + save_handler_context_map.biggoron.write.flag)
        )
    end)
end

function update_heart_containers(bool)
    addToBuffer(function()
        setStatusMessage("Updating heart containers...")
        local a = readTwoByteUnsigned(save_context + heart_container_offset)
        if (bool) then
            if (a > 0) then
                writeTwoByteUnsigned(
                    save_handler_context + save_handler_context_map.heart_containers.write.count,
                    a
                )
            else
                writeTwoByteUnsigned(
                    save_handler_context + save_handler_context_map.heart_containers.write.count,
                    0xFFFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "heart_containers",
            readTwoByteUnsigned(save_handler_context + save_handler_context_map.heart_containers.write.count)
        )
    end)
end

function update_death_counter()
    local a = readTwoByteUnsigned(save_context + death_offset)
    if (a > 0) then
        writeTwoByteUnsigned(
            save_handler_context + save_handler_context_map.death_counter.write.count,
            a
        )
    else
        writeTwoByteUnsigned(
            save_handler_context + save_handler_context_map.death_counter.write.count,
            0xFFFF
        )
    end
    SAVE_DATA_HANDLER["send"](
        "death_counter",
        readTwoByteUnsigned(save_handler_context + save_handler_context_map.death_counter.write.count)
    )
end

function update_magic_beans()
    local a = readByte(save_context + magic_beans_offset)
    if (a > 0) then
        writeByte(
            save_handler_context + save_handler_context_map.magic_beans.write.count,
            a
        )
    else
        writeByte(
            save_handler_context + save_handler_context_map.magic_beans.write.count,
            0xFF
        )
    end
    SAVE_DATA_HANDLER["send"](
        "magic_beans",
        readByte(save_handler_context + save_handler_context_map.magic_beans.write.count)
    )
end

function update_defense(bool)
    addToBuffer(function()
        setStatusMessage("Updating defense status...")
        local a = readByte(save_context + defense_offset)
        if (bool) then
            if (a > 0) then
                writeByte(
                    save_handler_context + save_handler_context_map.double_defense.write.count,
                    a
                )
            else
                writeByte(
                    save_handler_context + save_handler_context_map.double_defense.write.count,
                    0xFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "double_defense",
            readByte(save_handler_context + save_handler_context_map.double_defense.write.count)
        )
    end)
end

function update_big_poes()
    local a = readTwoByteUnsigned(save_context + big_poes_offset)
    if (a > 0) then
        writeTwoByteUnsigned(
            save_handler_context + save_handler_context_map.big_poes.write.count,
            a
        )
    else
        writeTwoByteUnsigned(
            save_handler_context + save_handler_context_map.big_poes.write.count,
            0xFFFF
        )
    end
    SAVE_DATA_HANDLER["send"](
        "big_poes",
        readTwoByteUnsigned(save_handler_context + save_handler_context_map.big_poes.write.count)
    )
end

function update_magic(bool)
    addToBuffer(function()
        setStatusMessage("Updating magic...")
        local a = readByte(save_context + magic_offsets.bool)
        if (bool) then
            if (a > 0) then
                writeByte(
                    save_handler_context + save_handler_context_map.magic.write.bool,
                    a
                )
            else
                writeByte(
                    save_handler_context + save_handler_context_map.magic.write.bool,
                    0xFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "magic_bool",
            readByte(save_handler_context + save_handler_context_map.magic.write.bool)
        )
        local b = readByte(save_context + magic_offsets.size)
        if (bool) then
            if (b > 0) then
                writeByte(
                    save_handler_context + save_handler_context_map.magic.write.size,
                    b
                )
            else
                writeByte(
                    save_handler_context + save_handler_context_map.magic.write.size,
                    0xFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "magic_size",
            readByte(save_handler_context + save_handler_context_map.magic.write.size)
        )
        local c = readTwoByteUnsigned(save_context + magic_offsets.limit)
        if (bool) then
            if (c > 0) then
                writeTwoByteUnsigned(
                    save_handler_context + save_handler_context_map.magic.write.limit,
                    c
                )
            else
                writeTwoByteUnsigned(
                    save_handler_context + save_handler_context_map.magic.write.limit,
                    0xFFFF
                )
            end
        end
        SAVE_DATA_HANDLER["send"](
            "magic_limit",
            readTwoByteUnsigned(save_handler_context + save_handler_context_map.magic.write.limit)
        )
    end)
end

local scene_offset = 0x00D4
local scene_full_send = true

function update_scenes()
    writeTwoByteUnsigned(
        save_handler_context + save_handler_context_map.scene.previous,
        readTwoByteUnsigned(save_handler_context + save_handler_context_map.scene.current)
    )
    writeTwoByteUnsigned(
        save_handler_context + save_handler_context_map.scene.current,
        readTwoByteUnsigned(scene_addr)
    )
    if (scene_full_send) then
        addToBuffer(function()
            for i = 0, 0x0B0C, 1 do
                setStatusMessage("Updating scenes " .. tostring(math.floor((i / 0x0B0C) * 100)) .. "%")
                local d = readByteAsBinary(save_context + scene_offset + i)
                for k, v in pairs(d) do
                    writeByte(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                        v
                    )
                end
                SAVE_DATA_HANDLER["send"](
                    "scene_" .. tostring(i),
                    readByteRange(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                        0x8
                    )
                )
            end
        end)
        scene_full_send = false
    else
        local p = readTwoByteUnsigned(save_handler_context + save_handler_context_map.scene.previous) * 0x1C
        local c = readTwoByteUnsigned(save_handler_context + save_handler_context_map.scene.current) * 0x1C
        local addr = save_context + scene_offset + p
        local addr2 = save_context + scene_offset + c
        for i = 0, 0x1C, 1 do
            addToBuffer(function()
                setStatusMessage("Updating previous scene " .. tostring(math.floor((i / 0x1C) * 100)) .. "%")
                local d = readByteAsBinary(addr + i)
                for k, v in pairs(d) do
                    writeByte(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                        v
                    )
                end
                SAVE_DATA_HANDLER["send"](
                    "scene_" .. tostring(p + i),
                    readByteRange(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                        0x8
                    )
                )
            end)
        end
        for i = 0, 0x1C, 1 do
            addToBuffer(function()
                setStatusMessage("Updating current scene " .. tostring(math.floor((i / 0x1C) * 100)) .. "%")
                local d = readByteAsBinary(addr2 + i)
                for k, v in pairs(d) do
                    writeByte(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                        v
                    )
                end
                SAVE_DATA_HANDLER["send"](
                    "scene_" .. tostring(c + i),
                    readByteRange(
                        save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                        0x8
                    )
                )
            end)
        end
    end
end

local skulltula_count_offset = 0x00D0
local skulltula_flags_offset = 0x0E9C
local skulltula_flags_size = 0x18

function update_skulltula()
    addToBuffer(function()
        setStatusMessage("Updating skulltula count...")
        local a = readTwoByteUnsigned(save_context + skulltula_count_offset)
        if (a > 0) then
            writeTwoByteUnsigned(
                save_handler_context + save_handler_context_map.skulltula.write.count,
                a
            )
        else
            writeTwoByteUnsigned(
                save_handler_context + save_handler_context_map.skulltula.write.count,
                0xFF
            )
        end
        SAVE_DATA_HANDLER["send"](
            "skulltula_count",
            readTwoByteUnsigned(save_handler_context + save_handler_context_map.skulltula.write.count)
        )
    end)
    for i = 0, skulltula_flags_size, 1 do
        addToBuffer(function()
            setStatusMessage("Updating skulltula flags " .. tostring(math.floor((i / skulltula_flags_size) * 100)) .. "%")
            local b = readByteAsBinary(save_context + skulltula_flags_offset + i)
            for k, v in pairs(b) do
                writeByte(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                    v
                )
            end
            SAVE_DATA_HANDLER["send"](
                "skulltula_flag_" .. tostring(i),
                readByteRange(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                    0x8
                )
            )
        end)
    end
end

local event_flags_offset = 0x0ED4
local event_flags_size = 0x1C

function update_event_flags()
    for i = 0, event_flags_size, 1 do
        addToBuffer(function()
            setStatusMessage("Updating event flags " .. tostring(math.floor((i / event_flags_size) * 100)) .. "%")
            local b = readByteAsBinary(save_context + event_flags_offset + i)
            for k, v in pairs(b) do
                writeByte(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                    v
                )
            end
            SAVE_DATA_HANDLER["send"](
                "event_flag_" .. tostring(i),
                readByteRange(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                    0x8
                )
            )
        end)
    end
end

local item_flags_offset = 0x0EF0
local item_flags_size = 0x8

function update_item_flags()
    for i = 0, item_flags_size, 1 do
        addToBuffer(function()
            setStatusMessage("Updating item flags " .. tostring(math.floor((i / item_flags_size) * 100)) .. "%")
            local b = readByteAsBinary(save_context + item_flags_offset + i)
            for k, v in pairs(b) do
                writeByte(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                    v
                )
            end
            SAVE_DATA_HANDLER["send"](
                "item_flag_" .. tostring(i),
                readByteRange(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                    0x8
                )
            )
        end)
    end
end

local inf_table_offset = 0x0EF8
local inf_table_size = 0x3C

function update_inf_table()
    for i = 0, inf_table_size, 1 do
        addToBuffer(function()
            setStatusMessage("Updating inf flags " .. tostring(math.floor((i / inf_table_size) * 100)) .. "%")
            local b = readByteAsBinary(save_context + inf_table_offset + i)
            for k, v in pairs(b) do
                writeByte(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                    v
                )
            end
            SAVE_DATA_HANDLER["send"](
                "inf_table_" .. tostring(i),
                readByteRange(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                    0x8
                )
            )
        end)
    end
end

local dungeon_items_offset = 0x00A8
local dungeon_item_bytes = 0x14

function update_dungeon_items()
    for i = 0, dungeon_item_bytes, 1 do
        addToBuffer(function()
            setStatusMessage("Updating dungeon items " .. tostring(math.floor((i / dungeon_item_bytes) * 100)) .. "%")
            local b = readByteAsBinary(save_context + dungeon_items_offset + i)
            for k, v in pairs(b) do
                writeByte(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_" .. tostring(k)],
                    v
                )
            end
            SAVE_DATA_HANDLER["send"](
                "dungeon_items_" .. tostring(i),
                readByteRange(
                    save_handler_context + save_handler_context_map.scratch.write["scratch_pad_1"],
                    0x8
                )
            )
        end)
    end
end

writeFourBytesUnsigned(
    save_handler_context + save_handler_context_map["DEBUG"]["write"]["addr"],
    save_handler_context + 0x80000000
)

SAVE_DATA_HANDLER["link_exists"] = function() return false end

function handleInventorySlotUpdate(packet)
    local last = readByte(save_handler_context_map.inventory.read[packet.packet_id])
    writeByte(
        save_handler_context_map.inventory.read[packet.packet_id],
        packet.data.data
    )
    if (last == 0xFF or packet.data.data == 0xFF) then return end
    -- Check buttons.
    local addr = 0x600108
    local addr2 = addr + 0x4
    local b = readByte(0x11A638 + 0)
    local l = readByte(0x11A638 + 1)
    local d = readByte(0x11A638 + 2)
    local r = readByte(0x11A638 + 3)
    if (b == last) then
        writeByte(0x11A638 + 0, packet.data.data)
        writeFourBytesUnsigned(addr2, 0x00000000)
        SAVE_DATA_HANDLER["console"].log("Updating " .. "B" .. " button")
    end
    if (l == last) then
        writeByte(0x11A638 + 1, packet.data.data)
        writeFourBytesUnsigned(addr2, 0x00000001)
        SAVE_DATA_HANDLER["console"].log("Updating " .. "C-Left" .. " button")
    end
    if (d == last) then
        writeByte(0x11A638 + 2, packet.data.data)
        writeFourBytesUnsigned(addr2, 0x00000002)
        SAVE_DATA_HANDLER["console"].log("Updating " .. "C-Down" .. " button")
    end
    if (r == last) then
        writeByte(0x11A638 + 3, packet.data.data)
        writeFourBytesUnsigned(addr2, 0x00000003)
        SAVE_DATA_HANDLER["console"].log("Updating " .. "C-Right" .. " button")
    end
    writeFourBytesUnsigned(addr, 0x00000002)
end

local ammo_map = {
    upgrade_deku_seeds_1 = 20,
    upgrade_deku_seeds_2 = 30,
    upgrade_deku_seeds_3 = 40,
    upgrade_quiver_1 = 30,
    upgrade_quiver_2 = 40,
    upgrade_quiver_3 = 50,
    upgrade_bombs_1 = 20,
    upgrade_bombs_2 = 30,
    upgrade_bombs_3 = 40,
    upgrade_deku_stick_1 = 1,
    upgrade_deku_stick_2 = 20,
    upgrade_deku_stick_3 = 30,
    upgrade_deku_nuts_1 = 1,
    upgrade_deku_nuts_2 = 30,
    upgrade_deku_nuts_3 = 40
}

local ammo_item_map = {
    upgrade_deku_seeds = 6,
    upgrade_quiver = 3,
    upgrade_bombs = 2,
    upgrade_deku_stick = 0,
    upgrade_deku_nuts = 1
}

local ammo_offset = 0x008C

function handleUpgradeSlotUpdate(packet)
    local key = upgrade_lookup_table[packet.packet_id]
    local addr = upgrade_address_lookup_table[key]
    local target = upgrade_objects[key].targets[packet.packet_id]
    local payload = upgrade_objects[key].payloads[packet.packet_id][IntToLevel(packet.data.data)]
    local r = readByteAsBinary(addr)
    local c = 0
    for k, v in pairs(target) do
        c = c + 1
        r[v] = payload[c]
    end
    writeByteAsBinary(addr, r)
    local ammo_key = packet.packet_id .. "_" .. tostring(packet.data.data)
    if (ammo_map[ammo_key] ~= nil) then
        writeByte(
            save_context + ammo_offset + ammo_item_map[packet.packet_id],
            ammo_map[ammo_key]
        )
    end
end

function handleEquipmentSlotUpgrade(packet)
    local addr = equipment_lookup_table[packet.packet_id]
    local bit = equipment_bit_lookup_table[packet.packet_id]
    local r = readByteAsBinary(addr)
    r[bit] = packet.data.data
    writeByteAsBinary(addr, r)
end

function handleQuestSlotUpgrade(packet)
    local addr = quest_lookup_table[packet.packet_id]
    local bit = quest_bit_lookup_table[packet.packet_id]
    local r = readByteAsBinary(addr)
    r[bit] = packet.data.data
    writeByteAsBinary(addr, r)
end

function handleBiggoronSlotUpgrade(packet)
    local addr = save_context + biggoron_offset
    writeByte(addr, packet.data.data)
end

local full_heal_offset = 0x1424

function triggerFullHeal(bool)
    if (bool) then
        writeTwoByteUnsigned(save_context + full_heal_offset, 0x65)
    end
end

function handleHeartContainerSlotUpgrade(packet)
    local addr = save_context + heart_container_offset
    local r = readTwoByteUnsigned(addr)
    if (packet.data.data > r) then
        writeTwoByteUnsigned(addr, packet.data.data)
        triggerFullHeal(true)
    end
end

function handleDoubleDefenseSlotUpgrade(packet)
    local addr = save_context + defense_offset
    writeByte(addr, packet.data.data)
end

function handleMagicSlotUpgrade(packet)
    local addr = save_context + magic_offsets.bool
    local addr2 = save_context + magic_offsets.limit + 0x1
    local addr3 = save_context + magic_offsets.qty
    if (packet.data.data > 0) then
        writeByte(addr, packet.data.data)
        writeByte(addr2, 0x30)
        writeByte(addr3, 0x30)
    end
end

function handleMagicSlotUpgrade2(packet)
    local addr = save_context + magic_offsets.size
    local addr2 = save_context + magic_offsets.limit + 0x1
    local addr3 = save_context + magic_offsets.qty
    if (packet.data.data > 0) then
        writeByte(addr, packet.data.data)
        writeByte(addr2, 0x60)
        writeByte(addr3, 0x60)
    end
end

local isDirty = false
local dirtyTimer = -1

function handleSceneSlotUpgrade(packet)
    local addr = save_context + scene_offset + packet.byte
    local current = readByteAsBinary(addr)
    local markDirty = false
    for k, v in pairs(current) do
        if (v == 1 and packet.data.data[k] == 0) then
            packet.data.data[k] = 1
            markDirty = true
        end
    end
    writeByteAsBinary(addr, packet.data.data)
    if (markDirty) then
        isDirty = true
        dirtyTimer = 100
        status_message = "Save data dirty. Preparing to repair..."
    end
end

function handleEventSlotUpgrade(packet)
    local addr = save_context + event_flags_offset + packet.byte
    writeByteAsBinary(addr, packet.data.data)
end

function handleItemFlagSlotUpgrade(packet)
    local addr = save_context + item_flags_offset + packet.byte
    writeByteAsBinary(addr, packet.data.data)
end

function handleInfFlagSlotUpgrade(packet)
    local addr = save_context + inf_table_offset + packet.byte
    writeByteAsBinary(addr, packet.data.data)
end

function handleDungeonItemSlotUpgrade(packet)
    local addr = save_context + dungeon_items_offset + packet.byte
    writeByteAsBinary(addr, packet.data.data)
end

function handleSkulltulaFlagSlotUpgrade(packet)
    local addr = save_context + skulltula_flags_offset + packet.byte
    writeByteAsBinary(addr, packet.data.data)
end

function handleSkulltulaCountSlotUpgrade(packet)
    local addr = save_context + skulltula_count_offset
    writeTwoByteUnsigned(addr, packet.data.data)
end

SAVE_DATA_HANDLER["hook"] = function()
    update_inventory(true)
    update_upgrades(0, true)
    update_upgrades(1, true)
    update_upgrades(2, true)
    update_equipment(true)
    update_quest(true)
    update_biggoron(true)
    update_heart_containers(true)
    update_death_counter()
    update_magic_beans()
    update_defense(true)
    update_big_poes()
    update_magic(true)
    update_scenes()
    update_skulltula()
    update_event_flags()
    update_item_flags()
    update_inf_table()
    update_dungeon_items()
    addToBuffer(function() setStatusMessage("") end)
end

SAVE_DATA_HANDLER["debug_hook"] = function()
    if (readByte(save_handler_context + save_handler_context_map["DEBUG"]["write"]["trigger"]) > 0) then
        writeByte(
            save_handler_context + save_handler_context_map["DEBUG"]["write"]["trigger"],
            0x0
        )
        update_inventory(false)
        update_upgrades(0, false)
        update_upgrades(1, false)
        update_upgrades(2, false)
        update_equipment(false)
        update_quest(false)
        update_biggoron(false)
        update_heart_containers(false)
        --
        --
        update_defense(false)
        --
        update_magic(false)
        addToBuffer(function() setStatusMessage("") end)
    end
    if next(update_buffer) ~= nil then
        if (SAVE_DATA_HANDLER.link_exists()) then
            local fn = table.remove(update_buffer, 1)
            fn()
        end
    end
    if (dirtyTimer > 0 and isDirty == true) then
        dirtyTimer = dirtyTimer - 1
        -- SAVE_DATA_HANDLER.console.log(dirtyTimer);
    end
    if (dirtyTimer == 0 and isDirty == true) then
        SAVE_DATA_HANDLER.clearCache({})
        update_scenes()
        update_skulltula()
        update_event_flags()
        update_item_flags()
        update_inf_table()
        dirtyTimer = -1
        isDirty = false
    end
    gui.drawString(0, 20, status_message)
end

SAVE_DATA_HANDLER["writeHandler"] = function(packet)
    if (packet.typeHandler == "inventory") then
        handleInventorySlotUpdate(packet)
    elseif (packet.typeHandler == "upgrade") then
        handleUpgradeSlotUpdate(packet)
    elseif (packet.typeHandler == "equipment") then
        handleEquipmentSlotUpgrade(packet)
    elseif (packet.typeHandler == "quest") then
        handleQuestSlotUpgrade(packet)
    elseif (packet.typeHandler == "biggoron") then
        handleBiggoronSlotUpgrade(packet)
    elseif (packet.typeHandler == "heart_containers") then
        handleHeartContainerSlotUpgrade(packet)
    elseif (packet.typeHandler == "double_defense") then
        handleDoubleDefenseSlotUpgrade(packet)
    elseif (packet.typeHandler == "magic_bool") then
        handleMagicSlotUpgrade(packet)
    elseif (packet.typeHandler == "magic_size") then
        handleMagicSlotUpgrade2(packet)
    elseif (packet.typeHandler == "scene") then
        handleSceneSlotUpgrade(packet)
    elseif (packet.typeHandler == "events") then
        handleEventSlotUpgrade(packet)
    elseif (packet.typeHandler == "item_flags") then
        handleItemFlagSlotUpgrade(packet)
    elseif (packet.typeHandler == "inf_flags") then
        handleInfFlagSlotUpgrade(packet)
    elseif (packet.typeHandler == "dungeon_items") then
        handleDungeonItemSlotUpgrade(packet)
    elseif (packet.typeHandler == "skulltula_flag") then
        handleSkulltulaFlagSlotUpgrade(packet)
    elseif (packet.typeHandler == "skulltula_count") then
        handleSkulltulaCountSlotUpgrade(packet)
    end
end

SAVE_DATA_HANDLER["sceneTrigger"] = function(packet)
    update_scenes()
    addToBuffer(function() setStatusMessage("") end)
end

return SAVE_DATA_HANDLER
