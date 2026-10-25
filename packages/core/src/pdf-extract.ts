import {inflateSync} from "node:zlib";
import jsQR from "jsqr";
import {decodeCode} from "./index";

export type PdfCodeDiscovery = {
  codes: string[];
  qrUrls: string[];
  unrelatedQrPayloads: string[];
};

export function extractCodeFromText(input: string): string[] {
  const matches = input.toUpperCase().match(/D1-[A-Z2-7]{32}/g) || [];
  const valid = new Set<string>();
  for (const m of matches) {
    try {
      decodeCode(m);
      valid.add(m);
    } catch {
      // Ignore non-canonical matches
    }
  }
  return [...valid];
}

export function extractVerificationCodesFromPdf(bytes: Uint8Array): PdfCodeDiscovery {
  const buf = Buffer.from(bytes);
  const codes = new Set<string>();
  const qrUrls = new Set<string>();
  const unrelatedQrPayloads = new Set<string>();

  const str = buf.toString("latin1");
  for (const c of extractCodeFromText(str)) codes.add(c);

  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(str)) !== null) {
    const dict = match[1] || "";
    const dataStart = match.index + match[0].length;
    const endIdx = str.indexOf("endstream", dataStart);
    if (endIdx < 0) continue;
    let sliceEnd = endIdx;
    if (str[sliceEnd - 1] === "\n") sliceEnd--;
    if (str[sliceEnd - 1] === "\r") sliceEnd--;
    const rawStream = buf.subarray(dataStart, sliceEnd);

    if (/\/Subtype\s*\/Image/.test(dict)) {
      const w = Number(dict.match(/\/Width\s+(\d+)/)?.[1]);
      const h = Number(dict.match(/\/Height\s+(\d+)/)?.[1]);
      if (!w || !h || w > 2048 || h > 2048) continue;
      try {
        const inflated = inflateSync(rawStream);
        let rgba: Uint8ClampedArray | null = null;
        if (inflated.length === w * h * 3) {
          rgba = new Uint8ClampedArray(w * h * 4);
          for (let i = 0, j = 0; i < inflated.length; i += 3, j += 4) {
            rgba[j] = inflated[i];
            rgba[j + 1] = inflated[i + 1];
            rgba[j + 2] = inflated[i + 2];
            rgba[j + 3] = 255;
          }
        } else if (inflated.length === w * h * 4) {
          rgba = new Uint8ClampedArray(inflated);
        } else if (inflated.length === w * h) {
          rgba = new Uint8ClampedArray(w * h * 4);
          for (let i = 0, j = 0; i < inflated.length; i++, j += 4) {
            rgba[j] = inflated[i];
            rgba[j + 1] = inflated[i];
            rgba[j + 2] = inflated[i];
            rgba[j + 3] = 255;
          }
        }
        if (rgba) {
          const decoded = jsQR(rgba, w, h);
          if (decoded?.data) {
            const found = extractCodeFromText(decoded.data);
            if (found.length > 0) {
              for (const c of found) codes.add(c);
              qrUrls.add(decoded.data);
            } else {
              unrelatedQrPayloads.add(decoded.data.slice(0, 200));
            }
          }
        }
      } catch {
        // Ignore non-deflate or masked image streams
      }
    } else if (/\/FlateDecode/.test(dict)) {
      try {
        const inflatedText = inflateSync(rawStream).toString("latin1");
        for (const c of extractCodeFromText(inflatedText)) codes.add(c);
      } catch {
        // Ignore undecodable streams
      }
    }
  }

  return {
    codes: [...codes],
    qrUrls: [...qrUrls],
    unrelatedQrPayloads: [...unrelatedQrPayloads],
  };
}
