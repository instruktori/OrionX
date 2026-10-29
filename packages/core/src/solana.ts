import {clusterPolicy} from "./cluster";
import {Connection, PublicKey} from "@solana/web3.js";
import {decodeCode, sha256} from "./index";
import {DEVNET_GENESIS, configAddress, epochAddress, registryAddress, versionAddress, parseConfig, parseEpoch, parseRecord, parseRegistry, revocationAddress, parseRevocation} from "./protocol";
import {issuerTrust, type TrustStatus} from "./trust";
export type Proof = {revocation?: "VALID" | "REVOKED" | "UNKNOWN"; revocationEvidence?: {pda: string; reasonDigest: string; actorDigest: string; authority: string; revokedSlot: string; revokedUnix: string}; registration: "REGISTERED" | "UNKNOWN" | "PENDING"; issuerTrust: TrustStatus; currency: "LATEST" | "SUPERSEDED" | "UNKNOWN"; integrity: "NOT_CHECKED" | "MATCH" | "MISMATCH"; officialBtu: boolean; message: string; errorCode?: string; programId?: string; versionPda?: string; pdfSha256?: string; version?: number; chainEvidence?: Record<string, string | number>; checkedAt: string};
const unknown = (message: string, errorCode = "PROOF_UNAVAILABLE"): Proof => ({revocation: "UNKNOWN", registration: "UNKNOWN", issuerTrust: "UNCONFIRMED", currency: "UNKNOWN", integrity: "NOT_CHECKED", officialBtu: false, message, errorCode, checkedAt: new Date().toISOString()});
export async function verifyDevnet(code: string, bytes?: Uint8Array): Promise<Proof> {
 let raw: Buffer;
 try { raw = Buffer.from(decodeCode(code)); } catch { return unknown("Malformed verification code.", "INVALID_CODE"); }
 const id = process.env.SOLANA_PROGRAM_ID;
 if (!id || !process.env.SOLANA_EXPECTED_GENESIS_HASH) return unknown("Pinned Devnet program is not configured.");
 let policy: ReturnType<typeof clusterPolicy>;
 try {policy = clusterPolicy();} catch {return unknown("Wrong configured cluster.", "WRONG_CLUSTER");}
 let program: PublicKey;
 try { program = new PublicKey(id); } catch { return unknown("Invalid pinned program identity.", "INVALID_PROGRAM"); }
 if (program.equals(PublicKey.default)) return unknown("Program ID is a placeholder.");
 try {
 const connection = new Connection(policy.rpc, {commitment: "finalized", confirmTransactionInitialTimeout: 30000, disableRetryOnRateLimit: true, fetch: (url, init) => fetch(url, {...init, signal: AbortSignal.timeout(10000)})});
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
  if (process.env.SOLANA_EXPECTED_ISSUER && record.issuer.toBase58() !== process.env.SOLANA_EXPECTED_ISSUER) return unknown("Issuance is not from the expected test issuer.", "WRONG_ISSUER");
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
  // Query the tombstone at finalized commitment. An RPC failure is never interpreted as absence.
  const [revocationPda, revocationBump] = revocationAddress(program, versionPda);
  const revocationResponse = await connection.getAccountInfoAndContext(revocationPda, {commitment: "finalized", minContextSlot: first.context.slot});
  let revocationEvidence: Proof["revocationEvidence"];
  if (revocationResponse.value) {
   if (!revocationResponse.value.owner.equals(program) || revocationResponse.value.executable) throw Error("Invalid revocation owner");
   const revoked = parseRevocation(revocationResponse.value.data);
   if (revoked.bump !== revocationBump || !revoked.record.equals(versionPda) || revoked.epoch < record.epoch || revoked.epoch > config.epoch || revoked.revokedSlot < record.registeredSlot || revoked.revokedSlot > BigInt(revocationResponse.context.slot) || revoked.revokedUnix < record.registeredUnix || revoked.reasonDigest.equals(Buffer.alloc(32)) || revoked.actorDigest.equals(Buffer.alloc(32))) throw Error("Invalid revocation relationships");
   const [authorityEpochPda, authorityBump] = epochAddress(program, configPda, revoked.epoch);
   const authorityEpoch = parseEpoch(await read(authorityEpochPda));
   if (authorityEpoch.bump !== authorityBump || authorityEpoch.number !== revoked.epoch || !authorityEpoch.config.equals(configPda) || authorityEpoch.activatedSlot > revoked.revokedSlot || authorityEpoch.activatedUnix > revoked.revokedUnix || (!revoked.authority.equals(config.admin) && !revoked.authority.equals(authorityEpoch.issuer))) throw Error("Invalid revocation authority");
   revocationEvidence = {pda: revocationPda.toBase58(), reasonDigest: revoked.reasonDigest.toString("hex"), actorDigest: revoked.actorDigest.toString("hex"), authority: revoked.authority.toBase58(), revokedSlot: revoked.revokedSlot.toString(), revokedUnix: revoked.revokedUnix.toString()};
  }
  const trust = await issuerTrust({programId: id, genesisHash: policy.genesisHash, configPda: configPda.toBase58(), issuer: record.issuer.toBase58(), epoch: record.epoch, admin: config.admin.toBase58(), registeredUnix: record.registeredUnix});
  const hash = record.hash.toString("hex"), integrity = bytes ? (sha256(bytes) === hash ? "MATCH" : "MISMATCH") : "NOT_CHECKED";
  return {revocation: revocationEvidence ? "REVOKED" : "VALID", revocationEvidence, registration: "REGISTERED", issuerTrust: trust, currency: latest ? "LATEST" : "SUPERSEDED", integrity, officialBtu: !revocationEvidence && trust === "BTU_CONFIRMED" && integrity !== "MISMATCH", message: revocationEvidence ? "This version was revoked on Solana. Its original issuance remains recorded; it is no longer a valid credential." : integrity === "MISMATCH" ? "PDF bytes do not match this registered version." : bytes ? "PDF bytes match the finalized Devnet record." : "Finalized version found; upload a PDF to check its exact bytes.", ...(revocationEvidence ? {errorCode: "CREDENTIAL_REVOKED"} : integrity === "MISMATCH" ? {errorCode: "DOCUMENT_TAMPERED"} : {}), programId: id, versionPda: versionPda.toBase58(), pdfSha256: hash, version: record.version, chainEvidence: {cluster: policy.cluster, genesisHash: policy.genesisHash, programId: id, configPda: configPda.toBase58(), registryPda: record.registry.toBase58(), versionPda: versionPda.toBase58(), issuerKey: record.issuer.toBase58(), issuerEpoch: record.epoch, registeredSlot: record.registeredSlot.toString(), registeredUnix: record.registeredUnix.toString(), observedFinalizedSlot: first.context.slot.toString(), explorerAccount: "https://explorer.solana.com/address/" + versionPda.toBase58() + "?cluster=devnet"}, checkedAt: new Date().toISOString()};
 } catch (error) { return unknown(error instanceof Error && /Invalid|Inconsistent|Unexpected|lineage|pointer/.test(error.message) ? "Proof validation failed." : "Devnet proof is unavailable; try again later.", error instanceof Error && /Invalid|Inconsistent|Unexpected|lineage|pointer/.test(error.message) ? "INVALID_PROOF" : "RPC_UNAVAILABLE"); }
}
