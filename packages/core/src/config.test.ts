import {afterEach, describe, expect, it, vi} from 'vitest';
import {supabaseAuthConfig, supabaseStorageConfig, supabaseUrl} from './config';
import {SupabaseArtifactStore, artifactStore} from './storage';

const url = 'https://example.supabase.co';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Supabase configuration', () => {
  it('derives JWT verification settings from the configured project', () => {
    expect(supabaseAuthConfig({SUPABASE_URL: url + '/'})).toEqual({issuer: url + '/auth/v1', audience: 'authenticated', jwksUrl: url + '/auth/v1/.well-known/jwks.json'});
    expect(() => supabaseAuthConfig({})).toThrow('Authentication not configured');
    expect(supabaseAuthConfig({SUPABASE_URL: url, AUTH_JWT_AUDIENCE: 'custom'}).audience).toBe('custom');
  });
  it('rejects insecure remote URLs and public keys for backend storage', () => {
    expect(() => supabaseUrl({SUPABASE_URL: 'http://example.com'})).toThrow('HTTPS');
    expect(() => supabaseStorageConfig({SUPABASE_URL: url, SUPABASE_SECRET_KEY: 'sb_publishable_public'})).toThrow('secret key');
    expect(() => supabaseStorageConfig({SUPABASE_URL: url, SUPABASE_SECRET_KEY: 'sb_secret_test', SUPABASE_STORAGE_BUCKET: '../public'})).toThrow('SUPABASE_STORAGE_BUCKET');
  });
  it('sends modern secret keys only as apikey, preserves immutable writes, and reads private PDFs', async () => {
    vi.stubEnv('SUPABASE_URL', url);
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('pdf'));
    vi.stubGlobal('fetch', fetchMock);
    const store = new SupabaseArtifactStore();
    await store.putOnce('demo/test.pdf', new Uint8Array([1]));
    expect(fetchMock.mock.calls[0][0]).toBe(url + '/storage/v1/object/passport-pdfs/demo/test.pdf');
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers.apikey).toBe('sb_secret_test');
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.headers['x-upsert']).toBe('false');
    expect(Buffer.from(await store.get('demo/test.pdf')).toString()).toBe('pdf');
    await expect(store.get('../escape.pdf')).rejects.toThrow('Unsafe artifact key');
  });
  it('retains legacy service-role support', () => {
    const key = `header.${Buffer.from(JSON.stringify({role: 'service_role'})).toString('base64url')}.signature`;
    expect(supabaseStorageConfig({SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key}).headers.Authorization).toBe('Bearer ' + key);
  });
  it('fails closed for invalid storage modes and ephemeral cloud storage', () => {
    vi.stubEnv('STORAGE_MODE', 'typo');
    expect(() => artifactStore()).toThrow('STORAGE_MODE');
    vi.stubEnv('STORAGE_MODE', 'local');
    vi.stubEnv('VERCEL', '1');
    expect(() => artifactStore()).toThrow('durable artifacts');
  });
});

it('recognizes Supabase missing objects returned as HTTP 400 with a 404 body', async () => {
  vi.stubEnv('SUPABASE_URL',url);vi.stubEnv('SUPABASE_SECRET_KEY','sb_secret_test');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({statusCode:'404',error:'not_found'}),{status:400})));
  const {optionalArtifact}=await import('./storage');
  expect(await optionalArtifact(new SupabaseArtifactStore(),'absent.pdf')).toBeNull();
});
