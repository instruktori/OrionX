import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Prisma} from '@prisma/client';
import {queueLiveWritebacks} from './sync';
import {fixtureRows} from './fixtures';
import {inputFingerprint} from './sheets';

afterEach(() => vi.unstubAllEnvs());
describe('transition from fixture issuance to live Sheets', () => {
 it('queues writeback of existing Devnet proofs without creating another version', async () => {
  vi.stubEnv('SOURCE_MODE', 'sheets');
  vi.stubEnv('GOOGLE_SHEET_ID', 'demo-sheet');
  const rows = fixtureRows().slice(0, 2);
  const tx = {
   sheetWriteback: {findMany: vi.fn().mockResolvedValue(rows.map((row, i) => ({id: 'writeback-' + i, recordId: row.award.recordId, versionId: 'v1'}))), update: vi.fn()},
   job: {upsert: vi.fn()}, version: {update: vi.fn(), create: vi.fn()}, auditEvent: {create: vi.fn()},
  };
  await queueLiveWritebacks(tx as unknown as Prisma.TransactionClient, rows);
  expect(tx.sheetWriteback.update).toHaveBeenCalledTimes(2);
  expect(tx.sheetWriteback.update.mock.calls[0][0].data.expectedFingerprint).toBe(inputFingerprint(rows[0]));
  expect(tx.job.upsert).toHaveBeenCalledTimes(1);
  expect(tx.job.upsert.mock.calls[0][0].create).toMatchObject({stage: 'WRITEBACK', versionId: 'v1'});
  expect(tx.version.create).not.toHaveBeenCalled();
 });

 it('does nothing in fixture mode', async () => {
  vi.stubEnv('SOURCE_MODE', 'fixture');
  const tx = {sheetWriteback: {findMany: vi.fn()}};
  await queueLiveWritebacks(tx as unknown as Prisma.TransactionClient, fixtureRows());
  expect(tx.sheetWriteback.findMany).not.toHaveBeenCalled();
 });
});
