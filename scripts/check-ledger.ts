import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../packages/db/src';
import {synchronize,sourceRows} from '../packages/core/src/sync';
async function main(){
 const rows=await sourceRows();
 const counts=await Promise.all([prisma.student.count(),prisma.award.count(),prisma.version.count(),prisma.versionAward.count()]);assert.equal(counts[0],new Set(rows.map(row=>row.student.studentId)).size);assert.equal(counts[1],rows.length);assert.ok(counts[2]>=counts[0]);
 const passports=await prisma.passport.findMany({include:{student:true}});
 for(const p of passports){const source=rows.find(r=>r.student.studentId===p.student.externalId)!.student;assert.equal(p.publicId,source.passportId);assert.equal(p.initialIssueDate.toISOString().slice(0,10),source.initialIssueDate);assert.equal(p.student.firstName,source.firstName)}
 const runs=await Promise.all([synchronize('repeat-'+randomUUID()),synchronize('reorder-'+randomUUID(),'acceptance',[...rows].reverse())]);
 for(const run of runs)assert.equal((run.totals as {queued:number}).queued,0);
 const changed=structuredClone(rows);changed[0].award.description+=' unauthorized edit';
 const conflict=await synchronize('conflict-'+randomUUID(),'acceptance',changed);assert.ok((conflict.totals as {conflicts:number}).conflicts>0);
 const version=await prisma.version.findFirstOrThrow();
 await assert.rejects(()=>prisma.version.update({where:{id:version.id},data:{snapshot:{forged:true}}}),/Immutable version snapshot/);
 assert.deepEqual(await Promise.all([prisma.student.count(),prisma.award.count(),prisma.version.count(),prisma.versionAward.count()]),counts);
 console.log('PASS canonical import, original identity preservation, concurrent replay, reorder, mutation quarantine and database snapshot guard');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
