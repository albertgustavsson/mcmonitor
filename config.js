import { readFileSync, writeFileSync } from 'fs';

export function readConfig() {
    let fileString = readFileSync('config.json', {encoding: 'utf8'});
    // console.log(`JSON string from file: ${fileString}`);
    let config = JSON.parse(fileString);
    const entries = Object.entries(config.channelSettings);
    config.channelSettings = new Map(entries);
    // console.log(config);
    return config;
}

export function writeConfig(config) {
    if (config) {
        // console.log(config);
        if (config.channelSettings) {
            config.channelSettings = Object.fromEntries(config.channelSettings);
        }
        let jsonString = JSON.stringify(config);
        // console.log(`JSON string from config: ${jsonString}`);
        writeFileSync('config.json', jsonString, {encoding: 'utf8'});
    }
}