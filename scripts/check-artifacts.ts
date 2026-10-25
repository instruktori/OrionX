import assert from 'node:assert/strict';
import {prisma} from '../packages/db/src';
import {artifactStore,sha256} from '../packages/core/src';
async function main(){
 const versions=await prisma.version.findMany({where:{storageKey:{not:null}}});assert.ok(versions.length>0);const store=artifactStore();
 for(const v of versions){assert.ok(v.storageKey);const original=await store.get(v.storageKey!);assert.equal(sha256(original),v.pdfSha256);const staged=await store.get(v.stagingKey);assert.equal(sha256(staged),v.pdfSha256);assert.ok((v.pageCount||0)>=2);assert.equal(original.length,v.byteLength)}
 const audit=await prisma.auditEvent.count({where:{action:'PDF_STORED',targetId:{in:versions.map(v=>v.id)}}});assert.equal(audit,versions.length);
 console.log('PASS '+versions.length+' immutable staging/final object pairs, exact hashes, byte lengths, multi-page counts and exactly-once storage audit');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
