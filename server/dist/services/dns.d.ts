interface DnsRecord {
    name: string;
    type: number | string;
    TTL: number;
    data: string;
}
export declare const DNS_TYPE_MAP: Record<number, string>;
export declare function setDbGetter(getter: () => any): void;
/**
 * Extract NS record info from DNS records.
 */
export declare function extractNsInfo(records: DnsRecord[]): {
    server: string;
    provider: string | null;
} | null;
export declare function queryDnsRecords(domain: string): Promise<DnsRecord[]>;
/**
 * Query only NS records for a domain (lighter weight).
 */
export declare function queryNsRecords(domain: string): Promise<DnsRecord[]>;
export {};
//# sourceMappingURL=dns.d.ts.map