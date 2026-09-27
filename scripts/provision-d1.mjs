import {readFile,writeFile} from 'node:fs/promises';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if(!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
const config = JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const name = config.d1_databases[0].database_name;
async function api(path,method='GET',body) {
 const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok || !data.success) throw new Error(`Cloudflare database setup failed (${response.status}). The deployment token needs Account D1 Edit on the existing account, in addition to Pages Edit. ${data.errors?.map(e=>e.message).join('; ') ?? ''}`);
 return data;
}
let database;
for(let page=1;page<=100;page++) {
 const result=await api(`/d1/database?per_page=100&page=${page}`);
 database=result.result.find(db=>db.name===name);
 if(database || result.result.length<100) break;
}
if(!database) database=(await api('/d1/database','POST',{name})).result;
if(!database?.uuid) throw new Error('Cloudflare did not return a database ID.');
config.d1_databases[0].database_id=database.uuid;
await writeFile(new URL('../wrangler.jsonc',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log(`Database ready: ${name}. Wrangler binding DB configured.`);
