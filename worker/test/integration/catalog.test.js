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

describe('GET /v2/units', () => {
  it('returns 200 with all v2 units', async () => {
    const res  = await SELF.fetch('http://example.com/v2/units');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).length).toBeGreaterThan(500);
  });

  it('?name= filter returns matching units', async () => {
    const res  = await SELF.fetch('http://example.com/v2/units?name=cavalier');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).length).toBeGreaterThan(0);
    Object.values(body).forEach(u => expect(u.name.toLowerCase()).toContain('cavalier'));
  });

  it('?civ= filter returns only that civ units', async () => {
    const res  = await SELF.fetch('http://example.com/v2/units?civ=britons');
    const body = await res.json();
    expect(Object.keys(body).every(k => k.startsWith('britons_'))).toBe(true);
  });

  it('CORS header is present', async () => {
    const res = await SELF.fetch('http://example.com/v2/units');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('GET /v2/units/:id', () => {
  it('returns a single v2 unit for a valid key', async () => {
    const res  = await SELF.fetch('http://example.com/v2/units/britons_cavalier');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hp).toBeGreaterThan(0);
    expect(body.attacks).toBeDefined();
    expect(body.armors).toBeDefined();
    expect(body.bonuses).toBeDefined();
  });

  it('returns 404 for an unknown v2 unit key', async () => {
    const res = await SELF.fetch('http://example.com/v2/units/zzz_no_such_unit');
    expect(res.status).toBe(404);
  });
});
