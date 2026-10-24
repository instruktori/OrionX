import {DEVNET_GENESIS} from './protocol';
export function clusterPolicy(){
 const rpc=process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com';
 if(process.env.CHAIN_MODE==='local'){
  const url=new URL(rpc);
  if(process.env.APP_ENV!=='test'||process.env.NODE_ENV!=='test'||process.env.VERCEL||!['127.0.0.1','localhost'].includes(url.hostname)||url.protocol!=='http:'||!process.env.SOLANA_EXPECTED_GENESIS_HASH)throw Error('Local chain is restricted to isolated loopback tests');
  return {rpc,genesisHash:process.env.SOLANA_EXPECTED_GENESIS_HASH,cluster:'local-validator'};
 }
 if(process.env.SOLANA_EXPECTED_GENESIS_HASH!==DEVNET_GENESIS)throw Error('Wrong configured cluster');
 return {rpc,genesisHash:DEVNET_GENESIS,cluster:'devnet'};
}
