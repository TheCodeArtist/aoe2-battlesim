import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('CORS + preflight', () => {
  it('OPTIONS /simulate returns 204 with CORS headers', async () => {
    const res = await SELF.fetch('http://example.com/simulate', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('every successful response includes CORS header', async () => {
    const res = await SELF.fetch('http://example.com/units');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('routing', () => {
  it('returns 404 for unknown paths', async () => {
    const res = await SELF.fetch('http://example.com/unknown-path');
    expect(res.status).toBe(404);
  });

  it('returns 405 for GET on POST-only /simulate', async () => {
    const res = await SELF.fetch('http://example.com/simulate', { method: 'GET' });
    expect(res.status).toBe(405);
  });

  it('routes POST /simulate to the simulate handler (not 404)', async () => {
    const res = await SELF.fetch('http://example.com/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Will be 400 (bad input) or 200 once handler is implemented; must not be 404/405
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(405);
  });

  it('routes GET /units to the catalog handler (not 404)', async () => {
    const res = await SELF.fetch('http://example.com/units');
    expect(res.status).not.toBe(404);
  });

  it('routes POST /scenarios/:id/simulate correctly', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(405);
  });
});
