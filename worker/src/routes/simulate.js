import { CORS } from '../cors.js';

export function simulateLogic(side_a, side_b, options = {}) {
  throw new Error('Not implemented');
}

export function batchLogic(matchups, options = {}) {
  throw new Error('Not implemented');
}

export function sweepLogic(side_a, side_b, sweep, options = {}) {
  throw new Error('Not implemented');
}

export async function handleSimulate(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export async function handleBatch(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export async function handleSweep(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}
