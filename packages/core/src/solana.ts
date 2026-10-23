import {Connection,PublicKey} from "@solana/web3.js";
import {decodeCode,sha256} from "./index";
import {createHash} from "node:crypto";
export type Proof={registration:"REGISTERED"|"UNKNOWN";issuerTrust:"UNCONFIRMED";currency:"LATEST"|"SUPERSEDED"|"UNKNOWN";integrity:"NOT_CHECKED"|"MATCH"|"MISMATCH";officialBtu:false;message:string;programId?:string;versionPda?:string;pdfSha256?:string;version?:number;checkedAt:string};
const unknown=(message:string):Proof=>({registration:"UNKNOWN",issuerTrust:"UNCONFIRMED",currency:"UNKNOWN",integrity:"NOT_CHECKED",officialBtu:false,message,checkedAt:new Date().toISOString()});
const discriminator=(name:string)=>createHash("sha256").update("account:"+name).digest().subarray(0,8);
function requireAccount(data:Buffer,name:string,length:number){if(data.length!==length||!data.subarray(0,8).equals(discriminator(name)))throw Error("Invalid "+name+" account schema");}
function u32(value:number){const b=Buffer.alloc(4);b.writeUInt32LE(value);return b}
function parseRecord(data:Buffer){requireAccount(data,"VersionRecord",133);return {reference:data.subarray(8,40),version:data.readUInt32LE(40),code:data.subarray(44,64),hash:data.subarray(64,96),epoch:data.readUInt32LE(96),previous:new PublicKey(data.subarray(100,132)),bump:data[132]}}
function parseRegistry(data:Buffer){requireAccount(data,"PassportRegistry",77);return {reference:data.subarray(8,40),latestVersion:data.readUInt32LE(40),latestRecord:new PublicKey(data.subarray(44,76)),bump:data[76]}}
function parseConfig(data:Buffer){requireAccount(data,"IssuerConfig",78);return {admin:new PublicKey(data.subarray(8,40)),issuer:new PublicKey(data.subarray(40,72)),epoch:data.readUInt32LE(72),paused:data[76]!==0,bump:data[77]}}
function parseEpoch(data:Buffer){requireAccount(data,"IssuerEpoch",45);return {number:data.readUInt32LE(8),issuer:new PublicKey(data.subarray(12,44)),bump:data[44]}}
async function owned(connection:Connection,address:PublicKey,program:PublicKey){const info=await connection.getAccountInfo(address,"finalized");if(!info)return null;if(!info.owner.equals(program)||info.executable)throw Error("Unexpected program owner or executable account");return info.data}
export async function verifyDevnet(code:string,bytes?:Uint8Array):Promise<Proof>{
 const raw=Buffer.from(decodeCode(code));const id=process.env.SOLANA_PROGRAM_ID;const genesis=process.env.SOLANA_EXPECTED_GENESIS_HASH;
 if(!id||!genesis)return unknown("Verification unavailable: pinned Devnet program and genesis hash are not configured.");
 const program=new PublicKey(id);if(program.equals(PublicKey.default))return unknown("Program ID is a placeholder; verification disabled.");
 const connection=new Connection(process.env.SOLANA_RPC_URL||"https://api.devnet.solana.com","finalized");
 if(await connection.getGenesisHash()!==genesis)throw Error("RPC genesis hash mismatch");
 const [versionPda]=PublicKey.findProgramAddressSync([Buffer.from("version"),raw],program);
 const recordBytes=await owned(connection,versionPda,program);
 if(!recordBytes)return {...unknown("No finalized passport version found for this code."),programId:id,versionPda:versionPda.toBase58()};
 const record=parseRecord(Buffer.from(recordBytes));
 if(!record.code.equals(raw)||record.version<1||record.hash.equals(Buffer.alloc(32)))throw Error("Invalid version record");
 const [registryPda]=PublicKey.findProgramAddressSync([Buffer.from("passport"),record.reference],program);
 const [configPda]=PublicKey.findProgramAddressSync([Buffer.from("issuer-config")],program);
 const [epochPda]=PublicKey.findProgramAddressSync([Buffer.from("issuer-epoch"),u32(record.epoch)],program);
 const infos=await Promise.all([owned(connection,registryPda,program),owned(connection,configPda,program),owned(connection,epochPda,program)]);
 if(infos.some(x=>!x))throw Error("Missing registry, issuer configuration or historical issuer epoch");
 const registry=parseRegistry(Buffer.from(infos[0]!)),config=parseConfig(Buffer.from(infos[1]!)),epoch=parseEpoch(Buffer.from(infos[2]!));
 if(!registry.reference.equals(record.reference)||registry.latestVersion<record.version||epoch.number!==record.epoch||record.epoch>config.epoch||epoch.issuer.equals(PublicKey.default))throw Error("Inconsistent passport registry or issuer epoch");
 const latest=registry.latestVersion===record.version;
 if(latest&&!registry.latestRecord.equals(versionPda))throw Error("Latest record pointer mismatch");
 const expected=record.hash.toString("hex"),actual=bytes?sha256(bytes):undefined;
 const integrity=actual?(actual===expected?"MATCH":"MISMATCH"):"NOT_CHECKED";
 return {registration:"REGISTERED",issuerTrust:"UNCONFIRMED",currency:latest?"LATEST":"SUPERSEDED",integrity,officialBtu:false,programId:id,versionPda:versionPda.toBase58(),pdfSha256:expected,version:record.version,checkedAt:new Date().toISOString(),message:integrity==="MISMATCH"?"PDF bytes do not match the registered SHA-256.":integrity==="MATCH"?"PDF bytes match the Devnet record; BTU institutional authority remains unconfirmed.":"Finalized Devnet record found. Upload the PDF for exact-byte integrity verification. BTU institutional authority remains unconfirmed."};
}
