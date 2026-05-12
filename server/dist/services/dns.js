"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryDnsRecords = queryDnsRecords;
const node_fetch_1 = __importDefault(require("node-fetch"));
const DNS_TYPE_MAP = {
    1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT',
    28: 'AAAA', 33: 'SRV', 257: 'CAA',
};
async function queryDnsRecords(domain) {
    const url = `https://dns.google/resolve?name=${domain}&type=ANY`;
    const res = await (0, node_fetch_1.default)(url, { timeout: 10000 });
    if (!res.ok) {
        throw new Error(`DNS 查询失败: ${res.status}`);
    }
    const data = await res.json();
    if (!data.Answer) {
        return [];
    }
    return data.Answer.map((r) => ({
        name: r.name,
        type: DNS_TYPE_MAP[r.type] || r.type,
        TTL: r.TTL,
        data: r.data,
    }));
}
//# sourceMappingURL=dns.js.map