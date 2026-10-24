import {mkdir,open,readFile} from "node:fs/promises";import {join,resolve,sep} from "node:path";import {sha256} from "./index";
import {supabaseStorageConfig} from "./config";
export interface ArtifactStore {putOnce(key:string,bytes:Uint8Array):Promise<void>;get(key:string):Promise<Uint8Array>}
export class ArtifactNotFound extends Error {}
export async function optionalArtifact(store:ArtifactStore,key:string){try{return await store.get(key)}catch(error){if(error instanceof ArtifactNotFound||(error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error}}
function validatedKey(key:string){if(!/^[a-zA-Z0-9_./-]{1,250}$/.test(key)||key.startsWith("/")||key.split("/").includes(".."))throw Error("Unsafe artifact key");return key}
export class LocalArtifactStore implements ArtifactStore {
 private root=resolve(process.env.ARTIFACT_DIRECTORY||".artifacts");
 private path(key:string){const full=resolve(this.root,validatedKey(key));if(!full.startsWith(this.root+sep))throw Error("Invalid artifact path");return full}
 async putOnce(key:string,bytes:Uint8Array){const path=this.path(key);await mkdir(resolve(path,".."),{recursive:true});const handle=await open(path,"wx",0o600);try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}}
 async get(key:string){return readFile(this.path(key))}
}
export class SupabaseArtifactStore implements ArtifactStore {
 private config=supabaseStorageConfig();
 private endpoint(key:string){return this.config.url+"/storage/v1/object/"+this.config.bucket+"/"+validatedKey(key)}
 async putOnce(key:string,bytes:Uint8Array){const r=await fetch(this.endpoint(key),{method:"POST",headers:{...this.config.headers,"Content-Type":"application/pdf","x-upsert":"false"},body:Buffer.from(bytes),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error("Immutable upload failed: "+r.status)}
 async get(key:string){const r=await fetch(this.endpoint(key),{headers:this.config.headers,signal:AbortSignal.timeout(30000)});if(!r.ok){const detail=await r.json().catch(()=>({})) as {statusCode?:string|number;error?:string};if(r.status===404||String(detail.statusCode)==="404"||detail.error==="not_found")throw new ArtifactNotFound("Artifact missing");throw Error("Artifact read failed: "+r.status)}return new Uint8Array(await r.arrayBuffer())}
}
export function artifactStore():ArtifactStore{const mode=process.env.STORAGE_MODE||"local";if(mode==="supabase")return new SupabaseArtifactStore();if(mode!=="local")throw Error("STORAGE_MODE must be local or supabase");if(process.env.VERCEL||process.env.VERCEL_REGION)throw Error("Vercel requires STORAGE_MODE=supabase for durable artifacts");return new LocalArtifactStore()}
export async function persistVerified(store:ArtifactStore,key:string,bytes:Uint8Array){await store.putOnce(key,bytes);const readback=await store.get(key);if(sha256(readback)!==sha256(bytes))throw Error("Artifact readback hash mismatch");return sha256(readback)}
