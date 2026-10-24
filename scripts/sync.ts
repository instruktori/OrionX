import {synchronize} from '../packages/core/src/sync';
import {prisma} from '../packages/db/src';
synchronize(process.argv[2], 'operator').then(run=>console.log(JSON.stringify({runId:run.id,state:run.state,totals:run.totals}))).catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
