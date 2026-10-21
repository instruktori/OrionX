import {mkdir,open,readFile} from "node:fs/promises";import {join,resolve,sep} from "node:path";import {sha256} from "./index";
export interface ArtifactStore {putOnce(key:string,bytes:Uint8Array):Promise<void>;get(key:string):Promise<Uint8Array>}
function validatedKey(key:string){if(!/^[a-zA-Z0-9_./-]{1,250}$/.test(key)||key.startsWith("/")||key.split("/").includes(".."))throw Error("Unsafe artifact key");return key}
export class LocalArtifactStore implements ArtifactStore {
 private root=resolve(process.env.ARTIFACT_DIRECTORY||".artifacts");
 private path(key:string){const full=resolve(this.root,validatedKey(key));if(!full.startsWith(this.root+sep))throw Error("Invalid artifact path");return full}
 async putOnce(key:string,bytes:Uint8Array){const path=this.path(key);await mkdir(resolve(path,".."),{recursive:true});const handle=await open(path,"wx",0o600);try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}}
 async get(key:string){return readFile(this.path(key))}
}
export class SupabaseArtifactStore implements ArtifactStore {
 private url=process.env.SUPABASE_URL;private key=process.env.SUPABASE_SERVICE_ROLE_KEY;private bucket=process.env.SUPABASE_STORAGE_BUCKET||"passport-pdfs";
 private endpoint(path:string){if(!this.url||!this.key)throw Error("Supabase storage not configured");return this.url.replace(/\/$/,"")+"/storage/v1/object/"+path}
 private headers(){return {Authorization:"Bearer "+this.key,apikey:this.key!}}
 async putOnce(key:string,bytes:Uint8Array){const url=this.endpoint(this.bucket+"/"+validatedKey(key));const r=await fetch(url,{method:"POST",headers:{...this.headers(),"Content-Type":"application/pdf","x-upsert":"false"},body:Buffer.from(bytes)});if(!r.ok)throw Error("Immutable upload failed: "+r.status)}
 async get(key:string){const r=await fetch(this.endpoint(this.bucket+"/"+validatedKey(key)),{headers:this.headers()});if(!r.ok)throw Error("Artifact read failed: "+r.status);return new Uint8Array(await r.arrayBuffer())}
}
export function artifactStore():ArtifactStore{return process.env.STORAGE_MODE==="supabase"?new SupabaseArtifactStore():new LocalArtifactStore()}
export async function persistVerified(store:ArtifactStore,key:string,bytes:Uint8Array){await store.putOnce(key,bytes);const readback=await store.get(key);if(sha256(readback)!==sha256(bytes))throw Error("Artifact readback hash mismatch");return sha256(readback)}
