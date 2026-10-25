import {afterEach, describe, expect, it, vi} from 'vitest';
import {setTimeout as delay} from 'node:timers/promises';
import {LeaseLostError, renewJobLease, withJobLease, jobRetryDelay} from './jobs';
import type {PrismaClient} from '@prisma/client';

afterEach(() => vi.restoreAllMocks());

describe('worker lease maintenance', () => {
 it('allows a quota window to recover instead of exhausting retries in seconds', () => {
  expect(jobRetryDelay({response: {status: 429}}, 1)).toBe(60000);
  expect(jobRetryDelay({response: {status: 429, headers: new Headers({'retry-after': '120'})}}, 1)).toBe(120000);
  expect(jobRetryDelay(new Error('network'), 2)).toBe(4000);
 });
 it('keeps renewing a slow stage and stops after it finishes', async () => {
  const renew = vi.fn().mockResolvedValue(undefined);
  await withJobLease(renew, 60, async check => {
   await delay(110);
   await check();
  });
  expect(renew.mock.calls.length).toBeGreaterThanOrEqual(3);
  const count = renew.mock.calls.length;
  await delay(50);
  expect(renew).toHaveBeenCalledTimes(count);
 });

 it('prevents the next side effect after a renewal failure', async () => {
  const renew = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new LeaseLostError());
  const broadcast = vi.fn();
  await expect(withJobLease(renew, 30, async check => {
   await delay(50);
   await check();
   broadcast();
  })).rejects.toThrow('lease lost');
  expect(broadcast).not.toHaveBeenCalled();
 });

 it('does not start work when the claim has expired', async () => {
  const work = vi.fn();
  await expect(withJobLease(async () => { throw new LeaseLostError(); }, 30, work)).rejects.toThrow('lease lost');
  expect(work).not.toHaveBeenCalled();
 });

 it('uses database time and refuses to resurrect an expired or reassigned lease', async () => {
  const execute = vi.fn().mockResolvedValue(0);
  await expect(renewJobLease({$executeRaw: execute} as unknown as PrismaClient, 'public', 'job', 'owner', 1000)).rejects.toBeInstanceOf(LeaseLostError);
  const query = execute.mock.calls[0][0];
  expect(query.sql).toContain('"leaseUntil">NOW()');
  expect(query.sql).toContain('"public"."Job"');
  expect(query.values).toContain('owner');
 });
});
