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
  it('returns all 9 tools', async () => {
    const res  = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.tools).toHaveLength(9);
    const names = result.tools.map(t => t.name);
    expect(names).toContain('simulate');
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
