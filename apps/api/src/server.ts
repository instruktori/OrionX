import "reflect-metadata";
import {NestFactory} from "@nestjs/core";
import {Module, Controller, Get, Post, Param, Req, Res, Body, HttpCode, Catch, type ArgumentsHost, type ExceptionFilter, HttpException} from "@nestjs/common";
import type {Request, Response} from "express";
import {randomUUID} from "node:crypto";
import {prisma} from "@orionx/db";
import {decodeCode, verifyDevnet, sha256, artifactStore, authenticate, requireAdmin, type Snapshot} from "@orionx/core";
import {DomainError} from "@orionx/core/src/errors";
import {queueSynchronization} from "@orionx/core/src/sync";
import {supabaseStorageConfig, supabaseAuthConfig} from "@orionx/core/src/config";
import {z} from "zod";
import multer from "multer";
const cookie = (req: Request, key: string) => (req.headers.cookie || "").split(";").map(c => c.trim()).find(c => c.startsWith(key + "="))?.slice(key.length + 1);
async function identity(req: Request) { return authenticate(req.headers.authorization || (cookie(req, "orionx_access") ? "Bearer " + cookie(req, "orionx_access") : undefined)); }
async function admin(req: Request) { const id = await identity(req); requireAdmin(id); return id; }
const summary = (v: {number: number; state: string; code: string; pageCount: number | null; createdAt: Date; finalizedAt: Date | null; snapshot: unknown; chainCluster?: string | null}, latest: number) => ({version: v.number, state: v.state, verificationCode: v.code, pageCount: v.pageCount, createdAt: v.createdAt, finalizedAt: v.finalizedAt, isLatest: v.number === latest, originalIssueDate: (v.snapshot as Snapshot).student.initialIssueDate, skillAwardCount: (v.snapshot as Snapshot).awards.length, issuerTrust: "DEMO", cluster: v.chainCluster || "devnet"});
const safeJSON = (value: unknown) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v));
@Catch()
class Errors implements ExceptionFilter {
 catch(error: unknown, host: ArgumentsHost) {
  const res = host.switchToHttp().getResponse<Response>();
  const known = error instanceof DomainError, http = error instanceof HttpException;
  const status = known ? error.status : http ? error.getStatus() : 503;
  res.status(status).json({error: {code: known ? error.code : status === 404 ? "NOT_FOUND" : "SERVICE_UNAVAILABLE", message: known ? error.message : status === 404 ? "Route not found" : "Service unavailable; try again later", retryable: known ? error.retryable : status >= 500}, correlationId: res.getHeader("X-Correlation-Id")});
 }
}
@Controller("api/v1")
class ApiController {
 @Get("health/live") live() { return {status: "ok", service: "orionx-api"}; }
 @Get("health/ready") async ready() {
  try { await prisma.$queryRaw`SELECT 1`; return {status: "ok", issuance: process.env.CHAIN_MODE === "devnet" ? "configured" : "offline", source: process.env.SOURCE_MODE || "fixture"}; }
  catch { throw new DomainError("NOT_READY", "Database unavailable", 503, true); }
 }
 @Post("auth/login") @HttpCode(200) async login(@Body() body: unknown, @Res() res: Response) {
  const parsed = z.object({email: z.string().email().max(254), password: z.string().min(1).max(256)}).safeParse(body);
  if (!parsed.success) throw new DomainError("INVALID_REQUEST", "Email and password required", 400);
  const config = supabaseStorageConfig();
  const response = await fetch(config.url + "/auth/v1/token?grant_type=password", {method: "POST", headers: {apikey: config.headers.apikey, "Content-Type": "application/json"}, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new DomainError("UNAUTHENTICATED", "Unable to sign in with these credentials", 401);
  const session = await response.json();
  const verified = await authenticate("Bearer " + session.access_token);
  this.sessionCookies(res, session);
  res.setHeader("Cache-Control", "no-store"); res.json({role: verified.role});
 }
 private sessionCookies(res: Response, session: {access_token: string; refresh_token: string; expires_in: number}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", ["orionx_access=" + session.access_token + "; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=" + Math.min(session.expires_in || 3600, 3600) + secure, "orionx_refresh=" + session.refresh_token + "; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800" + secure]);
 }
 @Post("auth/refresh") @HttpCode(200) async refresh(@Req() req: Request, @Res() res: Response) {
  const refresh = cookie(req, "orionx_refresh"); if (!refresh) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
  const config = supabaseStorageConfig();
  const response = await fetch(config.url + "/auth/v1/token?grant_type=refresh_token", {method: "POST", headers: {apikey: config.headers.apikey, "Content-Type": "application/json"}, body: JSON.stringify({refresh_token: refresh}), signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new DomainError("UNAUTHENTICATED", "Session expired", 401);
  const session = await response.json(); await authenticate("Bearer " + session.access_token); this.sessionCookies(res, session); res.json({ok: true});
 }
 @Post("auth/logout") @HttpCode(200) async logout(@Res() res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", ["orionx_access=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0" + secure, "orionx_refresh=; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=0" + secure]); res.json({ok: true});
 }
 @Get("auth/session") async session(@Req() req: Request, @Res() res: Response) { const user = await identity(req); res.setHeader("Cache-Control", "no-store"); res.json({role: user.role, studentId: user.studentId}); }
 @Post("admin/sync") @HttpCode(202) async sync(@Req() req: Request) { const user = await admin(req); return queueSynchronization(String(req.headers["idempotency-key"] || randomUUID()), user.subject); }
 @Get("admin/sync-runs/:id") async syncRun(@Req() req: Request, @Param("id") id: string) { await admin(req); const run = await prisma.importRun.findUnique({where: {id}, include: {conflicts: {take: 100}}}); if (!run) throw new DomainError("NOT_FOUND", "Run not found", 404); return run; }
 @Get("admin/passports") async passports(@Req() req: Request) { await admin(req); return prisma.passport.findMany({take: 100, include: {student: {select: {externalId: true, firstName: true, lastName: true, program: true}}, _count: {select: {versions: true}}}, orderBy: {publicId: "asc"}}); }
 @Get("admin/passports/:id/versions") async versions(@Req() req: Request, @Param("id") id: string) { await admin(req); return safeJSON(await prisma.version.findMany({where: {passport: {publicId: id}}, take: 100, orderBy: {number: "desc"}})); }
 @Get("admin/audit") async audit(@Req() req: Request) { await admin(req); return prisma.auditEvent.findMany({take: 100, orderBy: {createdAt: "desc"}}); }
 @Post("admin/jobs/:id/retry") async retry(@Req() req: Request, @Param("id") id: string) {
  const user = await admin(req), job = await prisma.job.findUnique({where: {id}});
  if (!job || !["FAILED_PERMANENT", "RETRY_WAIT", "STORED"].includes(job.state)) throw new DomainError("NOT_RETRYABLE", "Job requires conflict resolution or is already active");
  await prisma.$transaction([prisma.job.update({where: {id}, data: {state: "QUEUED", attempts: 0, availableAt: new Date(), leaseOwner: null, leaseUntil: null}}), prisma.auditEvent.create({data: {actorId: user.subject, action: "JOB_RETRIED", targetId: id, detail: {stage: job.stage}}})]); return {ok: true};
 }
 private async ownPassport(req: Request) {
  const user = await identity(req);
  if (!user.studentId) throw new DomainError("NOT_FOUND", "No student passport binding", 404);
  const passport = await prisma.passport.findUnique({where: {studentId: user.studentId}, include: {student: true}});
  if (!passport) throw new DomainError("NOT_FOUND", "Passport not found", 404); return passport;
 }
 @Get("me/passport") async myPassport(@Req() req: Request, @Res() res: Response) {
  const passport = await this.ownPassport(req), latest = await prisma.version.findUnique({where: {passportId_number: {passportId: passport.id, number: passport.latestFinalizedVersion}}});
  res.setHeader("Cache-Control", "no-store"); res.json({passportId: passport.publicId, originalIssueDate: passport.initialIssueDate.toISOString().slice(0, 10), student: {firstName: passport.student.firstName, lastName: passport.student.lastName, program: passport.student.program, educationLevel: passport.student.educationLevel}, latest: latest ? summary(latest, passport.latestFinalizedVersion) : null, pending: !!passport.activeVersionId});
 }
 @Get("me/passport/versions") async myVersions(@Req() req: Request, @Res() res: Response) {
  const passport = await this.ownPassport(req), versions = await prisma.version.findMany({where: {passportId: passport.id, finalizedSlot: {not: null}}, take: 100, orderBy: {number: "desc"}});
  res.setHeader("Cache-Control", "no-store"); res.json(versions.map(v => ({...summary(v, passport.latestFinalizedVersion), awards: (v.snapshot as unknown as Snapshot).awards})));
 }
 @Get("me/passport/versions/:version/download") async download(@Req() req: Request, @Res() res: Response, @Param("version") number: string) {
  const passport = await this.ownPassport(req);
  if (!/^[1-9]\d{0,8}$/.test(number)) throw new DomainError("INVALID_REQUEST", "Invalid version", 400);
  const version = await prisma.version.findUnique({where: {passportId_number: {passportId: passport.id, number: Number(number)}}});
  if (!version?.finalizedSlot || !version.storageKey) throw new DomainError("NOT_FOUND", "Issued version not found", 404);
  const bytes = await artifactStore().get(version.storageKey);
  if (sha256(bytes) !== version.pdfSha256) throw new DomainError("ARTIFACT_CORRUPTED", "Stored document failed integrity validation", 503);
  res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", 'attachment; filename="passport-v' + version.number + '.pdf"'); res.send(Buffer.from(bytes));
 }
 @Get("verify/:code") async verify(@Param("code") code: string, @Res() res: Response) {
  try { decodeCode(code); } catch { throw new DomainError("INVALID_CODE", "Malformed verification code", 400); }
  const proof = await verifyDevnet(code);
  res.setHeader("Cache-Control", "no-store"); res.status(proof.registration === "REGISTERED" ? 200 : proof.errorCode === "UNKNOWN_CODE" ? 404 : 503).json(proof);
 }
 @Post("verify/file") async verifyFile(@Req() req: Request, @Res() res: Response) {
  const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 128, parts: 2}}).single("file");
  await new Promise<void>((resolve, reject) => upload(req, res, error => error ? reject(new DomainError("UPLOAD_LIMIT", "Upload exceeds multipart limits", 413)) : resolve()));
  const code = String(req.body?.code || ""); try { decodeCode(code); } catch { throw new DomainError("INVALID_CODE", "Malformed verification code", 400); }
  if (!req.file || req.file.mimetype !== "application/pdf" || req.file.buffer.subarray(0, 5).toString() !== "%PDF-") throw new DomainError("INVALID_PDF", "A PDF file is required", 415);
  const proof = await verifyDevnet(code, req.file.buffer); req.file.buffer.fill(0);
  res.setHeader("Cache-Control", "no-store"); res.status(proof.registration !== "REGISTERED" ? proof.errorCode === "UNKNOWN_CODE" ? 404 : 503 : proof.integrity === "MISMATCH" ? 422 : 200).json(proof);
 }
}
@Module({controllers: [ApiController]}) class AppModule {}
export async function createApp() {
 const app = await NestFactory.create(AppModule, {bodyParser: true});
 // Vercel terminates TLS and supplies the immediate proxy's forwarded headers.
 if (process.env.VERCEL === "1") app.getHttpAdapter().getInstance().set("trust proxy", 1);
 app.useGlobalFilters(new Errors());
 const buckets = new Map<string, {count: number; expires: number}>();
 app.use((req: Request, res: Response, next: () => void) => {
  res.setHeader("X-Correlation-Id", randomUUID()); res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin, allowed = process.env.WEB_ORIGIN || process.env.VERIFICATION_PUBLIC_ORIGIN;
  if (req.method === "POST" && ((origin && origin !== (allowed || req.protocol + "://" + req.headers.host)) || (!origin && req.headers.cookie && !req.headers.authorization))) { res.status(403).json({error: {code: "INVALID_ORIGIN", message: "Request origin rejected"}}); return; }
  const category = req.path.includes("/verify/file") ? "upload" : req.path.includes("/auth/") ? "auth" : "request";
  const key = req.ip + ":" + category, now = Date.now();
  let bucket = buckets.get(key); if (!bucket || bucket.expires < now) { bucket = {count: 0, expires: now + 60000}; buckets.set(key, bucket); }
  const limit = category === "upload" ? 5 : category === "auth" ? 20 : 60;
  if (++bucket.count > limit) { res.setHeader("Retry-After", "60"); res.status(429).json({error: {code: "RATE_LIMITED", message: "Try again later", retryable: true}}); return; }
  if (buckets.size > 10000) for (const [k, v] of buckets) if (v.expires < now) buckets.delete(k);
  next();
 });
 if (process.env.WEB_ORIGIN) app.enableCors({origin: process.env.WEB_ORIGIN, credentials: true, methods: ["GET", "POST"]});
 return app;
}
createApp().then(app => app.listen(Number(process.env.PORT || 4000), "0.0.0.0")).catch(() => { console.error("Unable to start API"); process.exitCode = 1; });
