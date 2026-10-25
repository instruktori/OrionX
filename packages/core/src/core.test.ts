import {describe,it,expect} from "vitest";
import {decodeCode,encodeCode,reconcile,sha256,newCode,snapshot,extractVerificationCodesFromPdf} from "./index";
import {fixtureRows} from "./fixtures";
import {renderDemoPdf} from "./pdf";
import {renderBtuReferencePdf} from "./pdf-btu";

describe("passport security",()=>{
  it("roundtrips exactly 20 random-code bytes",()=>{const bytes=Uint8Array.from({length:20},(_,i)=>i);expect(Array.from(decodeCode(encodeCode(bytes)))).toEqual(Array.from(bytes))});
  it("rejects malformed codes",()=>expect(()=>decodeCode("D1-NOT-VALID")).toThrow());
  it("detects exact-byte modification",()=>expect(sha256(Buffer.from("pdf"))).not.toBe(sha256(Buffer.from("pdf\n"))));
  it("rejects history removal",()=>{const a={recordId:"r",studentId:"s",skillId:"k",name:"AI",category:"AI Skill" as const,badgeCode:"BDG-AI-001",description:"ok",dateEarned:"2026-10-01"};expect(()=>reconcile([a],[])).toThrow();expect(()=>reconcile([a],[{...a,name:"changed"}])).toThrow()});
  it("auto-discovers embedded QR verification code from both Demo and BTU PDF templates",async()=>{
    const row=fixtureRows()[0];
    const code=newCode();
    const snap=snapshot(row.student,[row.award],1,code);
    const demoBytes=await renderDemoPdf(snap);
    const btuBytes=await renderBtuReferencePdf(snap);
    expect(extractVerificationCodesFromPdf(demoBytes).codes).toEqual([code]);
    expect(extractVerificationCodesFromPdf(btuBytes).codes).toEqual([code]);
  });
});
