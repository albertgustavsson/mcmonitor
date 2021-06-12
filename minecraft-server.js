import net from 'net';
import { getTimeOfDay } from './utils.js';
import { MinecraftPacket, VarInt } from './protocol.js';

export class MinecraftServer {
    constructor(host, port) {
        this.host = host;
        this.port = port;
    }

    getStatus() {
        return new Promise((resolve, reject) => {
            let data = new Uint8Array();
            let packetLength = undefined;

            let connection = net.createConnection({
                host: this.host,
                port: this.port,
            });
            
            connection.on('error', (error) => {
                // console.log(`${getTimeOfDay()} ${error}`);
                reject(error);
            });
            
            connection.on('close', () => {
                // console.log(`${getTimeOfDay()} connection closing`);
            });

            connection.on('connect', () => {      
                // console.log(`${getTimeOfDay()} connection established`);
                let handshakePacket = new MinecraftPacket(0);
                handshakePacket.writeVarInt(-1);
                handshakePacket.writeString(this.host);
                handshakePacket.writeUShort(this.port);
                handshakePacket.writeVarInt(1);
                connection.write(Buffer.from(handshakePacket.getBytes()));

                let requestPacket = new MinecraftPacket(0);
                connection.write(Buffer.from(requestPacket.getBytes()));
            });
            
            connection.on('data', (d) => {
                // console.log(`${getTimeOfDay()} data received (${d.length} bytes)`);
                
                // Concatenate the received data
                let newData = new Uint8Array(data.length + d.length);
                newData.set(data);
                newData.set(d, data.length);
                data = newData;
                
                if (packetLength === undefined) {
                    try {
                        let decoded = VarInt.decode(data);
                        // console.log(`Read packet length: ${decoded.value}`);
                        if (decoded.value && decoded.remainder) {
                            packetLength = decoded.value;
                            data = decoded.remainder;
                        }
                    } catch (e) {
                        console.log(`${getTimeOfDay()} Failed to read packet length`);
                        console.log(e);
                    }
                }
                if (packetLength && data.length === packetLength) {
                    // console.log(`${getTimeOfDay()} Packet received. Closing connection`);
                    connection.destroy();
                    let decoded = VarInt.decode(data);
                    if (decoded.value !== 0) {
                        throw new Error(`Expected packet id 0, received ${decoded.value}`);
                    }
                    decoded = VarInt.decode(decoded.remainder);
                    if (decoded.value !== decoded.remainder.length) {
                        throw new Error(`String length mismatch: expected ${decoded.value}, found ${decoded.remainder.length}`);
                    }
                    let jsonData = JSON.parse(new TextDecoder().decode(decoded.remainder));
                    resolve(jsonData);
                } else {
                    // console.log(`${getTimeOfDay()} Still waiting for more data. ${data.length} / ${packetLength}`);
                }
            });
        });
    }
}