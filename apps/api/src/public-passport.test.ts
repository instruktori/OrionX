import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import type {AddressInfo} from "node:net";
import {prisma} from "@orionx/db";
import {artifactStore, encodeCode, sha256, verifyDevnet} from "@orionx/core";

vi.mock("@orionx/core", async importOriginal => ({
  ...await importOriginal<typeof import("@orionx/core")>(),
  verifyDevnet: vi.fn(), artifactStore: vi.fn(),
}));

const code = encodeCode(new Uint8Array(20).fill(7));
const pdf = Buffer.from("%PDF-1.7\noriginal passport fixture");
const get = vi.fn();
const registered = {revocation: "VALID", registration: "REGISTERED", integrity: "MATCH", currency: "LATEST", issuerTrust: "UNCONFIRMED", officialBtu: false, version: 2, pdfSha256: sha256(pdf), message: "Verified", checkedAt: new Date().toISOString()} as const;
let app: Awaited<ReturnType<typeof import("./server").createApp>>;
let origin: string;

beforeAll(async () => {
  process.env.ORIONX_SKIP_LISTEN = "1";
  const {createApp} = await import("./server");
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/v1/verify`;
});
afterAll(async () => { await app.close(); });
afterEach(() => { vi.restoreAllMocks(); });
beforeEach(() => {
  vi.spyOn(prisma.version, "findUnique").mockResolvedValue({storageKey: "private/original.pdf", finalizedSlot: 10n} as never);
  get.mockReset().mockResolvedValue(pdf);
  vi.mocked(artifactStore).mockReturnValue({get, putOnce: vi.fn()});
  vi.mocked(verifyDevnet).mockReset().mockImplementation(async (_code, bytes) => ({...registered, integrity: bytes ? "MATCH" : "NOT_CHECKED"}));
});

const request = (suffix: string) => fetch(`${origin}/${code}${suffix}`);

describe("public original passport retrieval over HTTP", () => {
  it("returns proof and public document links without a session or exposing storage keys", async () => {
    const res = await request("/original");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({registration: "REGISTERED", integrity: "MATCH", officialBtu: false, verifiedCode: code, documentSource: "stored-original", original: {available: true, viewUrl: `/api/v1/verify/${code}/document`}});
    expect(JSON.stringify(body)).not.toContain("private/original.pdf");
    expect(verifyDevnet).toHaveBeenCalledWith(code, pdf);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the checked original inline and supports download", async () => {
    for (const [suffix, disposition] of [["/document", "inline"], ["/document?download=1", "attachment"]]) {
      const res = await request(suffix);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/pdf");
      expect(res.headers.get("content-disposition")).toBe(`${disposition}; filename="passport-v2.pdf"`);
      expect(Buffer.from(await res.arrayBuffer())).toEqual(pdf);
    }
  });

  it("withholds a corrupted artifact even when a chain record exists", async () => {
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, integrity: "MISMATCH", errorCode: "DOCUMENT_TAMPERED"});
    const proof = await request("/original");
    expect(proof.status).toBe(422);
    expect(await proof.json()).toMatchObject({original: {available: false}, integrity: "MISMATCH"});
    const document = await request("/document");
    expect(document.status).toBe(422);
    expect(document.headers.get("content-type")).toContain("application/json");
  });

  it("does not expose an original when RPC verification is unavailable", async () => {
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, registration: "UNKNOWN", integrity: "NOT_CHECKED", errorCode: "RPC_UNAVAILABLE"});
    const res = await request("/document");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({original: {available: false}});
  });

  it("does not substitute the newest version for a historical QR", async () => {
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, currency: "SUPERSEDED", version: 1});
    const res = await request("/original");
    expect(await res.json()).toMatchObject({currency: "SUPERSEDED", version: 1, original: {available: true}});
    expect(prisma.version.findUnique).toHaveBeenCalledWith(expect.objectContaining({where: {code}}));
  });

  it("preserves chain registration when storage fails and provides no document link", async () => {
    get.mockRejectedValue(new Error("storage unavailable"));
    const res = await request("/original");
    const body = await res.json();
    expect(body).toMatchObject({registration: "REGISTERED", integrity: "NOT_CHECKED", original: {available: false, errorCode: "ORIGINAL_UNAVAILABLE"}});
    expect(body.original.viewUrl).toBeUndefined();
    expect((await request("/document")).status).toBe(503);
  });

  it.each([null, {storageKey: "private/draft.pdf", finalizedSlot: null}])("never retrieves a missing or unfinalized artifact: %s", async version => {
    vi.mocked(prisma.version.findUnique).mockResolvedValue(version as never);
    const res = await request("/original");
    expect(await res.json()).toMatchObject({original: {available: false, errorCode: "ORIGINAL_NOT_FOUND"}});
    expect(get).not.toHaveBeenCalled();
    expect((await request("/document")).status).toBe(404);
  });

  it("returns unknown-code proof without serving PDF bytes", async () => {
    vi.mocked(prisma.version.findUnique).mockResolvedValue(null);
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, registration: "UNKNOWN", integrity: "NOT_CHECKED", errorCode: "UNKNOWN_CODE"});
    expect((await request("/original")).status).toBe(404);
  });

  it("rejects malformed codes before accessing the database", async () => {
    const res = await fetch(`${origin}/invalid/original`);
    expect(res.status).toBe(400);
    expect(prisma.version.findUnique).not.toHaveBeenCalled();
  });

  it("keeps the existing record-only endpoint unchanged", async () => {
    const res = await request("");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({integrity: "NOT_CHECKED"});
    expect(prisma.version.findUnique).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("keeps the existing PDF upload endpoint available", async () => {
    const form = new FormData();
    form.set("code", code);
    form.set("file", new Blob([pdf], {type: "application/pdf"}), "passport.pdf");
    const res = await fetch(`${origin}/file`, {method: "POST", body: form});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({registration: "REGISTERED", integrity: "MATCH", verifiedCode: code});
    expect(get).not.toHaveBeenCalled();
  });
  it("withholds revoked byte-identical originals and preserves MATCH integrity", async () => {
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, revocation: "REVOKED", errorCode: "CREDENTIAL_REVOKED", message: "This version was revoked"});
    const res = await request("/original");
    expect(await res.json()).toMatchObject({revocation: "REVOKED", integrity: "MATCH", original: {available: false}});
    const document = await request("/document");
    expect(document.status).toBe(409);
    expect(document.headers.get("content-type")).toContain("application/json");
  });
  it("withholds bytes when revocation status cannot be established", async () => {
    vi.mocked(verifyDevnet).mockResolvedValue({...registered, revocation: "UNKNOWN"});
    expect((await (await request("/original")).json()).original.available).toBe(false);
  });

});
