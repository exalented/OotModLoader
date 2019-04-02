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

const fs = require("fs");

function toHex(d) {
    return "0x" + parseInt(d, 16).toString(16).toUpperCase()
}

class Gameshark {
    constructor() {
    }

    read(path) {
        let original = fs.readFileSync(path, "utf8");

        let lines = original.split(/\r?\n/);
        let commands = {
            params: {},
            codes: []
        };
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].substr(0, 2) === "--") {
                continue;
            }
            if (lines[i].substr(0, 1) === "#") {
                let params = lines[i].replace("#", "").split(":");
                for (let k = 0; k < params.length; k += 2) {
                    commands.params[params[k]] = params[k + 1];
                }
                continue;
            }
            let a = lines[i].substr(0, 2);
            let b = lines[i].substr(2, lines[i].length);
            let c = "0x" + b.split(" ")[0];
            let d = b.split(" ")[1];
            commands.codes.push({ type: a, addr: c, payload: toHex(d) });
        }
        return commands;
    }
}

let gs = new Gameshark();

module.exports = gs;