import { UNITS, PRESETS } from '../data.js';
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
