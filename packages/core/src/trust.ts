import {readFile} from "node:fs/promises";
import {createPublicKey, verify} from "node:crypto";
export type TrustStatus = "BTU_CONFIRMED" | "DEMO" | "UNCONFIRMED" | "UNAUTHORIZED";
export async function issuerTrust(input: {programId: string; genesisHash: string; configPda: string; issuer: string; epoch: number; admin: string; registeredUnix: bigint}): Promise<TrustStatus> {
  if (process.env.ISSUER_TRUST_MODE === "DEMO") return "DEMO";
  const path = process.env.BTU_TRUST_MANIFEST_PATH, root = process.env.BTU_TRUST_ROOT_PUBLIC_KEY;
  if (!path || !root) return "UNCONFIRMED";
  // The pinned root must be independently authenticated by BTU. This verifier
  // authenticates bytes against that root; it cannot establish who supplied it.
  const envelope = JSON.parse(await readFile(path, "utf8"));
  if (typeof envelope.payload !== "string" || typeof envelope.signature !== "string") return "UNAUTHORIZED";
  const key = createPublicKey({key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(root, "base64")]), format: "der", type: "spki"});
  if (!verify(null, Buffer.from(envelope.payload, "utf8"), key, Buffer.from(envelope.signature, "base64"))) return "UNAUTHORIZED";
  const m = JSON.parse(envelope.payload);
  if (m.institution !== "BTU" || m.genesisHash !== input.genesisHash || m.programId !== input.programId || m.configPda !== input.configPda || m.admin !== input.admin) return "UNAUTHORIZED";
  const epoch = Array.isArray(m.epochs) && m.epochs.find((e: {number: number; issuer: string}) => e.number === input.epoch && e.issuer === input.issuer);
  if (!epoch || input.registeredUnix < BigInt(epoch.validFrom) || (epoch.validUntil && input.registeredUnix > BigInt(epoch.validUntil))) return "UNAUTHORIZED";
  return "BTU_CONFIRMED";
}
