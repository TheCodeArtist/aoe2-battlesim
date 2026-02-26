import { CORS } from '../cors.js';

export function listUnitsLogic(nameFilter = '') {
  throw new Error('Not implemented');
}

export function getUnitLogic(id) {
  throw new Error('Not implemented');
}

export function listPresetsLogic(nameFilter = '') {
  throw new Error('Not implemented');
}

export function getPresetLogic(id) {
  throw new Error('Not implemented');
}

export function handleListUnits(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export function handleGetUnit(request, id) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export function handleListPresets(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export function handleGetPreset(request, id) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}
