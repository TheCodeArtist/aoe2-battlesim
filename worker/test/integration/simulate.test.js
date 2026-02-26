import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { SIMULATE_BODY } from '../fixtures.js';

async function simulate(body) {
  return SELF.fetch('http://example.com/simulate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

describe('POST /simulate', () => {
  it('returns 200 with winner field for a valid request', async () => {
    const res  = await simulate(SIMULATE_BODY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('winner');
    expect(body).toHaveProperty('draw');
  });

  it('returns 400 when side_a is missing', async () => {
    const res = await simulate({ side_b: { unit: 'skirm_fu_feudal', count: 10 } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for unknown unit key', async () => {
    const res = await simulate({ side_a: { unit: 'zzz_bad', count: 5 }, side_b: { unit: 'archer_fu_feudal', count: 5 } });
    expect(res.status).toBe(400);
  });

  it('CORS header is present on the response', async () => {
    const res = await simulate(SIMULATE_BODY);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('inline unit (Option C) returns a valid result', async () => {
    const res = await simulate({
      side_a: { unit: { name: 'X', hp: 30, patk: 5, parm: 1, marm: 1, reload: 2.0, range: 5 }, count: 5 },
      side_b: { unit: 'skirm_fu_feudal', count: 5 },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('winner');
  });
});
