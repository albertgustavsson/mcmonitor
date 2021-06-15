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
            if (e.code === 'ETIMEDOUT') {
                channel.send('Server did not respond.');
            } else if (e.code) {
                channel.send(`Failed to check server status (error code: ${e.code})`);
            } else {
                channel.send('Failed to check server status');
            }
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

    // client.on('voiceStateUpdate', (oldState, newState) => {
    //     const memberName = oldState.member.user.username;
    //     if (!oldState.channelID && newState.channelID) {
    //         console.log(`${memberName} joined ${newState.channel.name}`);
    //     } else if (oldState.channelID && newState.channelID && oldState.channelID !== newState.channelID) {
    //         console.log(`${memberName} moved from ${oldState.channel.name} to ${newState.channel.name}`);
    //     } else if (oldState.channelID && !newState.channelID) {
    //         console.log(`${memberName} left ${oldState.channel.name}`);
    //     }
    // });
    
    client.login(process.env.DISCORD_TOKEN).catch((e) => {
        console.error('Failed to login');
        console.error(e);
    });
}

function shutDown(config) {
    for (let value of config.channelSettings.values()) {
        clearInterval(value.updateTimerID);
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
    if (!config.channelSettings.has(msg.channel.id)) {
        config.channelSettings.set(msg.channel.id, { prefix: config.defaultPrefix });
    }

    let channelSettings = config.channelSettings.get(msg.channel.id);
    if (!msg.content.startsWith(channelSettings.prefix)) {
        return;
    }
    const commands = msg.content.slice(channelSettings.prefix.length).split(' ');
    console.log(`Received command in ${msg.guild.name}, ${msg.channel.name}: ${commands[0]}`);
    if (commands[0] === 'mcmonitor-prefix') {
        if (commands.length !== 2) {
            msg.channel.send(`Usage: \`${channelSettings.prefix}mcmonitor-prefix <prefix>\``);
        } else {
            channelSettings.prefix = commands[1];
            msg.channel.send(`Set the prefix to ${channelSettings.prefix}.`);
        }
    } else if (commands[0] === 'ping') {
        msg.channel.send('pong');
    } else if (commands[0] === 'help') {
        const helpMessage = `Available commands:\n`+
            `\`${channelSettings.prefix}help\` - shows the available commands\n`+
            `\`${channelSettings.prefix}ping\` - makes the bot respond with \'pong\'\n`+
            `\`${channelSettings.prefix}mcmonitor-prefix <prefix>\` - sets a new prefix for commands in this channel\n`+
            `\`${channelSettings.prefix}mcs <hostname> <port>\` - sets up the Minecraft server for this channel\n`+
            `\`${channelSettings.prefix}mc\` - checks the current status of the Minecraft server\n`+
            `\`${channelSettings.prefix}mct <interval>\` - checks the status of the Minecraft server every \`interval\` minutes`;
        msg.channel.send(helpMessage);
    } else if (commands[0] === 'mcs') {
        if (commands.length !== 3) {
            msg.channel.send(`Usage: \`${channelSettings.prefix}mcs <hostname> <port>\``);
        } else {
            channelSettings.mchost = commands[1];
            channelSettings.mcport = commands[2];
            channelSettings.mcserver = new MinecraftServer(channelSettings.mchost, channelSettings.mcport);
        }
    } else if (commands[0] === 'mc') {
        if (!channelSettings.mcserver) {
            msg.channel.send('Server not set up. Run `!mcs` to set up');
        } else {
            let server = channelSettings.mcserver;
            msg.channel.send(`Checking minecraft server (${server.host}:${server.port})`);
            createStatusMessage(server).then((message) => {
                msg.channel.send(message);
            }).catch((e)=>{
                console.error(e);
                if (e.code === 'ETIMEDOUT') {
                    msg.channel.send('Server did not respond.');
                } else if (e.code) {
                    msg.channel.send(`Failed to check server status (error code: ${e.code})`);
                } else {
                    msg.channel.send('Failed to check server status');
                }
            });
        }
    } else if (commands[0] === 'mct') {
        if (!channelSettings.mcserver) {
            msg.channel.send('Server not set up');
        } else {
            const interval = commands[1];
            clearInterval(channelSettings.updateTimerID);
            if (interval === 0 || interval === '0') {
                msg.channel.send('I will no longer check the server status periodically');
                delete channelSettings.updateInterval;
                delete channelSettings.updateTimerID;
            } else {
                msg.channel.send(`I will check the server status every ${interval} minutes`);
                channelSettings.updateInterval = interval;
                channelSettings.updateTimerID = createInterval(channelSettings.mcserver, msg.channel, interval);
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