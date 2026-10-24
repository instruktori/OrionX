import {randomUUID} from 'node:crypto';
import {prisma} from '../packages/db/src';
import {synchronize} from '../packages/core/src/sync';
import type {Snapshot} from '../packages/core/src';
async function main(){
 if(process.env.APP_ENV!=='demo'||process.env.CHAIN_MODE!=='offline')throw Error('Only offline demo reservations may be archived/retemplated');
 const desired=process.env.TEMPLATE_REVISION||'btu-reference-v1';
 const versions=await prisma.version.findMany({where:{finalizedSlot:null},include:{jobs:true,awards:true,attempts:true}});
 let count=0;
 for(const version of versions){
  const frozen=version.snapshot as unknown as Snapshot;
  if(frozen.templateRevision===desired&&frozen.verificationOrigin===(process.env.VERIFICATION_PUBLIC_ORIGIN||'http://localhost:3000'))continue;
  if(version.attempts.length||version.jobs.some(j=>j.leaseOwner)||version.finalizedSlot)throw Error('Signed, finalized or leased reservations cannot be retemplated');
  await prisma.$transaction(async tx=>{
   const passport=await tx.passport.findUniqueOrThrow({where:{id:version.passportId}});
   if(passport.latestFinalizedVersion!==0||passport.activeVersionId!==version.id)throw Error('Only initial unissued demo reservation is eligible');
   await tx.auditEvent.create({data:{action:'UNBROADCAST_RESERVATION_ARCHIVED',targetId:version.id,detail:JSON.parse(JSON.stringify({reason:'BTU supplied reference and stamp assets discovered before first issuance',replacementTemplate:desired,version,jobs:version.jobs,awards:version.awards}))}});
   await tx.versionAward.deleteMany({where:{versionId:version.id}});
   await tx.job.deleteMany({where:{versionId:version.id}});
   await tx.version.delete({where:{id:version.id}});
   await tx.passport.update({where:{id:passport.id},data:{activeVersionId:null,nextVersion:1}});
  });count++;
 }
 const run=await synchronize('unissued-bootstrap-'+randomUUID(),'operator');console.log(JSON.stringify({archivedUnissuedReservations:count,replacementRun:run.state,totals:run.totals}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
