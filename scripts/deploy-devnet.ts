import {Connection,Keypair,LAMPORTS_PER_SOL,PublicKey,SystemProgram,Transaction,TransactionInstruction,sendAndConfirmTransaction} from '@solana/web3.js';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DEVNET_GENESIS,configAddress,epochAddress,discriminator,parseConfig} from '../packages/core/src/protocol';
import {sha256} from '../packages/core/src';
async function main(){
 const rpc=process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com',connection=new Connection(rpc,'finalized');
 if(await connection.getGenesisHash()!==DEVNET_GENESIS)throw Error('Deployment is restricted to Solana Devnet');
 const load=async(name:string)=>Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(resolve('.secrets',name+'.json'),'utf8'))));
 const program=await load('program'),admin=await load('admin'),issuer=await load('issuer');
 await mkdir('.secrets',{recursive:true});if(!existsSync('.secrets/upgrade.json'))await writeFile('.secrets/upgrade.json',JSON.stringify(Array.from(Keypair.generate().secretKey)),{mode:0o600});const upgrade=await load('upgrade');
 const source=await readFile('programs/passport-registry/src/lib.rs','utf8');
 if(!source.includes('declare_id!("'+program.publicKey.toBase58()+'")')||!source.includes(admin.publicKey.toBase58()))throw Error('Program ID/bootstrap authority must match the reviewed compiled source');
 const binary=await readFile('target/deploy/passport_registry.so');const rent=await connection.getMinimumBalanceForRentExemption(binary.length+45);
 if(!(await connection.getAccountInfo(program.publicKey))?.executable){
  const balance=await connection.getBalance(admin.publicKey);
  if(balance<2*rent+.05*LAMPORTS_PER_SOL)throw Error('Fund deployment wallet '+admin.publicKey.toBase58()+' with free Devnet SOL. Current balance: '+balance/LAMPORTS_PER_SOL+' SOL; estimated initial deployment budget: '+((2*rent)/LAMPORTS_PER_SOL+.05).toFixed(3)+' Devnet SOL');
  const executable=process.env.SOLANA_CLI||(existsSync(resolve(homedir(),'.local/share/solana/install/active_release/bin/solana'))?resolve(homedir(),'.local/share/solana/install/active_release/bin/solana'):'solana');
  const result=spawnSync(executable,['program','deploy','--url',rpc,'--keypair',resolve('.secrets/admin.json'),'--program-id',resolve('.secrets/program.json'),'--upgrade-authority',resolve('.secrets/upgrade.json'),'--max-len',String(binary.length),'--use-rpc','--output','json','target/deploy/passport_registry.so'],{encoding:'utf8',maxBuffer:8*1024*1024});
  await writeFile('.secrets/deployment.log',result.stdout+'\n'+result.stderr,{mode:0o600});
  if(result.status!==0)throw Error('Deployment failed; private diagnostics saved in ignored .secrets/deployment.log');
 }
 if(await connection.getBalance(issuer.publicKey)<.1*LAMPORTS_PER_SOL)await sendAndConfirmTransaction(connection,new Transaction().add(SystemProgram.transfer({fromPubkey:admin.publicKey,toPubkey:issuer.publicKey,lamports:.2*LAMPORTS_PER_SOL})),[admin],{commitment:'finalized'});
 const config=configAddress(program.publicKey)[0],current=await connection.getAccountInfo(config);let initializationSignature:string|null=null;
 if(!current)initializationSignature=await sendAndConfirmTransaction(connection,new Transaction().add(new TransactionInstruction({programId:program.publicKey,keys:[{pubkey:admin.publicKey,isSigner:true,isWritable:true},{pubkey:config,isSigner:false,isWritable:true},{pubkey:epochAddress(program.publicKey,config,1)[0],isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data:Buffer.concat([discriminator('global','initialize_issuer'),issuer.publicKey.toBuffer(),Buffer.alloc(32)])})),[admin],{commitment:'finalized'});
 else if(!current.owner.equals(program.publicKey)||!parseConfig(current.data).issuer.equals(issuer.publicKey))throw Error('Existing issuer configuration does not match this deployment');
 const path='.env.development.local';let env=await readFile(path,'utf8').catch(()=>'');
 const values={SOLANA_PROGRAM_ID:program.publicKey.toBase58(),SOLANA_EXPECTED_GENESIS_HASH:DEVNET_GENESIS,SOLANA_ISSUER_KEYPAIR_PATH:resolve('.secrets/issuer.json'),CHAIN_MODE:'devnet',ISSUER_TRUST_MODE:'DEMO'};
 for(const[key,value]of Object.entries(values)){const pattern=new RegExp('^'+key+'=.*$','m');env=pattern.test(env)?env.replace(pattern,key+'='+value):env+'\n'+key+'='+value+'\n'}await writeFile(path,env,{mode:0o600});
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/devnet-deployment.json',JSON.stringify({cluster:'devnet',genesisHash:DEVNET_GENESIS,programId:program.publicKey.toBase58(),configPda:config.toBase58(),admin:admin.publicKey.toBase58(),issuer:issuer.publicKey.toBase58(),upgradeAuthority:upgrade.publicKey.toBase58(),binarySha256:sha256(binary),initializationSignature,officialBtu:false,issuerMode:'SIMULATED_BTU',checkedAt:new Date().toISOString()},null,2)+'\n');
 console.log('Deployed and initialized simulated BTU issuer on Solana Devnet. Public evidence: docs/evidence/devnet-deployment.json');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
