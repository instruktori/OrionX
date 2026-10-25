import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {supabaseStorageConfig} from '../packages/core/src/config';
async function main(){
 const origin=process.env.API_TEST_ORIGIN||process.env.VERIFICATION_PUBLIC_ORIGIN||'http://127.0.0.1:4000';
 const root=origin+'/api/v1';
 const config=supabaseStorageConfig();
 const credentials=JSON.parse(await readFile('.secrets/demo-logins.json','utf8'));
 const sessionCookie=async(name:string)=>{
  const {email,password}=credentials[name];
  // Verify password login on the OrionX API is disabled in favor of Google OAuth:
  const disabled=await fetch(root+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email,password})});
  assert.equal(disabled.status,403);
  // Obtain a real signed Supabase JWT for this bound demo subject to exercise API cookie/refresh/RBAC routes:
  const r=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.headers.apikey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  assert.equal(r.status,200);
  const s=await r.json();
  return `orionx_access=${s.access_token}; orionx_refresh=${s.refresh_token}`;
 };
 const googleInit=await fetch(root+'/auth/google',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({next:'/passport'})});
 assert.equal(googleInit.status,200);
 assert.equal((await googleInit.json()).provider,'google');
 assert.equal((await fetch(root+'/me/passport')).status,401);
 assert.equal((await fetch(root+'/admin/passports')).status,401);
 const student=await sessionCookie('BTU-T-0001'),other=await sessionCookie('BTU-T-0003'),admin=await sessionCookie('admin');
 const studentSession=await (await fetch(root+'/auth/session',{headers:{cookie:student}})).json();
 assert.equal(studentSession.authenticated,true);assert.equal(studentSession.authorized,true);assert.equal(studentSession.role,'student');
 const refreshed=await fetch(root+'/auth/refresh',{method:'POST',headers:{cookie:student,Origin:origin}});
 assert.equal(refreshed.status,200);
 const first=await (await fetch(root+'/me/passport',{headers:{cookie:student}})).json();assert.equal(first.passportId,'BTU-AI-000125');
 const second=await (await fetch(root+'/me/passport',{headers:{cookie:other}})).json();assert.equal(second.passportId,'BTU-AI-000133');
 assert.equal((await fetch(root+'/admin/passports',{headers:{cookie:student}})).status,403);
 const records=await (await fetch(root+'/admin/passports',{headers:{cookie:admin}})).json();assert.equal(records.length,18);
 const download=await fetch(root+'/me/passport/versions/1/download',{headers:{cookie:student}});
 assert.equal(download.status,first.latest?200:404);
 if(first.latest)assert.match(download.headers.get('content-type')||'',/application\/pdf/);
 assert.equal((await fetch(root+'/admin/sync',{method:'POST',headers:{cookie:admin,Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await fetch(root+'/verify/not-valid')).status,400);
 console.log('PASS Google OAuth initiation, password-login disablement, real Supabase JWT verification, refresh, subject binding, distinct student ownership, admin/anonymous denial, download authorization and CSRF origin checks');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
