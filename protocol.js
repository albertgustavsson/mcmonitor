export class VarInt {
    static encode(value) {
        let bytes = [];
        do {
            let temp = value & 0x7F;
            value >>>= 7;
            if (value !== 0) {
                temp |= 0x80;
            }
            bytes.push(temp);
        } while (value !== 0);
        return bytes;
    }

    static decode(bytes) {
        let numRead = 0;
        let result = 0;
        let read;
        do {
            if (numRead >= 5) {
                throw new Error('VarInt is too big');
            }
            if (numRead > bytes.length) {
                throw new Error('Given array does not contain valid VarInt');
            }
            read = bytes[numRead];
            if (read & ~0xFF) {
                throw new Error('Byte array contains non-byte element');
            }
            let value = (read & 0x7F);
            result |= (value << (7 * numRead));
            numRead++;
        } while ((read & 0x80) != 0);

        let remainder = bytes.slice(numRead, bytes.length);
        let returnData = { value: result, remainder: remainder };
        return returnData;
    }
}

export class MinecraftPacket {
    constructor(id) {
        this.bytes = [];
        this.writeVarInt(id);
    }

    writeByte(value) {
        if (value & ~0xFF) {
            throw new Error('Value is not a byte');
        }
        this.bytes.push(value);
    }

    writeVarInt(value) {
        this.bytes = this.bytes.concat(VarInt.encode(value));
    }

    writeString(value) {
        let length = value.length;
        this.writeVarInt(length);
        for (let i = 0; i < length; i++) {
            this.writeByte(value.charCodeAt(i));
        }
    }

    writeUShort(value) {
        if (value < 0 || value > 0xFFFF) {
            throw new RangeError('Value is not an unsigned short');
        }
        this.writeByte((value>>>8) & 0xFF);
        this.writeByte(value & 0xFF);
    }

    getBytes() {
        let length = VarInt.encode(this.bytes.length);
        let result = length.concat(this.bytes);
        return result;
    }
};