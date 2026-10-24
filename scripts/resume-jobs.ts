import {prisma} from '../packages/db/src';
prisma.job.updateMany({where:{state:{in:['FAILED_PERMANENT','STORED']},type:'ISSUE'},data:{state:'QUEUED',attempts:0,availableAt:new Date(),leaseOwner:null,leaseUntil:null}}).then(r=>console.log('Requeued existing jobs:',r.count)).finally(()=>prisma.$disconnect());
