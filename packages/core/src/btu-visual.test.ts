import {describe,expect,it} from "vitest";
import {PDFDocument} from "pdf-lib";
import {fixtureRows} from "./fixtures";
import {snapshot,sha256} from "./index";
import {renderBtuVisualPdf} from "./pdf-btu-visual";

describe("BTU supplied artwork-backed PDF revision",()=>{
  const rows=fixtureRows();
  it("renders all canonical students as landscape, multi-page, deterministic PDFs",async()=>{
    const ids=[...new Set(rows.map(x=>x.student.studentId))];
    for(const id of ids){
      const records=rows.filter(x=>x.student.studentId===id);
      const s=snapshot(records[0].student,records.map(x=>x.award),1,"D1-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB");
      s.templateRevision="btu-visual-v2";
      const a=await renderBtuVisualPdf(s),b=await renderBtuVisualPdf(s);
      expect(sha256(a)).toBe(sha256(b));
      const doc=await PDFDocument.load(a);
      expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
      expect(doc.getPages().every(p=>p.getWidth()===842&&p.getHeight()===595)).toBe(true);
      expect(a.byteLength).toBeGreaterThan(80000);
    }
  },120000);
});
