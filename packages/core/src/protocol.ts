import {createHash} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const SCHEMA = 1;
export const discriminator = (namespace: string, name: string) => createHash("sha256").update(namespace + ":" + name).digest().subarray(0, 8);
const account = (data: Buffer, name: string, size: number) => {
  if (data.length !== size || !data.subarray(0, 8).equals(discriminator("account", name)) || data[8] !== SCHEMA) throw Error("Invalid " + name + " schema");
};
export function u32(value: number) { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; }
export const configAddress = (program: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("issuer")], program);
export const epochAddress = (program: PublicKey, config: PublicKey, epoch: number) => PublicKey.findProgramAddressSync([Buffer.from("issuer_epoch"), config.toBuffer(), u32(epoch)], program);
export const registryAddress = (program: PublicKey, config: PublicKey, ref: Uint8Array) => PublicKey.findProgramAddressSync([Buffer.from("passport"), config.toBuffer(), ref], program);
export const versionAddress = (program: PublicKey, code: Uint8Array) => PublicKey.findProgramAddressSync([Buffer.from("version"), code], program);
export function parseConfig(data: Buffer) {
  account(data, "IssuerConfig", 79);
  if (data[77] > 1) throw Error("Invalid pause value");
  return {admin: new PublicKey(data.subarray(9, 41)), issuer: new PublicKey(data.subarray(41, 73)), epoch: data.readUInt32LE(73), paused: !!data[77], bump: data[78]};
}
export function parseEpoch(data: Buffer) {
  account(data, "IssuerEpoch", 126);
  return {config: new PublicKey(data.subarray(9, 41)), number: data.readUInt32LE(41), issuer: new PublicKey(data.subarray(45, 77)), activatedSlot: data.readBigUInt64LE(77), activatedUnix: data.readBigInt64LE(85), attestation: data.subarray(93, 125), bump: data[125]};
}
export function parseRegistry(data: Buffer) {
  account(data, "PassportRegistry", 110);
  return {config: new PublicKey(data.subarray(9, 41)), reference: data.subarray(41, 73), latestVersion: data.readUInt32LE(73), latestRecord: new PublicKey(data.subarray(77, 109)), bump: data[109]};
}
export function parseRecord(data: Buffer) {
  account(data, "VersionRecord", 182);
  return {registry: new PublicKey(data.subarray(9, 41)), version: data.readUInt32LE(41), code: data.subarray(45, 65), hash: data.subarray(65, 97), issuer: new PublicKey(data.subarray(97, 129)), epoch: data.readUInt32LE(129), previous: new PublicKey(data.subarray(133, 165)), registeredUnix: data.readBigInt64LE(165), registeredSlot: data.readBigUInt64LE(173), bump: data[181]};
}

export const revocationAddress = (program: PublicKey, record: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("revocation"), record.toBuffer()], program);
export function parseRevocation(data: Buffer) {
  account(data, "RevocationRecord", 158);
  return {record: new PublicKey(data.subarray(9, 41)), authority: new PublicKey(data.subarray(41, 73)), epoch: data.readUInt32LE(73), reasonDigest: data.subarray(77, 109), actorDigest: data.subarray(109, 141), revokedUnix: data.readBigInt64LE(141), revokedSlot: data.readBigUInt64LE(149), bump: data[157]};
}
