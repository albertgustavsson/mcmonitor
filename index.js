import dotenv from 'dotenv';
import Discord from 'discord.js';
import { MinecraftServer } from './minecraft-server.js';
import { readConfig, writeConfig } from './config.js';
import { getTimeOfDay } from './utils.js';
dotenv.config();

function createInterval(server, channel, interval) {
    return setInterval(() => {
        createStatusMessage(server).then((message) => {
            channel.send(message);
        }).catch((e)=>{
            console.error(e);
            channel.send('Failed to check server status');
        });
    }, interval * 60*1000);
}

let config;
let client;
startUp();

function startUp() {
    config = readConfig();
    console.log(config);

    client = new Discord.Client();

    client.on('ready', () => {
        client.user.setActivity({name:'Minecraft',type:'PLAYING'});
        console.log(`${getTimeOfDay()} Logged in as ${client.user.tag}!`);
        
        for (let [key, value] of config.channelSettings) {
            value.channel = client.channels.resolve(key);
            if (!value.channel) {
                console.log(`Couldn't find channel ${key}. Removing it from config.`);
                config.channelSettings.delete(key);
                continue;
            }
            // value.channel.send('Im here now!');
            if (value.mchost && value.mcport) {
                value.mcserver = new MinecraftServer(value.mchost, value.mcport);
                if (value.updateInterval) {
                    console.log(`${getTimeOfDay()} Updating automatically every ${value.updateInterval} minutes in ${value.channel.name}!`);
                    value.updateTimerID = createInterval(value.mcserver, value.channel, value.updateInterval);
                }
            }
        }
    });
    
    client.on('message', handleMessage);

    client.on('voiceStateUpdate', (oldState, newState) => {
        const memberName = oldState.member.user.username;
        if (!oldState.channelID && newState.channelID) {
            console.log(`${memberName} joined ${newState.channel.name}`);
        } else if (oldState.channelID && newState.channelID && oldState.channelID !== newState.channelID) {
            console.log(`${memberName} moved from ${oldState.channel.name} to ${newState.channel.name}`);
        } else if (oldState.channelID && !newState.channelID) {
            console.log(`${memberName} left ${oldState.channel.name}`);
        }
    });
    
    client.login(process.env.DISCORD_TOKEN).catch((e) => {
        console.error('Failed to login');
        console.error(e);
    });
}

function shutDown(config) {
    for (let value of config.channelSettings.values()) {
        if (value.updateTimerID) {
            clearInterval(value.updateTimerID);
        }
        delete value.updateTimerID;
        delete value.mcserver;
        delete value.channel;
    }
    client.destroy();
    writeConfig(config);
}

function createStatusMessage(server) {
    return new Promise((resolve, reject) => {
        server.getStatus().then((data) => {
            resolve(`Server (${server.host}) is online. ${data.players.online}/${data.players.max} players`);
        }).catch((e)=>{
            reject(e);
        });
    });
}

function handleMessage(msg) {
    if (!msg.content.startsWith(config.prefix)) {
        return;
    }
    const commands = msg.content.slice(1).split(' ');
    console.log(`Received command in ${msg.guild.name}, ${msg.channel.name}: ${commands[0]}`);
    if (commands[0] === 'ping') {
        msg.channel.send('pong');
    } else if (commands[0] === 'mcs') {
        if (commands.length !== 3) {
            msg.channel.send(`Usage: \`${config.prefix}mcs <hostname> <port>\``);
        } else {
            let host = commands[1];
            let port = commands[2];
            if (!config.channelSettings.has(msg.channel.id)) {
                config.channelSettings.set(msg.channel.id, {});
            }
            config.channelSettings.get(msg.channel.id).mchost = host;
            config.channelSettings.get(msg.channel.id).mcport = port;
            config.channelSettings.get(msg.channel.id).mcserver = new MinecraftServer(host, port);
        }
    } else if (commands[0] === 'mc') {
        if (!config.channelSettings.has(msg.channel.id)) {
            config.channelSettings.set(msg.channel.id, {});
        }
        if (!config.channelSettings.get(msg.channel.id).mcserver) {
            msg.channel.send('Server not set up. Run `!mcs` to set up');
        } else {
            let server = config.channelSettings.get(msg.channel.id).mcserver;
            msg.channel.send(`Checking minecraft server (${server.host}:${server.port})`);
            createStatusMessage(server).then((message) => {
                msg.channel.send(message);
            }).catch((e)=>{
                console.error(e);
                msg.channel.send('Failed to check server status');
            });
        }
    } else if (commands[0] === 'mct') {
        if (!config.channelSettings.has(msg.channel.id)) {
            config.channelSettings.set(msg.channel.id, {});
        }
        if (!config.channelSettings.get(msg.channel.id).mcserver) {
            msg.channel.send('Server not set up');
        } else {
            const interval = commands[1];
            clearInterval(config.channelSettings.get(msg.channel.id).updateTimerID);
            if (interval === 0 || interval === '0') {
                msg.channel.send('I will no longer check the server status periodically');
                delete config.channelSettings.get(msg.channel.id).updateInterval;
                delete config.channelSettings.get(msg.channel.id).updateTimerID;
            } else {
                msg.channel.send(`I will check the server status every ${interval} minutes`);
                config.channelSettings.get(msg.channel.id).updateInterval = interval;
                config.channelSettings.get(msg.channel.id).updateTimerID = createInterval(
                        config.channelSettings.get(msg.channel.id).mcserver,
                        msg.channel,
                        interval);
            }
        }
    }
}

process.on('exit', () => {
    console.log('exit');
    shutDown(config);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT');
    process.exit();
});