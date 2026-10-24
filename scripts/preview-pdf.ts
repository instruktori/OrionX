import {fixtureRows} from '../packages/core/src/fixtures';
import {snapshot} from '../packages/core/src';
import {renderPassportPdf} from '../packages/core/src/templates';
import {mkdir,writeFile} from 'node:fs/promises';
async function main(){const rows=fixtureRows().filter(r=>r.student.studentId==='BTU-T-0003');const s=snapshot(rows[0].student,rows.map(r=>r.award),1,'D1-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB');await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/btu-passport-demo.pdf',await renderPassportPdf(s));console.log('Preview: output/pdf/btu-passport-demo.pdf (not issued)')}
main().catch(e=>{console.error(e.message);process.exitCode=1});
