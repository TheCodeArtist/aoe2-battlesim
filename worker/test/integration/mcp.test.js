import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

async function mcp(body) {
  return SELF.fetch('http://example.com/mcp', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body:    JSON.stringify(body),
  });
}

describe('initialize', () => {
  it('returns protocolVersion 2025-03-26', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.protocolVersion).toBe('2025-03-26');
    expect(body.result.capabilities).toHaveProperty('tools');
    expect(body.result.serverInfo.name).toBe('aoe2-battlesim');
  });
});

describe('notifications/initialized', () => {
  it('returns 202 (notification - no id)', async () => {
    const res = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res.status).toBe(202);
  });
});

describe('GET /mcp', () => {
  it('returns 405 (SSE stream not offered - Streamable HTTP transport signal)', async () => {
    const res = await SELF.fetch('http://example.com/mcp', {
      method:  'GET',
      headers: { 'Accept': 'text/event-stream' },
    });
    expect(res.status).toBe(405);
  });
});

describe('tools/list', () => {
  it('returns all 12 tools', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.tools).toHaveLength(12);
    const names = result.tools.map(t => t.name);
    expect(names).toContain('simulate');
    expect(names).toContain('simulate_v2');
    expect(names).toContain('simulate_v2_batch');
    expect(names).toContain('simulate_v2_sweep');
    expect(names).toContain('run_scenario');
    expect(names).toContain('simulate_sweep');
  });
});

describe('tools/call - simulate', () => {
  it('returns isError:false and winner in text', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'simulate',
        arguments: {
          side_a: { unit: 'archer_fu_feudal', count: 10 },
          side_b: { unit: 'skirm_fu_feudal',  count: 10 },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('winner');
  });

  it('returns isError:true for bad input', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'simulate', arguments: { side_a: { unit: 'zzz_bad' }, side_b: {} } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBeTruthy();
  });
});

describe('tools/call - simulate_sweep', () => {
  it('returns breakeven in parsed text', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: {
        name: 'simulate_sweep',
        arguments: {
          side_a: { unit: 'archer_fu_feudal' },
          side_b: { unit: 'skirm_fu_feudal', count: 10 },
          sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('breakeven');
  });
});

describe('tools/call - get_unit', () => {
  it('returns archer stat fields', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'get_unit', arguments: { id: 'archer' } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hp).toBeGreaterThan(0);
  });
});

describe('tools/call - get_preset', () => {
  it('returns preset stat fields', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 7, method: 'tools/call',
      params: { name: 'get_preset', arguments: { id: 'archer_fu_feudal' } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hp).toBeDefined();
  });
});

describe('tools/call - simulate_v2', () => {
  it('runs a v2 battle with civ-prefixed unit keys and returns winner', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 10, method: 'tools/call',
      params: {
        name: 'simulate_v2',
        arguments: {
          side_a: { unit: 'britons_halberdier', count: 20 },
          side_b: { unit: 'britons_cavalier',   count: 10 },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('winner');
    expect(parsed.winner).toBe('side_a');
  });

  it('returns isError:true for an unknown v2 unit key', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 11, method: 'tools/call',
      params: {
        name: 'simulate_v2',
        arguments: {
          side_a: { unit: 'zzz_bad_unit', count: 5 },
          side_b: { unit: 'britons_cavalier', count: 5 },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
  });
});

describe('tools/call - simulate_v2_batch', () => {
  it('returns an array of results tagged with ids', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 12, method: 'tools/call',
      params: {
        name: 'simulate_v2_batch',
        arguments: {
          matchups: [
            { id: 'run_1', side_a: { unit: 'britons_halberdier', count: 20 }, side_b: { unit: 'britons_cavalier', count: 10 } },
            { id: 'run_2', side_a: { unit: 'britons_cavalier', count: 10 }, side_b: { unit: 'britons_halberdier', count: 20 } },
          ],
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('run_1');
    expect(parsed[0]).toHaveProperty('winner');
  });

  it('returns isError:true for empty matchups', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 13, method: 'tools/call',
      params: { name: 'simulate_v2_batch', arguments: { matchups: [] } },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
  });
});

describe('tools/call - simulate_v2_sweep', () => {
  it('returns breakeven in parsed text', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 14, method: 'tools/call',
      params: {
        name: 'simulate_v2_sweep',
        arguments: {
          side_a: { unit: 'britons_halberdier' },
          side_b: { unit: 'britons_cavalier', count: 10 },
          sweep:  { target: 'side_a.count', range: { min: 1, max: 30, step: 1 } },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(false);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty('breakeven');
    expect(parsed).toHaveProperty('results');
    expect(parsed.breakeven).not.toBeNull();
  });

  it('returns isError:true for invalid sweep step', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 15, method: 'tools/call',
      params: {
        name: 'simulate_v2_sweep',
        arguments: {
          side_a: { unit: 'britons_halberdier' },
          side_b: { unit: 'britons_cavalier', count: 10 },
          sweep:  { target: 'side_a.count', range: { min: 1, max: 10, step: 0 } },
        },
      },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
  });
});

describe('tools/call - unknown tool', () => {
  it('returns isError:true', async () => {
    const res = await mcp({
      jsonrpc: '2.0', id: 8, method: 'tools/call',
      params: { name: 'not_a_real_tool', arguments: {} },
    });
    const { result } = await res.json();
    expect(result.isError).toBe(true);
  });
});

describe('unknown method', () => {
  it('returns JSON-RPC error -32601', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 9, method: 'no_such_method', params: {} });
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
  });
});
