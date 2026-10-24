import {clusterPolicy} from "./cluster";
import {Connection, PublicKey} from "@solana/web3.js";
import {decodeCode, sha256} from "./index";
import {DEVNET_GENESIS, configAddress, epochAddress, registryAddress, versionAddress, parseConfig, parseEpoch, parseRecord, parseRegistry} from "./protocol";
import {issuerTrust, type TrustStatus} from "./trust";
export type Proof = {registration: "REGISTERED" | "UNKNOWN" | "PENDING"; issuerTrust: TrustStatus; currency: "LATEST" | "SUPERSEDED" | "UNKNOWN"; integrity: "NOT_CHECKED" | "MATCH" | "MISMATCH"; officialBtu: boolean; message: string; errorCode?: string; programId?: string; versionPda?: string; pdfSha256?: string; version?: number; chainEvidence?: Record<string, string | number>; checkedAt: string};
const unknown = (message: string, errorCode = "PROOF_UNAVAILABLE"): Proof => ({registration: "UNKNOWN", issuerTrust: "UNCONFIRMED", currency: "UNKNOWN", integrity: "NOT_CHECKED", officialBtu: false, message, errorCode, checkedAt: new Date().toISOString()});
export async function verifyDevnet(code: string, bytes?: Uint8Array): Promise<Proof> {
 const raw = Buffer.from(decodeCode(code)), id = process.env.SOLANA_PROGRAM_ID;
 if (!id || !process.env.SOLANA_EXPECTED_GENESIS_HASH) return unknown("Pinned Devnet program is not configured.");
 let policy: ReturnType<typeof clusterPolicy>;
 try {policy = clusterPolicy();} catch {return unknown("Wrong configured cluster.", "WRONG_CLUSTER");}
 const program = new PublicKey(id);
 if (program.equals(PublicKey.default)) return unknown("Program ID is a placeholder.");
 const connection = new Connection(policy.rpc, {commitment: "finalized", confirmTransactionInitialTimeout: 30000});
 try {
  if (await connection.getGenesisHash() !== policy.genesisHash) return unknown("RPC genesis hash mismatch.", "WRONG_CLUSTER");
  const deployed = await connection.getAccountInfo(program, "finalized");
  if (!deployed?.executable) throw Error("Invalid executable program");
  const [versionPda, recordBump] = versionAddress(program, raw);
  const first = await connection.getAccountInfoAndContext(versionPda, "finalized");
  if (!first.value) return {...unknown("No finalized version exists for this code.", "UNKNOWN_CODE"), programId: id, versionPda: versionPda.toBase58()};
  const read = async (address: PublicKey) => {
   const response = await connection.getAccountInfoAndContext(address, {commitment: "finalized", minContextSlot: first.context.slot});
   if (!response.value || !response.value.owner.equals(program) || response.value.executable) throw Error("Invalid proof account owner");
   return response.value.data;
  };
  if (!first.value.owner.equals(program) || first.value.executable) throw Error("Unexpected version owner");
  const record = parseRecord(first.value.data);
  if (record.bump !== recordBump || !record.code.equals(raw) || record.version < 1 || record.epoch < 1 || record.registeredSlot === 0n || record.hash.equals(Buffer.alloc(32)) || record.issuer.equals(PublicKey.default) || record.registeredSlot > BigInt(first.context.slot)) throw Error("Invalid version record");
  const [configPda, cb] = configAddress(program), [epochPda, eb] = epochAddress(program, configPda, record.epoch);
  const [configBytes, epochBytes, registryBytes] = await Promise.all([read(configPda), read(epochPda), read(record.registry)]);
  const config = parseConfig(configBytes), epoch = parseEpoch(epochBytes), registry = parseRegistry(registryBytes);
  const [registryPda, rb] = registryAddress(program, configPda, registry.reference);
  if (config.epoch < 1 || config.admin.equals(PublicKey.default) || config.issuer.equals(PublicKey.default) || config.bump !== cb || epoch.bump !== eb || registry.bump !== rb || !registryPda.equals(record.registry) || !registry.config.equals(configPda) || !epoch.config.equals(configPda) || epoch.number !== record.epoch || !epoch.issuer.equals(record.issuer) || epoch.activatedSlot > record.registeredSlot || epoch.activatedUnix > record.registeredUnix || record.epoch > config.epoch || registry.latestVersion < record.version) throw Error("Inconsistent proof relationships");
  if (record.version === 1 ? !record.previous.equals(PublicKey.default) : record.previous.equals(PublicKey.default)) throw Error("Invalid history pointer");
  const latest = registry.latestVersion === record.version;
  if (latest && !registry.latestRecord.equals(versionPda)) throw Error("Latest pointer mismatch");
  // Verify the historical record is actually on the registry's current lineage.
  let pointer = registry.latestRecord, expected = registry.latestVersion;
  while (expected > record.version) {
   if (registry.latestVersion - expected > 10000) throw Error("History traversal exceeds safety bound");
   const descendant = parseRecord(await read(pointer));
   const [address, bump] = versionAddress(program, descendant.code);
   if (!address.equals(pointer) || descendant.bump !== bump || !descendant.registry.equals(record.registry) || descendant.version !== expected) throw Error("Invalid version lineage");
   pointer = descendant.previous; expected--;
  }
  if (!pointer.equals(versionPda)) throw Error("Version is not part of the registry history");
  const trust = await issuerTrust({programId: id, genesisHash: policy.genesisHash, configPda: configPda.toBase58(), issuer: record.issuer.toBase58(), epoch: record.epoch, admin: config.admin.toBase58(), registeredUnix: record.registeredUnix});
  const hash = record.hash.toString("hex"), integrity = bytes ? (sha256(bytes) === hash ? "MATCH" : "MISMATCH") : "NOT_CHECKED";
  return {registration: "REGISTERED", issuerTrust: trust, currency: latest ? "LATEST" : "SUPERSEDED", integrity, officialBtu: trust === "BTU_CONFIRMED" && integrity !== "MISMATCH", message: integrity === "MISMATCH" ? "PDF bytes do not match this registered version." : bytes ? "PDF bytes match the finalized Devnet record." : "Finalized version found; upload a PDF to check its exact bytes.", ...(integrity === "MISMATCH" ? {errorCode: "DOCUMENT_TAMPERED"} : {}), programId: id, versionPda: versionPda.toBase58(), pdfSha256: hash, version: record.version, chainEvidence: {cluster: policy.cluster, genesisHash: policy.genesisHash, programId: id, configPda: configPda.toBase58(), registryPda: record.registry.toBase58(), versionPda: versionPda.toBase58(), issuerKey: record.issuer.toBase58(), issuerEpoch: record.epoch, registeredSlot: record.registeredSlot.toString(), registeredUnix: record.registeredUnix.toString(), observedFinalizedSlot: first.context.slot.toString(), explorerAccount: "https://explorer.solana.com/address/" + versionPda.toBase58() + "?cluster=devnet"}, checkedAt: new Date().toISOString()};
 } catch (error) { return unknown(error instanceof Error && /Invalid|Inconsistent|Unexpected|lineage|pointer/.test(error.message) ? "Proof validation failed." : "Devnet proof is unavailable; try again later.", error instanceof Error && /Invalid|Inconsistent|Unexpected|lineage|pointer/.test(error.message) ? "INVALID_PROOF" : "RPC_UNAVAILABLE"); }
}
