interface WhoisInfo {
    registrar: string;
    registration_date: string;
    expiration_date: string;
}
export declare function queryWhois(domain: string): Promise<WhoisInfo>;
export declare function queryBatchWhois(domains: string[]): Promise<Array<{
    domain: string;
    info: WhoisInfo;
    error?: string;
}>>;
export {};
//# sourceMappingURL=whois.d.ts.map