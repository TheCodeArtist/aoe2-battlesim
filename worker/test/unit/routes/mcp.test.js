import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../../src/routes/mcp.js';
import { SCENARIOS } from '../../../src/data.js';

describe('TOOLS manifest', () => {
  const toolNames = [
    'simulate', 'simulate_batch', 'simulate_sweep',
    'simulate_v2', 'simulate_v2_batch', 'simulate_v2_sweep',
    'list_units', 'get_unit', 'list_presets', 'get_preset',
    'list_scenarios', 'run_scenario',
  ];

  it('has exactly 12 tools', () => {
    expect(TOOLS).toHaveLength(12);
  });

  it('contains all required tool names', () => {
    const names = TOOLS.map(t => t.name);
    toolNames.forEach(n => expect(names).toContain(n));
  });

  it('every tool has a description and inputSchema', () => {
    TOOLS.forEach(t => {
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe('object');
    });
  });

  it('run_scenario id enum is built from SCENARIOS (not hardcoded)', () => {
    const tool = TOOLS.find(t => t.name === 'run_scenario');
    const idEnum = tool.inputSchema.properties.id.enum;
    expect(Array.isArray(idEnum)).toBe(true);
    Object.keys(SCENARIOS).forEach(id => expect(idEnum).toContain(id));
  });

  it('simulate tool requires side_a and side_b', () => {
    const tool = TOOLS.find(t => t.name === 'simulate');
    expect(tool.inputSchema.required).toContain('side_a');
    expect(tool.inputSchema.required).toContain('side_b');
  });

  it('simulate_v2 tool requires side_a and side_b', () => {
    const tool = TOOLS.find(t => t.name === 'simulate_v2');
    expect(tool.inputSchema.required).toContain('side_a');
    expect(tool.inputSchema.required).toContain('side_b');
  });

  it('simulate_v2_batch tool requires matchups', () => {
    const tool = TOOLS.find(t => t.name === 'simulate_v2_batch');
    expect(tool.inputSchema.required).toContain('matchups');
  });

  it('simulate_v2_sweep tool requires side_a, side_b, and sweep', () => {
    const tool = TOOLS.find(t => t.name === 'simulate_v2_sweep');
    expect(tool.inputSchema.required).toContain('side_a');
    expect(tool.inputSchema.required).toContain('side_b');
    expect(tool.inputSchema.required).toContain('sweep');
  });
});
