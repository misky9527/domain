import fetch from 'node-fetch';

interface DnsRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

const DNS_TYPE_MAP: Record<number, string> = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT',
  28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

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
