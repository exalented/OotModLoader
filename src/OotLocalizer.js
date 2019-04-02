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
const logger = require('./OotLogger')("Localization");

class OotLocalizer{

    constructor(file){
        logger.log("Loading file: " + file + ".");
        this._data = JSON.parse(fs.readFileSync(process.cwd() + '/plugins/localization/' + file + ".json"));
    }

    getLocalizedString(key){
        return this._data[key];
    }

}

class OotIconizer{
    constructor(file){
        logger.log("Loading file: " + file + ".");
        this._data = JSON.parse(fs.readFileSync(process.cwd() + '/plugins/localization/' + file + ".json"));
    }

    getIcon(key){
        return this._data[key];
    }
}

class OotTextReader{
    constructor(file){
        logger.log("Loading file: " + file + ".");
        let original = fs.readFileSync(process.cwd() + '/plugins/localization/' + file, "utf8");
        this._data = original.split(/\r?\n/);
    }

    getData(){
        return this._data;
    }
}

module.exports = {create: function(file){
    return new OotLocalizer(file);
}, icons: function(file){
    return new OotIconizer(file);
}, text: function(file){
    return new OotTextReader(file);
}};