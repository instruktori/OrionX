import {describe, expect, it} from 'vitest';
import {fixtureRows, fixtureValues} from './fixtures';
import {isoDate, parseSheetRows} from './sheets';
import {renderDemoPdf} from './pdf';
import {snapshot, sha256} from './index';
import {PDFDocument} from 'pdf-lib';

describe('canonical fixture acceptance', () => {
 it('reconstructs exact populations, categories and simulated statuses', () => {
   const rows=fixtureRows();
   expect(rows).toHaveLength(60);
   expect(new Set(rows.map(r=>r.student.studentId)).size).toBe(18);
   expect(new Set(rows.map(r=>r.student.passportId)).size).toBe(18);
   expect(new Set(rows.map(r=>r.award.skillId)).size).toBe(16);
   expect(new Set(rows.map(r=>r.award.recordId)).size).toBe(60);
   expect(rows.filter(r=>r.syncStatus==='SYNCED')).toHaveLength(16);
   expect(rows.filter(r=>r.syncStatus==='NOT SYNCED')).toHaveLength(44);
   expect(rows.filter(r=>r.syncStatus==='NOT SYNCED'&&r.award.dateEarned<'2026-10-17')).toHaveLength(32);
   expect(['AI Skill','AI Applied Skill','AI Advanced Skill'].map(c=>rows.filter(r=>r.award.category===c).length)).toEqual([23,21,16]);
   expect(rows.filter(r=>r.student.status==='Graduate')).toHaveLength(7);
   expect(rows[4].award.recordId).toBe('REC-0049');
 });
 it('rejects partial rows, duplicates and impossible dates',()=>{
   const values=fixtureValues();
   expect(()=>parseSheetRows([...values,["S1"]])).toThrow('Partial source row');
   expect(()=>parseSheetRows([...values,values[4]])).toThrow('Duplicate');
   expect(()=>isoDate('2026-02-30')).toThrow();
 });
 it('renders stable multi-page Unicode artifacts from a frozen snapshot',async()=>{
   const rows=fixtureRows().filter(r=>r.student.studentId==='BTU-T-0003');
   const frozen=snapshot({...rows[0].student,firstName:'ნინო'},rows.map(r=>r.award),1,'D1-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB');
   const a=await renderDemoPdf(frozen),b=await renderDemoPdf(frozen);
   expect(sha256(a)).toBe(sha256(b));
   const pdf=await PDFDocument.load(a);expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
 });
});

it('retains absolute row numbers when a live named range starts at row 4',()=>{
 const values=fixtureValues();expect(parseSheetRows(values.slice(3),4)[0].rowNumber).toBe(5);
});

it('renders the supplied reference layout and actual category stamps',async()=>{
 const {renderPassportPdf}=await import('./templates');const rows=fixtureRows().filter(r=>r.student.studentId==='BTU-T-0003');
 const s=snapshot(rows[0].student,rows.map(r=>r.award),1,'D1-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB');s.templateRevision='btu-reference-v1';
 const bytes=await renderPassportPdf(s);expect((await PDFDocument.load(bytes)).getPageCount()).toBe(5);
 expect(sha256(bytes)).toBe(sha256(await renderPassportPdf(s)));
});
