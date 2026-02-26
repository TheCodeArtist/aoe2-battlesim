import { UNITS, PRESETS } from '../data.js';
import { ALL_UNITS } from '../data_v2.js';
import { CORS } from '../cors.js';

// ── Logic functions ───────────────────────────────────────────────────────────

export function listUnitsLogic(nameFilter = '') {
  if (!nameFilter) return UNITS;
  const q = nameFilter.toLowerCase();
  return Object.fromEntries(
    Object.entries(UNITS).filter(([, v]) => v.name.toLowerCase().includes(q))
  );
}

export function getUnitLogic(id) {
  const unit = UNITS[id];
  if (!unit) throw new Error(`Unit not found: ${id}`);
  return unit;
}

export function listPresetsLogic(nameFilter = '') {
  if (!nameFilter) return PRESETS;
  const q = nameFilter.toLowerCase();
  return Object.fromEntries(
    Object.entries(PRESETS).filter(([, v]) => v.name.toLowerCase().includes(q))
  );
}

export function getPresetLogic(id) {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Preset not found: ${id}`);
  return preset;
}

// ── V2 catalog logic ──────────────────────────────────────────────────────────

/**
 * @param {string} [nameFilter]  Case-insensitive substring match on unit name.
 * @param {string} [civFilter]   Exact civ slug prefix (e.g. 'britons').
 */
export function listV2UnitsLogic(nameFilter = '', civFilter = '') {
  let entries = Object.entries(ALL_UNITS);
  if (civFilter) {
    const prefix = civFilter.toLowerCase() + '_';
    entries = entries.filter(([k]) => k.startsWith(prefix));
  }
  if (nameFilter) {
    const q = nameFilter.toLowerCase();
    entries = entries.filter(([, v]) => v.name.toLowerCase().includes(q));
  }
  return Object.fromEntries(entries);
}

export function getV2UnitLogic(id) {
  const unit = ALL_UNITS[id];
  if (!unit) throw new Error(`V2 unit not found: ${id}`);
  return unit;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

export function handleListUnits(request) {
  const url        = new URL(request.url);
  const nameFilter = url.searchParams.get('name') || '';
  return Response.json(listUnitsLogic(nameFilter), { headers: CORS });
}

export function handleGetUnit(request, id) {
  try {
    return Response.json(getUnitLogic(id), { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404, headers: CORS });
  }
}

export function handleListPresets(request) {
  const url        = new URL(request.url);
  const nameFilter = url.searchParams.get('name') || '';
  return Response.json(listPresetsLogic(nameFilter), { headers: CORS });
}

export function handleGetPreset(request, id) {
  try {
    return Response.json(getPresetLogic(id), { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404, headers: CORS });
  }
}

export function handleListV2Units(request) {
  const url        = new URL(request.url);
  const nameFilter = url.searchParams.get('name') || '';
  const civFilter  = url.searchParams.get('civ')  || '';
  return Response.json(listV2UnitsLogic(nameFilter, civFilter), { headers: CORS });
}

export function handleGetV2Unit(request, id) {
  try {
    return Response.json(getV2UnitLogic(id), { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404, headers: CORS });
  }
}
