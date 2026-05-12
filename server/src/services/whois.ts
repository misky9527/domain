import fetch from 'node-fetch';

interface WhoisInfo {
  registrar: string;
  registration_date: string;
  expiration_date: string;
}

export async function queryWhois(domain: string): Promise<WhoisInfo> {
  const url = `https://www.rdap.net/domain/${domain}`;
  const res = await fetch(url, { timeout: 10000 });
  
  if (!res.ok) {
    throw new Error(`RDAP 查询失败: ${res.status}`);
  }

  const data = await res.json() as any;
  
  const result: WhoisInfo = {
    registrar: '',
    registration_date: '',
    expiration_date: '',
  };

  // Extract registrar
  if (data.entities && data.entities.length > 0) {
    const registrarEntity = data.entities.find((e: any) => 
      e.roles && e.roles.includes('registrar')
    );
    if (registrarEntity && registrarEntity.vcardArray) {
      const vcard = registrarEntity.vcardArray[1];
      const fnEntry = vcard.find((v: any) => v[0] === 'fn');
      if (fnEntry) result.registrar = fnEntry[3];
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

export async function queryBatchWhois(domains: string[]): Promise<Array<{ domain: string; info: WhoisInfo; error?: string }>> {
  const results: Array<{ domain: string; info: WhoisInfo; error?: string }> = [];
  const tasks = domains.map(d => () =>
    queryWhois(d).then(info => ({ domain: d, info })).catch((err: any) =>
      ({ domain: d, info: { registrar: '', registration_date: '', expiration_date: '' }, error: err.message })
    )
  );

  // Run with concurrency limit of 5
  const executing = new Set<Promise<void>>();
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
