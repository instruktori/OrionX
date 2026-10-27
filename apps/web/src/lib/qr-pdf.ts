"use client";
import QRCode from "qrcode";
import jsQR from "jsqr";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function isValidVerificationCode(input: string): boolean {
  const clean = input.trim().toUpperCase().replace(/[-\s]/g, "");
  if (!/^D1[A-Z2-7]{32}$/.test(clean)) return false;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean.slice(2)) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (out.length !== 20) return false;
  let reBits = 0;
  let reVal = 0;
  let s = "";
  for (const b of out) {
    reVal = (reVal << 8) | b;
    reBits += 8;
    while (reBits >= 5) {
      s += ALPHABET[(reVal >>> (reBits - 5)) & 31];
      reBits -= 5;
    }
  }
  return "D1" + s === clean;
}

export function extractCodesFromText(text: string): string[] {
  const matches = text.toUpperCase().match(/D1-[A-Z2-7]{32}/g) || [];
  const valid = new Set<string>();
  for (const m of matches) {
    if (isValidVerificationCode(m)) valid.add(m);
  }
  return [...valid];
}

export async function generateQrDataUrl(urlOrCode: string): Promise<string> {
  return QRCode.toDataURL(urlOrCode, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

async function inflateZlibBytes(raw: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const slice = format === "deflate-raw" && raw.length > 6 ? raw.subarray(2, raw.length - 4) : raw;
      writer.write(new Uint8Array(slice)).catch(() => {});
      writer.close().catch(() => {});
      const response = new Response(ds.readable);
      const ab = await response.arrayBuffer();
      return new Uint8Array(ab);
    } catch {
      // Try next format
    }
  }
  return null;
}

export async function discoverCodesFromPdfFile(file: File): Promise<{
  codes: string[];
  unrelatedQrPayloads: string[];
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const codes = new Set<string>();
  const unrelatedQrPayloads = new Set<string>();

  let str = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    str += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  for (const c of extractCodesFromText(str)) {
    codes.add(c);
  }

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
    const rawStream = bytes.subarray(dataStart, sliceEnd);

    if (/\/Subtype\s*\/Image/.test(dict)) {
      const w = Number(dict.match(/\/Width\s+(\d+)/)?.[1]);
      const h = Number(dict.match(/\/Height\s+(\d+)/)?.[1]);
      if (!w || !h || w > 2048 || h > 2048) continue;
      const inflated = await inflateZlibBytes(rawStream);
      if (!inflated) continue;
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
          const extracted = extractCodesFromText(decoded.data);
          if (extracted.length > 0) {
            for (const c of extracted) codes.add(c);
          } else {
            unrelatedQrPayloads.add(decoded.data.slice(0, 200));
          }
        }
      }
    } else if (/\/FlateDecode/.test(dict)) {
      const inflated = await inflateZlibBytes(rawStream);
      if (inflated && inflated.length < 500000) {
        let inflatedStr = "";
        for (let i = 0; i < inflated.length; i += chunk) {
          inflatedStr += String.fromCharCode(...inflated.subarray(i, i + chunk));
        }
        for (const c of extractCodesFromText(inflatedStr)) {
          codes.add(c);
        }
      }
    }
  }

  return {
    codes: [...codes],
    unrelatedQrPayloads: [...unrelatedQrPayloads],
  };
}

export async function decodeQrFromImageFile(file: File): Promise<{
  codes: string[];
  rawPayload: string | null;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Unable to load image file"));
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    if (!ctx) throw new Error("Canvas context unavailable");

    for (const maxDim of [1200, 800, 1800]) {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const decoded = jsQR(imageData.data, w, h);
      if (decoded?.data) {
        return {
          codes: extractCodesFromText(decoded.data),
          rawPayload: decoded.data,
        };
      }
    }
    return {codes: [], rawPayload: null};
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function decodeQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): {codes: string[]; rawPayload: string | null; frameReady: boolean; brightness?: number; corners?: {x: number; y: number}[]} {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h || video.readyState < 2) return {codes: [], rawPayload: null, frameReady: false};
  const scale = Math.min(1, 720 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  if (!ctx) throw new Error("Camera frame processing is unavailable");
  ctx.drawImage(video, 0, 0, cw, ch);
  const imageData = ctx.getImageData(0, 0, cw, ch);
  let brightness = 0, samples = 0;
  for (let i = 0; i < imageData.data.length; i += 64) {
    brightness += (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    samples++;
  }
  brightness /= Math.max(1, samples);
  const decoded = jsQR(imageData.data, cw, ch);
  if (decoded?.data) {
    return {
      codes: extractCodesFromText(decoded.data),
      rawPayload: decoded.data,
      frameReady: true,
      brightness,
      corners: [decoded.location.topLeftCorner, decoded.location.topRightCorner, decoded.location.bottomRightCorner, decoded.location.bottomLeftCorner].map(p => ({x: p.x / cw, y: p.y / ch})),
    };
  }
  return {codes: [], rawPayload: null, frameReady: true, brightness};
}
