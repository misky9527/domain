import fetch from 'node-fetch';

interface DnsRecord {
  name: string;
  type: number | string;
  TTL: number;
  data: string;
}

const DNS_TYPE_MAP: Record<number, string> = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT',
  28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

/**
 * Map NS server root domains to Chinese DNS provider names.
 */
const DNS_PROVIDER_MAP: Record<string, string> = {
  'aliyun.com': '阿里云 DNS',
  'alibabadns.com': '阿里云 DNS',
  'hichina.com': '阿里云 DNS (万网)',
  'dnspod.com': 'DNSPod (腾讯云)',
  'dnspod.net': 'DNSPod (腾讯云)',
  'tencent-cloud.com': '腾讯云 DNS',
  'huaweicloud.com': '华为云 DNS',
  'huawei.com': '华为 DNS',
  'cloudflare.com': 'Cloudflare',
  'awsdns.co.uk': 'AWS Route53',
  'awsdns.com': 'AWS Route53',
  'awsdns.net': 'AWS Route53',
  'awsdns.org': 'AWS Route53',
  'googledomains.com': 'Google Domains',
  'google.com': 'Google DNS',
  'namecheap.com': 'Namecheap',
  'namecheaphosting.com': 'Namecheap',
  'godaddy.com': 'GoDaddy',
  'nsone.net': 'NS1',
  'dns.com': 'DNS.COM',
  'dns-dns.com': 'DNS.COM',
  'myhostadmin.net': '新网',
  'xinnet.com': '新网',
  'xinnetdns.com': '新网',
  'west.cn': '西部数码',
  'westdns.com': '西部数码',
  'dnspai.com': 'DNS派',
  'dnsv5.com': 'DNS.LA',
  'dns.la': 'DNS.LA',
  'cloudns.net': 'ClouDNS',
  'he.net': 'Hurricane Electric',
  'akamai.net': 'Akamai',
  'akamaiedge.net': 'Akamai',
  'edgekey.net': 'Akamai',
  'fastly.net': 'Fastly',
  'cdn77.net': 'CDN77',
  'stackpathdns.com': 'StackPath',
  'ultradns.com': 'UltraDNS',
  'ultradns.net': 'UltraDNS',
  'dyn.com': 'Dyn DNS',
  'dynect.net': 'Dyn DNS',
  'dnsmadeeasy.com': 'DNS Made Easy',
  'constellix.com': 'Constellix',
  'ns14.net': '域名城 DNS',
  'xundns.com': '讯DNS',
  'shjdns.com': '上海DNS',
  '4cun.com': '4cun DNS',
  'bodis.com': 'Bodis',
  'parkingcrew.net': 'ParkingCrew',
  'sedoparking.com': 'Sedo',
  'above.com': 'Above.com',
};

function getDnsProviderFromMap(nsHost: string): string | null {
  const host = nsHost.replace(/\.$/, '').toLowerCase();
  // Try exact match first, then subdomain match
  for (const [domain, provider] of Object.entries(DNS_PROVIDER_MAP)) {
    if (host.endsWith('.' + domain) || host === domain) {
      return provider;
    }
  }
  return null;
}

let _getDb: (() => any) | null = null;
export function setDbGetter(getter: () => any) {
  _getDb = getter;
}

function getDnsProvider(nsHost: string): string | null {
  // 1. Check built-in map first
  const builtin = getDnsProviderFromMap(nsHost);
  if (builtin) return builtin;

  // 2. Fallback to DB custom mappings
  if (_getDb) {
    try {
      const db = _getDb();
      if (db) {
        const host = nsHost.replace(/\.$/, '').toLowerCase();
        // Match: nsHost ends with stored domain
        const rows = db.prepare('SELECT domain, name FROM dns_providers').all() as any[];
        for (const row of rows) {
          const pattern = row.domain.replace(/\.$/, '').toLowerCase();
          if (host.endsWith('.' + pattern) || host === pattern) {
            return row.name;
          }
        }
      }
    } catch {
      // DB not available or table doesn't exist yet
    }
  }

  return null;
}

/**
 * Extract NS record info from DNS records.
 */
export function extractNsInfo(records: DnsRecord[]): { server: string; provider: string | null } | null {
  const nsRecords = records.filter(r => r.type === 'NS' || r.type === 2);
  if (nsRecords.length === 0) return null;
  // Join all NS records, use first one for provider lookup
  const servers = nsRecords.map(ns => ns.data.replace(/\.$/, '').toLowerCase());
  const server = servers.join(', ');
  const provider = getDnsProvider(servers[0]);
  return { server, provider };
}

export async function queryDnsRecords(domain: string): Promise<DnsRecord[]> {
  const url = `https://dns.google/resolve?name=${domain}&type=ANY`;
  const res = await fetch(url, { timeout: 10000 });

  if (!res.ok) {
    throw new Error(`DNS 查询失败: ${res.status}`);
  }

  const data = await res.json() as any;
  if (!data.Answer) {
    return [];
  }

  return data.Answer.map((r: any) => ({
    name: r.name,
    type: DNS_TYPE_MAP[r.type] || r.type,
    TTL: r.TTL,
    data: r.data,
  }));
}

/**
 * Query only NS records for a domain (lighter weight).
 */
export async function queryNsRecords(domain: string): Promise<DnsRecord[]> {
  const url = `https://dns.google/resolve?name=${domain}&type=NS`;
  const res = await fetch(url, { timeout: 10000 });

  if (!res.ok) return [];

  const data = await res.json() as any;
  if (!data.Answer) return [];

  return data.Answer.map((r: any) => ({
    name: r.name,
    type: DNS_TYPE_MAP[r.type] || r.type,
    TTL: r.TTL,
    data: r.data,
  }));
}
