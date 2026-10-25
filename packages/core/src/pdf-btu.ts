import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import {readFileSync} from 'node:fs';
import {repositoryResource} from './resources';
import type {Snapshot} from './index';
import type {TemplateAdapter} from './pdf';

/** Recomposition of BTU's supplied four-panel visual reference and original stamps.
 * It is deliberately labeled DEMO; supplied artwork does not authenticate an issuer.
 */
export async function renderBtuReferencePdf(s:Snapshot){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(readFileSync(repositoryResource('packages/core/assets/NotoSans-Regular.ttf')),{subset:true});
 const georgian=await doc.embedFont(readFileSync(repositoryResource('packages/core/assets/NotoSansGeorgian-Regular.ttf')),{subset:true});
 const latin=new Set(font.getCharacterSet()),geo=new Set(georgian.getCharacterSet());
 const runs=(value:string)=>{const out:{value:string;font:PDFFont}[]=[];for(const char of value.replace(/[\r\n\t]/g,' ')){const point=char.codePointAt(0)!,f=latin.has(point)?font:geo.has(point)?georgian:null;if(!f)throw Error('Unsupported PDF character');const last=out[out.length-1];if(last?.font===f)last.value+=char;else out.push({value:char,font:f})}return out};
 const width=(value:string,size:number)=>runs(value).reduce((a,r)=>a+r.font.widthOfTextAtSize(r.value,size),0);
 const text=(p:PDFPage,value:string,x:number,y:number,size=10,color=rgb(.08,.08,.08))=>{for(const r of runs(value)){p.drawText(r.value,{x,y,size,font:r.font,color});x+=r.font.widthOfTextAtSize(r.value,size)}};
 const wrap=(value:string,size:number,max:number)=>{const out:string[]=[];let line='';for(const word of value.split(/\s+/)){if(width(word,size)>max){if(line){out.push(line);line=''}for(const c of word){if(width(line+c,size)>max){out.push(line);line=''}line+=c}}else if(line&&width(line+' '+word,size)>max){out.push(line);line=word}else line+=(line?' ':'')+word}if(line)out.push(line);return out};
 const paragraph=(p:PDFPage,value:string,x:number,y:number,max:number,size=10)=>{for(const line of wrap(value,size,max)){text(p,line,x,y,size);y-=size*1.5}return y};
 const orange=rgb(1,.4,0),gray=rgb(.84,.84,.86);
 const page=(title:string,subtitle:string)=>{const p=doc.addPage([842,595]);p.drawRectangle({x:20,y:20,width:802,height:555,borderWidth:1,borderColor:gray});text(p,title,48,533,23);text(p,subtitle,48,510,10);p.drawLine({start:{x:48,y:494},end:{x:794,y:494},color:gray,thickness:1});return p};
 const stamps=new Map<string,Awaited<ReturnType<typeof doc.embedPng>>>();
 for(const [code,file]of [['BDG-AI-001','Artboard 3 (2).png'],['BDG-AI-002','Artboard 4 (1).png'],['BDG-AI-003','Artboard 5 (1).png']])stamps.set(code,await doc.embedPng(readFileSync(repositoryResource('packages/core/assets/btu/skills/'+file))));
 const stamp=(p:PDFPage,code:string,x:number,y:number,w:number,h:number)=>{const image=stamps.get(code);if(!image)throw Error('Unknown category stamp');const scale=Math.min(w/image.width,h/image.height);p.drawImage(image,{x:x+(w-image.width*scale)/2,y:y+(h-image.height*scale)/2,width:image.width*scale,height:image.height*scale})};
 const date=new Date(s.student.initialIssueDate+'T00:00:00Z');doc.setCreationDate(date);doc.setModificationDate(date);doc.setTitle(s.student.passportId+' V'+s.version);doc.setCreator('OrionX BTU reference adapter');doc.setProducer('OrionX btu-reference-v1');doc.setSubject('Fictional demo - issuer authority unconfirmed');
 const cover=page('AI SKILLS','DIGITAL PASSPORT');
 cover.drawRectangle({x:48,y:470,width:260,height:17,color:orange});text(cover,'DEMO - NOT BTU ISSUED',55,475,9);
 let y=420;text(cover,'NAME',48,y,10);y=paragraph(cover,s.student.firstName,48,y-28,400,24)-20;text(cover,'SURNAME',48,y,10);paragraph(cover,s.student.lastName,48,y-28,400,24);
 text(cover,'ORIGINAL DATE OF ISSUE',500,420,10);text(cover,s.student.initialIssueDate,500,394,17);
 const coverStamp=await doc.embedPng(readFileSync(repositoryResource('packages/core/assets/btu/cover/3_1@3x.png')));cover.drawImage(coverStamp,{x:510,y:210,width:240,height:123});
 text(cover,'PASSPORT ID: '+s.student.passportId,48,185,12);text(cover,'VERSION '+s.version+' | '+s.awards.length+' CUMULATIVE AWARDS',48,158,10);
 text(cover,'VERIFICATION CODE',48,125,9);text(cover,s.code,48,105,11);
 const url=new URL('/verify',s.verificationOrigin||process.env.VERIFICATION_PUBLIC_ORIGIN||'http://localhost:3000');url.searchParams.set('code',s.code);const qr=await doc.embedPng(await QRCode.toBuffer(url.toString(),{width:180,margin:1}));cover.drawImage(qr,{x:690,y:65,width:75,height:75});
 const about=page('ABOUT THE AI SKILLS DIGITAL PASSPORT','Understanding the three category stamps');
 paragraph(about,'This fictional demonstration preserves cumulative skill awards from the BTU hackathon test dataset. A permanent passport identity remains unchanged as new versions add skills. Original versions remain independently verifiable after later updates.',48,456,290,11);
 paragraph(about,'Use the version code for public registration lookup. Upload the exact issued PDF to compare every byte. Solana Devnet registration and verified university issuer identity are separate checks.',48,285,290,11);
 let sy=440;for(const [category,code,description]of [['AI Skill','BDG-AI-001','Focused learning'],['AI Applied Skill','BDG-AI-002','Applied learning'],['AI Advanced Skill','BDG-AI-003','Extended academic learning']]){stamp(about,code,380,sy-65,95,75);text(about,category,500,sy-10,14);text(about,description,500,sy-32,10);text(about,code,500,sy-52,9);sy-=125}
 for(let start=0;start<Math.max(1,s.awards.length);start+=10){const grid=page('VERIFIED AI SKILLSET','Category stamps supplied by BTU | Fictional test awards');
  for(const [i,a]of s.awards.slice(start,start+10).entries()){const x=48+(i%5)*150,top=470-Math.floor(i/5)*192;grid.drawRectangle({x,y:top-178,width:138,height:178,borderWidth:.7,borderColor:gray});text(grid,a.dateEarned,x+9,top-17,8);stamp(grid,a.badgeCode,x+15,top-102,108,70);let ty=top-118;for(const line of wrap(a.name,9,120)){if(ty<top-158)throw Error('Skill title exceeds reference grid capacity');text(grid,line,x+9,ty,9);ty-=12}text(grid,a.badgeCode,x+9,top-169,7)}
 }
 const columns=[48,140,320,650,794];
 let detail=page('AI SKILLS DETAILED INFORMATION','Full original award descriptions and earned dates'),rowY=460;
 const header=()=>{for(const [i,label]of ['STAMP TYPE','SKILL','DESCRIPTION','DATE EARNED'].entries())text(detail,label,columns[i]+8,rowY,9);rowY-=18};header();
 for(const a of s.awards){const names=wrap(a.name,10,164),descriptions=wrap(a.description,9,310);const height=Math.max(80,Math.max(names.length*14,descriptions.length*13)+22);
  if(height>350)throw Error('Award text exceeds reference page capacity');
  if(rowY-height<80){detail=page('AI SKILLS DETAILED INFORMATION','Continued cumulative award record');rowY=460;header()}
  detail.drawRectangle({x:48,y:rowY-height,width:746,height,borderWidth:.7,borderColor:gray});for(const x of columns.slice(1,-1))detail.drawLine({start:{x,y:rowY},end:{x,y:rowY-height},color:gray,thickness:.7});stamp(detail,a.badgeCode,55,rowY-height+12,76,height-24);paragraph(detail,a.name,148,rowY-21,164,10);paragraph(detail,a.description,328,rowY-21,310,9);text(detail,a.dateEarned,658,rowY-21,10);rowY-=height;
 }
 doc.getPages().forEach((p,i)=>{text(p,s.student.passportId+' | V'+s.version+' | '+(i+1)+' / '+doc.getPageCount(),48,37,8);text(p,'DEMO / SOLANA DEVNET / BTU AUTHORITY UNCONFIRMED',430,37,8)});
 return doc.save({useObjectStreams:false});
}
export const btuTemplate:TemplateAdapter={revision:'btu-reference-v1',render:renderBtuReferencePdf};
