import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url);
async function walk(dir){const out=[];for(const item of await readdir(dir,{withFileTypes:true})) {const p=join(dir,item.name);if(item.isDirectory())out.push(...await walk(p));else if(item.name.endsWith('.html'))out.push(p);}return out;}
const files=await walk(root.pathname);let checked=0;
for(const file of files){
 const html=await readFile(file,'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,`Duplicate IDs: ${file}`);
 for(const [,href] of html.matchAll(/\bhref="([^"\s]+)"/g)) {
  if(!href.startsWith('/')&&!href.startsWith('#'))continue;
  const url=new URL(href,`https://recipes.chriswiki.com/${file.slice(root.pathname.length).replace(/index\.html$/,'')}`);
  const target=url.pathname.endsWith('/') ? join(root.pathname,url.pathname,'index.html') : join(root.pathname,url.pathname);
  const content=await readFile(target,'utf8').catch(()=>{throw new Error(`Broken link ${href} in ${file}`)});
  if(url.hash)assert.ok(content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`Broken fragment ${href} in ${file}`);
  checked++;
 }
}
console.log(`Verified ${checked} generated internal links and fragment targets across ${files.length} HTML pages.`);
