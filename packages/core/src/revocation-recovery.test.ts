import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {prisma} from "@orionx/db";
import {processRevocation} from "./revocation";
import {verifyDevnet} from "./solana";
import {signRevocation,broadcast,attemptStatus} from "./chain-issuer";
vi.mock("./solana",()=>({verifyDevnet:vi.fn()}));
vi.mock("./chain-issuer",()=>({signRevocation:vi.fn(),broadcast:vi.fn(),attemptStatus:vi.fn()}));
const issuance={code:"D1-CODE",number:2,pdfSha256:"hash",chainProgramId:"program",versionPda:"record"};
const request={id:"r",versionId:"v",actorId:"admin",reasonDigest:"reason",actorDigest:"actor",version:issuance};
const valid={registration:"REGISTERED",revocation:"VALID",version:2,pdfSha256:"hash",programId:"program",versionPda:"record"} as const;
const attempt={id:"attempt",signature:"signature",transactionBytes:"bytes",blockhash:"blockhash",lastValidBlockHeight:100n};
const fence=vi.fn(),check=vi.fn();
let tx:{revocation:{update:ReturnType<typeof vi.fn>};revocationAttempt:{create:ReturnType<typeof vi.fn>;update:ReturnType<typeof vi.fn>};auditEvent:{create:ReturnType<typeof vi.fn>}};
beforeEach(()=>{
 vi.mocked(verifyDevnet).mockResolvedValue(valid as never);vi.mocked(signRevocation).mockResolvedValue(attempt);vi.mocked(broadcast).mockResolvedValue(undefined);vi.mocked(attemptStatus).mockResolvedValue("PENDING");
 vi.spyOn(prisma.revocation,"findUniqueOrThrow").mockResolvedValue(request as never);vi.spyOn(prisma.revocationAttempt,"findFirst").mockResolvedValue(null);
 tx={revocation:{update:vi.fn()},revocationAttempt:{create:vi.fn().mockResolvedValue(attempt),update:vi.fn()},auditEvent:{create:vi.fn()}};
 vi.spyOn(prisma.revocationAttempt,"update").mockImplementation(tx.revocationAttempt.update as never);
 vi.spyOn(prisma,"$transaction").mockImplementation((async (fn: (db: unknown)=>unknown)=>fn(tx)) as never);
 fence.mockResolvedValue(undefined);check.mockResolvedValue(undefined);
});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();});
describe("durable revocation recovery",()=>{
 it("does not complete a database intent when the chain is unavailable",async()=>{
  vi.mocked(verifyDevnet).mockResolvedValue({registration:"UNKNOWN",errorCode:"RPC_UNAVAILABLE"} as never);
  await expect(processRevocation("v",check,fence)).rejects.toMatchObject({code:"RPC_UNAVAILABLE"});
  expect(tx.revocation.update).not.toHaveBeenCalled();expect(signRevocation).not.toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();
 });
 it("persists a fenced signed attempt and returns before any broadcast",async()=>{
  await processRevocation("v",check,fence);
  expect(fence).toHaveBeenCalledWith(tx,true);expect(tx.revocationAttempt.create).toHaveBeenCalledWith({data:{...attempt,revocationId:"r"}});
  expect(broadcast).not.toHaveBeenCalled();expect(tx.revocation.update).not.toHaveBeenCalled();
 });
 it("broadcasts the existing persisted bytes on the next claim",async()=>{
  vi.mocked(prisma.revocationAttempt.findFirst).mockResolvedValue(attempt as never);
  await processRevocation("v",check,fence);
  expect(broadcast).toHaveBeenCalledWith(attempt);expect(signRevocation).not.toHaveBeenCalled();expect(tx.revocationAttempt.update).toHaveBeenCalledWith({where:{id:"attempt"},data:{state:"SUBMITTED"}});
 });
 it("recovers finalized chain success after a server crash without signing or sending again",async()=>{
  const revocationEvidence={pda:"tombstone",revokedSlot:"120",revokedUnix:"100",reasonDigest:"onchain",actorDigest:"onchain",authority:"issuer"};
  vi.mocked(verifyDevnet).mockResolvedValue({...valid,revocation:"REVOKED",revocationEvidence} as never);
  await processRevocation("v",check,fence);
  expect(fence).toHaveBeenCalledWith(tx,false);expect(tx.revocation.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({state:"REVOKED",finalizedSlot:120n,revocationPda:"tombstone"})}));
  expect(signRevocation).not.toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();expect(prisma.revocationAttempt.findFirst).not.toHaveBeenCalled();
 });
 it("never reports finality merely because a transaction was observed",async()=>{
  vi.mocked(prisma.revocationAttempt.findFirst).mockResolvedValue(attempt as never);vi.mocked(attemptStatus).mockResolvedValue("OBSERVED");
  await processRevocation("v",check,fence);expect(fence).toHaveBeenCalledWith(tx,true);expect(tx.revocation.update).not.toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();
 });
 it("a lost lease fences transaction persistence",async()=>{
  fence.mockRejectedValue(Error("lease lost"));await expect(processRevocation("v",check,fence)).rejects.toThrow("lease lost");expect(tx.revocationAttempt.create).not.toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();
 });
 it("rejects reconciliation against a different issuance hash",async()=>{
  vi.mocked(verifyDevnet).mockResolvedValue({...valid,pdfSha256:"different"} as never);await expect(processRevocation("v",check,fence)).rejects.toMatchObject({code:"PROOF_CONFLICT"});expect(signRevocation).not.toHaveBeenCalled();
 });
});

describe("revocation retry boundaries",()=>{
 it("reconciles absence and expiry before reserving a replacement attempt",async()=>{
  vi.mocked(prisma.revocationAttempt.findFirst).mockResolvedValue(attempt as never);vi.mocked(attemptStatus).mockResolvedValue("EXPIRED");
  await processRevocation("v",check,fence);
  expect(tx.revocationAttempt.update).toHaveBeenCalledWith({where:{id:"attempt"},data:{state:"EXPIRED"}});
  expect(tx.revocationAttempt.create).toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();
 });
 it("does not silently replace an explicitly rejected transaction",async()=>{
  vi.mocked(prisma.revocationAttempt.findFirst).mockResolvedValue(attempt as never);vi.mocked(attemptStatus).mockResolvedValue("FAILED");
  await expect(processRevocation("v",check,fence)).rejects.toMatchObject({code:"CHAIN_REJECTED"});expect(signRevocation).not.toHaveBeenCalled();expect(broadcast).not.toHaveBeenCalled();
 });
 it("retains the persisted attempt across a submission outage",async()=>{
  vi.mocked(prisma.revocationAttempt.findFirst).mockResolvedValue(attempt as never);vi.mocked(broadcast).mockRejectedValue(Error("transport failed"));
  await expect(processRevocation("v",check,fence)).rejects.toThrow("transport failed");expect(signRevocation).not.toHaveBeenCalled();expect(tx.revocation.update).not.toHaveBeenCalled();expect(tx.revocationAttempt.create).not.toHaveBeenCalled();
 });
});
