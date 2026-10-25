import {afterEach, describe, expect, it, vi} from 'vitest';
vi.mock('@orionx/db', () => ({prisma: {importRun: {findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn()}, $transaction: vi.fn()}}));
import {prisma} from '@orionx/db';
import {synchronize} from './sync';
import {fixtureRows} from './fixtures';

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('durable import retries', () => {
 it('retries a failed import instead of treating the failed run as completed work', async () => {
  vi.stubEnv('SOURCE_MODE', 'fixture');
  const failed = {id: 'run', state: 'FAILED', sourceId: 'fixture'};
  vi.mocked(prisma.importRun.findUnique).mockResolvedValue(failed as never);
  vi.mocked(prisma.importRun.upsert).mockResolvedValue({...failed, state: 'RUNNING'} as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (work: any) => work({$queryRaw: vi.fn(), importRun: {findUniqueOrThrow: vi.fn().mockResolvedValue({...failed, state: 'COMPLETED'})}}));
  const result = await synchronize('retry-key', 'test', fixtureRows());
  expect(prisma.importRun.updateMany).toHaveBeenCalledWith({where: {id: 'run', state: 'FAILED'}, data: {state: 'RUNNING', error: null, completedAt: null}});
  expect(prisma.$transaction).toHaveBeenCalledOnce();
  expect(result.state).toBe('COMPLETED');
 });
 it('preserves completed imports on replay', async () => {
  vi.mocked(prisma.importRun.findUnique).mockResolvedValue({id: 'run', state: 'COMPLETED'} as never);
  const result = await synchronize('done-key', 'test', fixtureRows());
  expect(result.state).toBe('COMPLETED');
  expect(prisma.importRun.updateMany).not.toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
 });
});
