import {PDFDocument, rgb, type PDFFont, type PDFPage} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import type {Snapshot} from "./index";

export interface TemplateAdapter { revision: string; render(snapshot: Snapshot): Promise<Uint8Array> }
export const templateManifest = {revision: "demo-v2", official: false, pageSize: [595, 842], badgeAssets: "CATEGORY CODE PLACEHOLDERS", renderer: "pdf-lib with bundled Noto Unicode fonts"} as const;
const ink = rgb(.12, .13, .2), muted = rgb(.38, .4, .46), accent = rgb(.32, .27, .65);

export async function renderDemoPdf(s: Snapshot) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await Promise.all(["NotoSans-Regular.ttf", "NotoSansGeorgian-Regular.ttf"].map(name => doc.embedFont(readFileSync(resolve(__dirname, "../assets", name)), {subset: true})));
  const glyphs = fonts.map(f => new Set(f.getCharacterSet()));
  const parts = (value: string): {value: string; font: PDFFont}[] => {
    const segments: {value: string; font: PDFFont}[] = [];
    for (const char of value.replace(/[\r\n\t]/g, " ")) {
      const index = glyphs.findIndex(set => set.has(char.codePointAt(0)!));
      if (index < 0) throw Error("Unsupported template character: U+" + char.codePointAt(0)!.toString(16));
      const font = fonts[index], last = segments[segments.length - 1];
      if (last?.font === font) last.value += char; else segments.push({value: char, font});
    }
    return segments;
  };
  const width = (value: string, size: number) => parts(value).reduce((n, p) => n + p.font.widthOfTextAtSize(p.value, size), 0);
  const lines = (value: string, size: number, max = 505) => {
    const result: string[] = []; let line = "";
    for (const word of value.split(/\s+/)) {
      if (width(word, size) > max) {
        if (line) { result.push(line); line = ""; }
        for (const char of word) { if (width(line + char, size) > max) { result.push(line); line = ""; } line += char; }
      } else if (line && width(line + " " + word, size) > max) { result.push(line); line = word; }
      else line += (line ? " " : "") + word;
    }
    if (line) result.push(line); return result;
  };
  const text = (page: PDFPage, value: string, x: number, y: number, size = 11, color = ink) => {
    for (const p of parts(value)) { page.drawText(p.value, {x, y, size, font: p.font, color}); x += p.font.widthOfTextAtSize(p.value, size); }
  };
  const created = new Date(s.student.initialIssueDate + "T00:00:00Z");
  doc.setCreationDate(created); doc.setModificationDate(created);
  doc.setTitle("OrionX " + s.student.passportId + " V" + s.version);
  doc.setSubject("SYNTHETIC DEMO ONLY - NOT BTU AUTHORIZED");
  doc.setProducer("OrionX demo-v2"); doc.setCreator("OrionX");
  const cover = doc.addPage([595, 842]);
  cover.drawRectangle({x: 0, y: 760, width: 595, height: 82, color: rgb(.14, .12, .3)});
  text(cover, "ORIONX / AI SKILLS PASSPORT", 45, 793, 18, rgb(1, 1, 1));
  text(cover, "DEMO - NOT BTU ISSUED", 45, 725, 13, accent);
  let y = 655;
  for (const line of lines(s.student.firstName + " " + s.student.lastName, 25)) { text(cover, line, 45, y, 25); y -= 34; }
  for (const value of ["Passport: " + s.student.passportId, "Original issue date: " + s.student.initialIssueDate, "Version: " + s.version + " | Cumulative awards: " + s.awards.length, s.student.program + " | " + s.student.educationLevel]) {
    for (const line of lines(value, 12)) { y -= 25; text(cover, line, 45, y, 12); }
  }
  const origin = s.verificationOrigin || process.env.VERIFICATION_PUBLIC_ORIGIN || "http://localhost:3000";
  const url = new URL("/verify", origin); url.searchParams.set("code", s.code);
  const qr = await doc.embedPng(await QRCode.toBuffer(url.toString(), {width: 180, margin: 1}));
  cover.drawImage(qr, {x: 45, y: 160, width: 108, height: 108});
  text(cover, "Verification code", 170, 247, 10, muted);
  text(cover, s.code, 170, 224, 11, accent);
  text(cover, "Solana Devnet | issuer authority unconfirmed", 170, 199, 9, muted);
  for (const [i, line] of lines(url.toString(), 9).entries()) text(cover, line, 45, 130 - i * 13, 9, muted);
  text(cover, "A printed code alone does not establish blockchain registration.", 45, 88, 9, muted);
  let page = doc.addPage([595, 842]); y = 750;
  const heading = () => text(page, "SKILLS AND ACHIEVEMENTS", 45, 793, 17, accent);
  heading();
  for (const award of s.awards) {
    const title = lines(award.name, 13), description = lines(award.description, 10), category = lines(award.category + " | Earned " + award.dateEarned, 10);
    const blockHeight = title.length * 19 + category.length * 15 + 20 + description.length * 15 + 26;
    if (blockHeight > 640) throw Error("Award description exceeds template page capacity");
    if (y - blockHeight < 85) { page = doc.addPage([595, 842]); y = 750; heading(); }
    for (const line of title) { text(page, line, 45, y, 13); y -= 19; }
    for (const line of category) { text(page, line, 45, y, 10, muted); y -= 15; }
    text(page, "Category stamp placeholder: " + award.badgeCode, 45, y, 9, accent); y -= 20;
    for (const line of description) { text(page, line, 45, y, 10); y -= 15; }
    y -= 26;
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => text(p, s.student.passportId + " | V" + s.version + " | Page " + (i + 1) + " of " + pages.length, 45, 40, 9, muted));
  return doc.save({useObjectStreams: false});
}
export const demoTemplate: TemplateAdapter = {revision: templateManifest.revision, render: renderDemoPdf};
