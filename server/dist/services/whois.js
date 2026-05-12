"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryWhois = queryWhois;
exports.queryBatchWhois = queryBatchWhois;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function queryWhois(domain) {
    const url = `https://www.rdap.net/domain/${domain}`;
    const res = await (0, node_fetch_1.default)(url, { timeout: 10000 });
    if (!res.ok) {
        throw new Error(`RDAP 查询失败: ${res.status}`);
    }
    const data = await res.json();
    const result = {
        registrar: '',
        registration_date: '',
        expiration_date: '',
    };
    // Extract registrar
    if (data.entities && data.entities.length > 0) {
        const registrarEntity = data.entities.find((e) => e.roles && e.roles.includes('registrar'));
        if (registrarEntity && registrarEntity.vcardArray) {
            const vcard = registrarEntity.vcardArray[1];
            const fnEntry = vcard.find((v) => v[0] === 'fn');
            if (fnEntry)
                result.registrar = fnEntry[3];
        }
    }
    // Extract dates from events
    if (data.events) {
        for (const event of data.events) {
            if (event.eventAction === 'registration') {
                result.registration_date = event.eventDate;
            }
            if (event.eventAction === 'expiration') {
                result.expiration_date = event.eventDate;
            }
        }
    }
    return result;
}
async function queryBatchWhois(domains) {
    const results = [];
    const tasks = domains.map(d => () => queryWhois(d).then(info => ({ domain: d, info })).catch((err) => ({ domain: d, info: { registrar: '', registration_date: '', expiration_date: '' }, error: err.message })));
    // Run with concurrency limit of 5
    const executing = new Set();
    for (const task of tasks) {
        const p = task().then(r => { results.push(r); }).finally(() => executing.delete(p));
        executing.add(p);
        if (executing.size >= 5) {
            await Promise.race(executing);
        }
    }
    await Promise.allSettled(executing);
    return results;
}
//# sourceMappingURL=whois.js.map