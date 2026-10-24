import {afterEach,expect,it,vi} from 'vitest';
import {clusterPolicy} from './cluster';
import {DEVNET_GENESIS} from './protocol';
afterEach(()=>vi.unstubAllEnvs());
it('pins production to Devnet even if an arbitrary expected genesis is configured',()=>{
 vi.stubEnv('CHAIN_MODE','devnet');vi.stubEnv('SOLANA_EXPECTED_GENESIS_HASH','mainnet-or-attacker');expect(()=>clusterPolicy()).toThrow('Wrong configured cluster');
 vi.stubEnv('SOLANA_EXPECTED_GENESIS_HASH',DEVNET_GENESIS);expect(clusterPolicy().cluster).toBe('devnet');
});
it('never enables local-test mode on a deployed or production runtime',()=>{
 vi.stubEnv('CHAIN_MODE','local');vi.stubEnv('APP_ENV','test');vi.stubEnv('NODE_ENV','production');vi.stubEnv('SOLANA_RPC_URL','http://127.0.0.1:8899');vi.stubEnv('SOLANA_EXPECTED_GENESIS_HASH','local');expect(()=>clusterPolicy()).toThrow('isolated loopback tests');
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','1');expect(()=>clusterPolicy()).toThrow();
 vi.stubEnv('VERCEL','');expect(clusterPolicy().cluster).toBe('local-validator');vi.stubEnv('SOLANA_RPC_URL','https://attacker.invalid');expect(()=>clusterPolicy()).toThrow();
});
