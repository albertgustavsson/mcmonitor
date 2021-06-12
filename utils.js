export function getTimeOfDay() {
    const date = new Date();
    const h = date.getHours();
    const ph = h<10?('0'+h):h;
    const m = date.getMinutes();
    const pm = m<10?('0'+m):m;
    const s = date.getSeconds();
    const ps = s<10?('0'+s):s;
    const ms = date.getMilliseconds();
    const pms = ms<10?('00'+ms):(ms<100?('0'+ms):ms);
    return `${ph}:${pm}:${ps}.${pms}`;
}