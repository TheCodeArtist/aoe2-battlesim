import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /scenarios', () => {
  it('returns 200 with an array of scenarios', async () => {
    const res  = await SELF.fetch('http://example.com/scenarios');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('each scenario has id, name, desc fields', async () => {
    const body = await (await SELF.fetch('http://example.com/scenarios')).json();
    body.forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('desc');
    });
  });
});

describe('POST /scenarios/:id/simulate', () => {
  it('returns 200 with winner for a valid scenario (no body)', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   '{}',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('winner');
  });

  it('returns 404 for an unknown scenario id', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/no_such_scenario/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   '{}',
    });
    expect(res.status).toBe(404);
  });

  it('accepts overrides in the request body', async () => {
    const res = await SELF.fetch('http://example.com/scenarios/archers_vs_skirms/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ side_a: { count: 100 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.winner).toBe('side_a');
  });
});
