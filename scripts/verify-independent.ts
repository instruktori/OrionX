import {readFile} from "node:fs/promises";
import {verifyDevnet} from "../packages/core/src/solana";
import {DEVNET_GENESIS} from "../packages/core/src/protocol";
const args = process.argv.slice(2);
const arg = (name: string) => args[args.indexOf(name) + 1];
async function main() {
 if (!["--code", "--pdf", "--program", "--issuer"].every(k => args.includes(k) && arg(k))) throw Error("Usage: npm run verify:independent -- --code D1-… --pdf file.pdf --program <pinned-program> --issuer <expected-test-issuer> [--rpc https://…]");
 // No database, OrionX API, signing credential or institutional trust claim is required.
 Object.assign(process.env, {CHAIN_MODE: "devnet", SOLANA_PROGRAM_ID: arg("--program"), SOLANA_EXPECTED_ISSUER: arg("--issuer"), SOLANA_EXPECTED_GENESIS_HASH: DEVNET_GENESIS, SOLANA_RPC_URL: args.includes("--rpc") ? arg("--rpc") : "https://api.devnet.solana.com", ISSUER_TRUST_MODE: "DEMO"});
 const proof = await verifyDevnet(arg("--code"), await readFile(arg("--pdf")));
 console.log(JSON.stringify({...proof, institutionalAuthority: "TEST_ISSUER_ONLY; official BTU approval is not established"}, null, 2));
 if (proof.registration !== "REGISTERED" || proof.integrity !== "MATCH" || proof.revocation !== "VALID") process.exitCode = 1;
}
main().catch(e => {console.error(e.message); process.exitCode = 2;});
