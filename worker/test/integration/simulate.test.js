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

describe('POST /simulate/batch', () => {
  it('returns an array of results tagged with ids', async () => {
    const res = await SELF.fetch('http://example.com/simulate/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        matchups: [
          { id: 'run_1', ...SIMULATE_BODY },
          { id: 'run_2', side_a: SIMULATE_BODY.side_b, side_b: SIMULATE_BODY.side_a },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('run_1');
    expect(body[0]).toHaveProperty('winner');
  });

  it('returns 400 for empty matchups array', async () => {
    const res = await SELF.fetch('http://example.com/simulate/batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ matchups: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /simulate/sweep', () => {
  it('returns sweep_param, breakeven, and results', async () => {
    const res = await SELF.fetch('http://example.com/simulate/sweep', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        side_a: { unit: 'archer_fu_feudal' },
        side_b: { unit: 'skirm_fu_feudal', count: 10 },
        sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('breakeven');
    expect(body.results.every(r => 'winner' in r)).toBe(true);
  });

  it('returns 400 for invalid sweep target', async () => {
    const res = await SELF.fetch('http://example.com/simulate/sweep', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        side_a: { unit: 'archer_fu_feudal', count: 5 },
        side_b: { unit: 'skirm_fu_feudal',  count: 5 },
        sweep:  { target: 'invalid.field', range: { min: 1, max: 5, step: 1 } },
      }),
    });
    expect(res.status).toBe(400);
  });
});
