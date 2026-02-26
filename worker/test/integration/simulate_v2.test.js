import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';
import { SIMULATE_BODY_V2, HALBERDIER_SPEC_V2, CAVALIER_SPEC_V2 } from '../fixtures.js';

async function post(path, body) {
  return SELF.fetch(`http://example.com${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

describe('POST /simulate/v2', () => {
  it('returns 200 with winner and draw fields', async () => {
    const res  = await post('/simulate/v2', SIMULATE_BODY_V2);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('winner');
    expect(body).toHaveProperty('draw');
  });

  it('halberdiers beat cavalry (20 halbs vs 10 cavaliers)', async () => {
    const res  = await post('/simulate/v2', SIMULATE_BODY_V2);
    const body = await res.json();
    // Halberdiers have heavy cavalry bonus — side_a should win
    expect(body.winner).toBe('side_a');
    expect(body.side_b.remaining_count).toBe(0);
  });

  it('CORS header is present', async () => {
    const res = await post('/simulate/v2', SIMULATE_BODY_V2);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 400 when side_a is missing', async () => {
    const res  = await post('/simulate/v2', { side_b: CAVALIER_SPEC_V2 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for unknown unit key', async () => {
    const res = await post('/simulate/v2', {
      side_a: { unit: 'zzz_unknown_unit', count: 10 },
      side_b: CAVALIER_SPEC_V2,
    });
    expect(res.status).toBe(400);
  });

  it('include_history:true returns non-null history array', async () => {
    const res  = await post('/simulate/v2', { ...SIMULATE_BODY_V2, options: { include_history: true } });
    const body = await res.json();
    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThan(0);
  });
});

describe('POST /simulate/v2/batch', () => {
  it('returns an array of results tagged with ids', async () => {
    const res = await post('/simulate/v2/batch', {
      matchups: [
        { id: 'run_1', ...SIMULATE_BODY_V2 },
        { id: 'run_2', side_a: CAVALIER_SPEC_V2, side_b: HALBERDIER_SPEC_V2 },
      ],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('run_1');
    expect(body[0]).toHaveProperty('winner');
  });

  it('returns 400 for empty matchups array', async () => {
    const res = await post('/simulate/v2/batch', { matchups: [] });
    expect(res.status).toBe(400);
  });
});

describe('POST /simulate/v2/sweep', () => {
  it('returns sweep_param, breakeven, and results', async () => {
    const res = await post('/simulate/v2/sweep', {
      side_a: HALBERDIER_SPEC_V2,
      side_b: { unit: 'britons_cavalier', count: 10 },
      sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('breakeven');
    expect(body).toHaveProperty('results');
    expect(body.results.every(r => 'winner' in r)).toBe(true);
  });
});
