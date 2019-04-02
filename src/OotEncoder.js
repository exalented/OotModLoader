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

const zlib = require('zlib');
const VERSION = require('./OotVersion');
const jpack = require('jsonpack');
const aes256 = require('aes256');
const logger = require('./OotLogger')("Encoder");
let enc_key = aes256.encrypt(VERSION, VERSION);

class VersionMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

class Encoder {

    setEncKey(key){
        enc_key = aes256(VERSION, key)
    }

    compressData(data) {
        let pack = jpack.pack(data);
        let compress = zlib.deflateSync(pack);
        let base = Buffer.from(compress).toString('base64');
        return base;
    }

    decompressData(data) {
        try {
            let buffer = Buffer.from(data, 'base64');
            let decompress = zlib.inflateSync(buffer).toString();
            let unpack = jpack.unpack(decompress);
            return unpack;
        } catch (err) {
            if (err) {
                logger.log(err.message)
                throw new VersionMismatchError();
            }
        }
    }

}

module.exports = new Encoder();