interface DnsRecord {
    name: string;
    type: number;
    TTL: number;
    data: string;
}
export declare function queryDnsRecords(domain: string): Promise<DnsRecord[]>;
export {};
//# sourceMappingURL=dns.d.ts.map