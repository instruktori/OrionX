import {Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction} from "@solana/web3.js";
import bs58 from "bs58";
import {clusterPolicy} from "./cluster";
import {readFile} from "node:fs/promises";
import {decodeCode} from "./index";
import {DEVNET_GENESIS, configAddress, epochAddress, registryAddress, versionAddress, parseConfig, parseRegistry, discriminator, u32} from "./protocol";
import {DomainError} from "./errors";

export async function issuerEnvironment() {
 if (!["devnet", "local"].includes(process.env.CHAIN_MODE || "")) throw new DomainError("CHAIN_DISABLED", "Issuance requires CHAIN_MODE=devnet", 503);
 const id = process.env.SOLANA_PROGRAM_ID, path = process.env.SOLANA_ISSUER_KEYPAIR_PATH;
 if (!id || !path || !process.env.SOLANA_EXPECTED_GENESIS_HASH) throw new DomainError("CHAIN_UNCONFIGURED", "Pinned Devnet issuer environment is incomplete", 503);
 const policy = clusterPolicy();
 const connection = new Connection(policy.rpc, "finalized");
 if (await connection.getGenesisHash() !== policy.genesisHash) throw new DomainError("WRONG_CLUSTER", "Wrong Solana network", 503);
 const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, "utf8")))), programId = new PublicKey(id);
 if (programId.equals(PublicKey.default)) throw new DomainError("INVALID_PROGRAM", "Placeholder program", 503);
 return {connection, keypair, programId};
}
export const versionPda = (code: string, program: PublicKey) => versionAddress(program, decodeCode(code))[0];
export const registryPda = (reference: Uint8Array, program: PublicKey) => registryAddress(program, configAddress(program)[0], reference)[0];
export const configPda = (program: PublicKey) => configAddress(program)[0];
export type SignedAttempt = {signature: string; transactionBytes: string; blockhash: string; lastValidBlockHeight: bigint};
export async function signVersion(input: {reference: string; version: number; code: string; hash: string}): Promise<SignedAttempt> {
 const {connection, keypair, programId} = await issuerEnvironment();
 const executable = await connection.getAccountInfo(programId, "finalized");
 if (!executable?.executable) throw new DomainError("PROGRAM_UNAVAILABLE", "Devnet program is not deployed", 503);
 const config = configPda(programId), data = await connection.getAccountInfo(config, "finalized");
 if (!data?.owner.equals(programId)) throw new DomainError("ISSUER_UNAVAILABLE", "Issuer config is missing", 503);
 const issuer = parseConfig(data.data);
 if (!issuer.issuer.equals(keypair.publicKey) || issuer.paused) throw new DomainError("UNAUTHORIZED_ISSUER", "Issuer is unauthorized or paused", 403);
 const registry = registryPda(Buffer.from(input.reference, "hex"), programId), code = Buffer.from(decodeCode(input.code)), record = versionPda(input.code, programId);
 const prior = await connection.getAccountInfo(registry, "finalized");
 if (prior && !prior.owner.equals(programId)) throw new DomainError("INVALID_PROOF", "Registry owner mismatch");
 const registryState = prior ? parseRegistry(prior.data) : undefined;
 if ((registryState?.latestVersion || 0) + 1 !== input.version) throw new DomainError("VERSION_CONFLICT", "Unexpected on-chain sequence");
 const tx = new Transaction();
 const signer = {pubkey: keypair.publicKey, isSigner: true, isWritable: true};
 const readonly = (pubkey: PublicKey) => ({pubkey, isSigner: false, isWritable: false});
 if (!prior) tx.add(new TransactionInstruction({programId, keys: [signer, readonly(config), {pubkey: registry, isSigner: false, isWritable: true}, readonly(SystemProgram.programId)], data: Buffer.concat([discriminator("global", "create_passport"), Buffer.from(input.reference, "hex")])}));
 tx.add(new TransactionInstruction({programId, keys: [signer, readonly(config), readonly(epochAddress(programId, config, issuer.epoch)[0]), {pubkey: registry, isSigner: false, isWritable: true}, {pubkey: record, isSigner: false, isWritable: true}, readonly(SystemProgram.programId)], data: Buffer.concat([discriminator("global", "register_next_version"), u32(input.version), code, Buffer.from(input.hash, "hex"), (registryState?.latestRecord || PublicKey.default).toBuffer()])}));
 const latest = await connection.getLatestBlockhash("finalized");
 tx.feePayer = keypair.publicKey; tx.recentBlockhash = latest.blockhash; tx.sign(keypair);
 return {signature: bs58.encode(tx.signature!), transactionBytes: tx.serialize().toString("base64"), blockhash: latest.blockhash, lastValidBlockHeight: BigInt(latest.lastValidBlockHeight)};
}
export async function broadcast(attempt: SignedAttempt) {
 const {connection} = await issuerEnvironment();
 try {
  const signature = await connection.sendRawTransaction(Buffer.from(attempt.transactionBytes, "base64"), {preflightCommitment: "finalized", maxRetries: 2});
  if (signature !== attempt.signature) throw Error("Transaction signature mismatch");
 } catch (error) {
  if (!(error instanceof Error) || !/already (been )?processed/i.test(error.message)) throw error;
  // A replay acknowledgement is not finality. The worker still reconciles proof.
 }
}
export async function attemptStatus(attempt: SignedAttempt): Promise<"PENDING" | "OBSERVED" | "EXPIRED" | "FAILED"> {
 const {connection} = await issuerEnvironment();
 const {value: [status]} = await connection.getSignatureStatuses([attempt.signature], {searchTransactionHistory: true});
 if (status?.err) return "FAILED";
 if (status) return "OBSERVED"; // Even confirmed attempts must reach finalized proof.
 return BigInt(await connection.getBlockHeight("finalized")) > attempt.lastValidBlockHeight ? "EXPIRED" : "PENDING";
}

export async function finalizedAttempt<T extends {signature:string}>(attempts:T[]):Promise<T|undefined>{
 const {connection}=await issuerEnvironment();
 if(!attempts.length)return undefined;
 const statuses=await connection.getSignatureStatuses(attempts.map(a=>a.signature),{searchTransactionHistory:true});
 return attempts.find((_,i)=>statuses.value[i]?.confirmationStatus==="finalized"&&!statuses.value[i]?.err);
}
