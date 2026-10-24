import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
async function main(){
 const root='http://127.0.0.1:4000/api/v1';
 const credentials=JSON.parse(await readFile('.secrets/demo-logins.json','utf8'));
 const login=async(name:string)=>{
  const {email,password}=credentials[name];
  const r=await fetch(root+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 };
 assert.equal((await fetch(root+'/me/passport')).status,401);
 assert.equal((await fetch(root+'/admin/passports')).status,401);
 const student=await login('BTU-T-0001'),other=await login('BTU-T-0003'),admin=await login('admin');
 const first=await (await fetch(root+'/me/passport',{headers:{cookie:student}})).json();assert.equal(first.passportId,'BTU-AI-000125');
 const second=await (await fetch(root+'/me/passport',{headers:{cookie:other}})).json();assert.equal(second.passportId,'BTU-AI-000133');
 assert.equal((await fetch(root+'/admin/passports',{headers:{cookie:student}})).status,403);
 const records=await (await fetch(root+'/admin/passports',{headers:{cookie:admin}})).json();assert.equal(records.length,18);
 assert.equal((await fetch(root+'/me/passport/versions/1/download',{headers:{cookie:student}})).status,404);
 assert.equal((await fetch(root+'/admin/sync',{method:'POST',headers:{cookie:admin,Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await fetch(root+'/verify/not-valid')).status,400);
 console.log('PASS real Supabase login, subject binding, distinct student ownership, admin denial, anonymous denial, pending-download denial and CSRF origin checks');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
