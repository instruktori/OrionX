import {Connection,Keypair,PublicKey,SystemProgram,Transaction,TransactionInstruction,sendAndConfirmTransaction} from '@solana/web3.js';
import {readFile} from 'node:fs/promises';
import {DEVNET_GENESIS,configAddress,epochAddress,discriminator,parseConfig} from '../packages/core/src/protocol';
async function main(){
 const [action,nextPath]=process.argv.slice(2);if(!['pause','resume','rotate'].includes(action))throw Error('Usage: issuer:admin pause|resume|rotate [approved-new-keypair-file]');
 const connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com','finalized');if(await connection.getGenesisHash()!==DEVNET_GENESIS)throw Error('Devnet only');
 if(!process.env.SOLANA_PROGRAM_ID||!process.env.SOLANA_ADMIN_KEYPAIR_PATH)throw Error('Configure SOLANA_PROGRAM_ID and operator-only SOLANA_ADMIN_KEYPAIR_PATH');
 const load=async(path:string)=>Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path,'utf8'))));
 const admin=await load(process.env.SOLANA_ADMIN_KEYPAIR_PATH),program=new PublicKey(process.env.SOLANA_PROGRAM_ID),config=configAddress(program)[0];
 const info=await connection.getAccountInfo(config);if(!info?.owner.equals(program))throw Error('Issuer configuration unavailable');const state=parseConfig(info.data);if(!state.admin.equals(admin.publicKey))throw Error('Unauthorized config administrator');
 const tx=new Transaction(),signers=[admin];
 if(action==='rotate'){
  if(!nextPath)throw Error('New approved issuer must co-sign rotation');const next=await load(nextPath);signers.push(next);
  tx.add(new TransactionInstruction({programId:program,keys:[{pubkey:admin.publicKey,isSigner:true,isWritable:true},{pubkey:next.publicKey,isSigner:true,isWritable:false},{pubkey:config,isSigner:false,isWritable:true},{pubkey:epochAddress(program,config,state.epoch+1)[0],isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data:Buffer.concat([discriminator('global','rotate_issuer'),Buffer.alloc(32)])}));
 }else tx.add(new TransactionInstruction({programId:program,keys:[{pubkey:admin.publicKey,isSigner:true,isWritable:false},{pubkey:config,isSigner:false,isWritable:true}],data:Buffer.concat([discriminator('global','set_paused'),Buffer.from([action==='pause'?1:0])])}));
 console.log(JSON.stringify({cluster:'devnet',action,signature:await sendAndConfirmTransaction(connection,tx,signers,{commitment:'finalized'})}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
