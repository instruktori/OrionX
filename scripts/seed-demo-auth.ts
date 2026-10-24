import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {prisma} from '../packages/db/src';
import {supabaseStorageConfig,supabaseAuthConfig} from '../packages/core/src/config';
async function main(){
 if(process.env.APP_ENV!=='demo')throw Error('Demo identities may only be seeded in APP_ENV=demo');
 const config=supabaseStorageConfig(),provider=supabaseAuthConfig().issuer;
 const path='.secrets/demo-logins.json';await mkdir('.secrets',{recursive:true});
 let saved:Record<string,{email:string;password:string;subject:string}>={};try{saved=JSON.parse(await readFile(path,'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 const students=await prisma.student.findMany({where:{externalId:{in:['BTU-T-0001','BTU-T-0003']}}});
 if(students.length!==2)throw Error('Import canonical fixture before seeding authentication');
 const accounts=[{name:'admin',email:'orionx-demo-admin@example.org',studentId:undefined},...students.map(s=>({name:s.externalId,email:s.email,studentId:s.id}))];
 for(const account of accounts){
  if(!saved[account.name]){
   const password=randomBytes(24).toString('base64url');
   const response=await fetch(config.url+'/auth/v1/admin/users',{method:'POST',headers:{...config.headers,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password,email_confirm:true,user_metadata:{orionx_demo:true}})});
   if(!response.ok)throw Error('Unable to create demo authentication identity: HTTP '+response.status);
   const user=await response.json();saved[account.name]={email:account.email,password,subject:user.id};
   await writeFile(path,JSON.stringify(saved,null,2)+'\n',{mode:0o600});
  }
  await prisma.studentIdentity.upsert({where:{provider_subject:{provider,subject:saved[account.name].subject}},create:{provider,subject:saved[account.name].subject,role:account.name==='admin'?'admin':'student',studentId:account.studentId,verifiedBy:'explicit-demo-fixture-seed'},update:{}});
 }
 console.log('Three synthetic demo identities are bound. Credentials saved only in ignored .secrets/demo-logins.json. No emails sent.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
