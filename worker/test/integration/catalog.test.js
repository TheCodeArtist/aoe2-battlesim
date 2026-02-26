import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('GET /units', () => {
  it('returns 200 with all units', async () => {
    const res  = await SELF.fetch('http://example.com/units');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).length).toBeGreaterThan(100);
  });

  it('?name= filter returns matching units', async () => {
    const res  = await SELF.fetch('http://example.com/units?name=archer');
    const body = await res.json();
    Object.values(body).forEach(u => expect(u.name.toLowerCase()).toContain('archer'));
  });
});

describe('GET /units/:id', () => {
  it('returns a single unit for a valid key', async () => {
    const res  = await SELF.fetch('http://example.com/units/archer');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hp).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown unit key', async () => {
    const res = await SELF.fetch('http://example.com/units/zzz_no_such_unit');
    expect(res.status).toBe(404);
  });
});

describe('GET /presets', () => {
  it('returns all presets', async () => {
    const res  = await SELF.fetch('http://example.com/presets');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['archer_fu_feudal']).toBeDefined();
  });
});

describe('GET /presets/:id', () => {
  it('returns the preset for archer_fu_feudal', async () => {
    const res  = await SELF.fetch('http://example.com/presets/archer_fu_feudal');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hp).toBe(30);
    expect(body.patk).toBe(5);
  });

  it('returns 404 for an unknown preset', async () => {
    const res = await SELF.fetch('http://example.com/presets/no_such_preset');
    expect(res.status).toBe(404);
  });
});
