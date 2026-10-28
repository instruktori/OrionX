import {PDFDocument, rgb, type PDFPage, type PDFFont} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import {readFileSync} from "node:fs";
import {repositoryResource} from "./resources";
import type {Snapshot, Award} from "./index";
import type {TemplateAdapter} from "./pdf";

/**
 * BTU-supplied visual composite (2 columns x 2 rows) is the authoritative
 * background, preserving its exact logo, original type, graphics and frame.
 * Only variable fields are inserted on top of the reference's blank areas.
 *
 * This is a NEW immutable template revision. Previously finalized PDFs keep
 * their original bytes, hashes and Solana records.
 */
export async function renderBtuVisualPdf(s: Snapshot): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const background = await doc.embedPng(readFileSync(repositoryResource("packages/core/assets/btu/reference.png")));
  const regular = await doc.embedFont(readFileSync(repositoryResource("packages/core/assets/NotoSans-Regular.ttf")), {subset:true});
  const georgian = await doc.embedFont(readFileSync(repositoryResource("packages/core/assets/NotoSansGeorgian-Regular.ttf")), {subset:true});
  const latin = new Set(regular.getCharacterSet()), geo = new Set(georgian.getCharacterSet());
  const black = rgb(0.035,0.035,0.035), white = rgb(1,1,1), border = rgb(0.72,0.72,0.72);
  const size = [842,595] as const;
  const parts = (value: string): {value:string; font:PDFFont}[] => {
    const result: {value:string; font:PDFFont}[] = [];
    for (const char of value.replace(/[\r\n\t]/g, " ")) {
      const cp = char.codePointAt(0)!;
      const font = latin.has(cp) ? regular : geo.has(cp) ? georgian : undefined;
      if (!font) throw Error("BTU PDF: unsupported glyph U+"+cp.toString(16));
      const last = result[result.length-1];
      if (last?.font===font) last.value+=char; else result.push({value:char,font});
    }
    return result;
  };
  const width = (value:string,pt:number) => parts(value).reduce((n,x)=>n+x.font.widthOfTextAtSize(x.value,pt),0);
  const text = (p:PDFPage, value:string, x:number, y:number, pt=9, color=black) => {
    for (const part of parts(value)) {
      p.drawText(part.value, {x,y,size:pt,font:part.font,color});
      x+=part.font.widthOfTextAtSize(part.value,pt);
    }
  };
  const wrap = (value:string,pt:number,max:number) => {
    const lines:string[]=[];let line="";
    for (const word of value.split(/\s+/).filter(Boolean)) {
      if (width(word,pt)>max) {
        if (line) {lines.push(line);line="";}
        for(const c of word) {
          if(line && width(line+c,pt)>max){lines.push(line);line="";}
          line+=c;
        }
      } else if (line && width(line+" "+word,pt)>max) {lines.push(line);line=word;}
      else line+=(line?" ":"")+word;
    }
    if(line)lines.push(line);
    return lines.length ? lines : ["—"];
  };
  const fitText=(p:PDFPage,value:string,x:number,y:number,max:number,pt=11) => {
    const fontSize=Math.max(6,Math.min(pt,pt*max/Math.max(1,width(value,pt))));
    text(p,value,x,y,fontSize);
  };
  const paragraph=(p:PDFPage,value:string,x:number,y:number,maxWidth:number,maxHeight:number,initialPt=9) => {
    let pt=initialPt;
    let lines=wrap(value,pt,maxWidth);
    while(lines.length*pt*1.28>maxHeight && pt>5.5) {pt-=0.5;lines=wrap(value,pt,maxWidth);}
    if(lines.length*pt*1.28>maxHeight) throw Error("BTU PDF text exceeds allotted cell: "+value.slice(0,50));
    for(const line of lines) {text(p,line,x,y,pt);y-=pt*1.28;}
  };
  // Each 1000x706 region of the supplied 2000x1413 composite maps to
  // one full 842x595 page; PDF's media box clips neighboring quadrants.
  const page = (col:0|1,row:0|1) => {
    const p=doc.addPage(size);
    p.drawImage(background,{x:-col*size[0],y:row===0?-size[1]:0,width:size[0]*2,height:size[1]*2});
    return p;
  };
  const footer=(p:PDFPage) => text(p,"DEMO ISSUER · UNIVERSITY AUTHORIZATION UNCONFIRMED",425,9,7,white);
  const pngs = new Map<string,Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const [code,name] of [["BDG-AI-001","Artboard 3 (2).png"],["BDG-AI-002","Artboard 4 (1).png"],["BDG-AI-003","Artboard 5 (1).png"]]) {
    pngs.set(code,await doc.embedPng(readFileSync(repositoryResource("packages/core/assets/btu/skills/"+name))));
  }
  const stamp=(p:PDFPage,award:Award,x:number,y:number,w:number,h:number)=>{
    const im=pngs.get(award.badgeCode);if(!im)throw Error("Unsupported BTU stamp: "+award.badgeCode);
    const ratio=Math.min(w/im.width,h/im.height);
    p.drawImage(im,{x:x+(w-im.width*ratio)/2,y:y+(h-im.height*ratio)/2,width:im.width*ratio,height:im.height*ratio});
  };
  const date = new Date(s.student.initialIssueDate+"T00:00:00Z");
  doc.setTitle("BTU AI Skills Digital Passport "+s.student.passportId+" / V"+s.version);
  doc.setCreationDate(date);doc.setModificationDate(date);
  doc.setCreator("OrionX / BTU artwork adapter");
  doc.setProducer("OrionX btu-visual-v2");
  doc.setSubject("DEMONSTRATION ONLY - BTU issuer authorization unconfirmed");

  const cover=page(0,0);
  fitText(cover,s.student.firstName,250,327,200,20);
  fitText(cover,s.student.lastName,250,287,200,20);
  text(cover,s.student.initialIssueDate,530,313,15);
  fitText(cover,s.student.passportId,682,102,125,11);
  footer(cover);

  const about=page(1,0);
  fitText(about,s.student.passportId,147,103,150,10);
  const url=new URL("/verify",s.verificationOrigin||process.env.VERIFICATION_PUBLIC_ORIGIN||"http://localhost:3000");
  url.searchParams.set("code",s.code);
  const qr=await doc.embedPng(await QRCode.toBuffer(url.toString(),{width:240,margin:1}));
  // QR goes on the cover's blank information field, not over BTU artwork.
  cover.drawRectangle({x:359,y:94,width:87,height:100,color:white});
  cover.drawImage(qr,{x:369,y:105,width:67,height:67});
  text(cover,"SCAN TO VERIFY",367,97,7);
  footer(about);

  const skillCount=Math.max(1,Math.ceil(s.awards.length/10));
  for(let block=0;block<skillCount;block++){
    const p=page(0,1);
    const items=s.awards.slice(block*10,block*10+10);
    // The sample marks in the supplied reference must not be presented as
    // this student's verified skills; clear the sample grid and refill it.
    p.drawRectangle({x:76,y:140,width:694,height:317,color:white});
    for(let i=0;i<10;i++){
      const x=77+(i%5)*140, top=455-Math.floor(i/5)*161, y=top-151;
      p.drawRectangle({x,y,width:131,height:151,color:white,borderColor:border,borderWidth:0.7});
      p.drawLine({start:{x,y:top-22},end:{x:x+131,y:top-22},color:border,thickness:0.5});
      const a=items[i];if(!a)continue;
      fitText(p,a.dateEarned,x+7,top-16,117,8);
      stamp(p,a,x+18,top-88,95,62);
      paragraph(p,a.name.toUpperCase(),x+7,top-104,117,38,9);
      fitText(p,a.category.toUpperCase(),x+6,y+9,119,7.5);
    }
    fitText(p,s.student.passportId,685,105,120,10);
    footer(p);
  }

  const detailCount=Math.max(1,Math.ceil(s.awards.length/5));
  for(let block=0;block<detailCount;block++){
    const p=page(1,1);
    const items=s.awards.slice(block*5,block*5+5);
    const x0=81, top=442, widths=[123,112,130,175,142], header=38, rowH=54;
    const total=widths.reduce((a,b)=>a+b,0);
    p.drawRectangle({x:x0,y:top-header-5*rowH,width:total,height:header+5*rowH,color:white,borderColor:border,borderWidth:0.7});
    let cx=x0;
    for(let i=0;i<widths.length;i++){
      if(i>0)p.drawLine({start:{x:cx,y:top},end:{x:cx,y:top-header-5*rowH},color:border,thickness:0.7});
      cx+=widths[i];
    }
    for(let i=0;i<=5;i++){
      const y=top-header-i*rowH;
      p.drawLine({start:{x:x0,y},end:{x:x0+total,y},color:border,thickness:0.7});
    }
    cx=x0;
    for(const [i,label] of ["STAMP TYPE","SKILL","DESCRIPTION","EARNED THROUGH","DATE EARNED"].entries()){
      fitText(p,label,cx+6,top-24,widths[i]-12,10);cx+=widths[i];
    }
    for(let i=0;i<items.length;i++){
      const a=items[i],rowTop=top-header-i*rowH,rowBottom=rowTop-rowH;
      stamp(p,a,x0+12,rowBottom+5,97,44);
      paragraph(p,a.name.toUpperCase(),x0+widths[0]+6,rowTop-12,widths[1]-12,42,8.4);
      paragraph(p,a.description||"—",x0+widths[0]+widths[1]+6,rowTop-10,widths[2]-12,45,7.4);
      text(p,"—",x0+widths[0]+widths[1]+widths[2]+77,rowTop-26,9);
      paragraph(p,a.dateEarned,x0+total-widths[4]+6,rowTop-23,widths[4]-12,30,8.2);
    }
    fitText(p,s.student.passportId,145,105,150,10);
    footer(p);
  }

  // A verification QR and exact version code appear on the document but do
  // NOT claim official BTU issuer authenticity in demo mode.
  text(about,"VERIFICATION ID",365,103,8);
  fitText(about,s.code,365,85,375,10);
  text(about,"VERSION "+s.version+" · Solana Devnet",365,70,8);
  return doc.save({useObjectStreams:false});
}
export const btuVisualTemplate:TemplateAdapter={revision:"btu-visual-v2",render:renderBtuVisualPdf};
