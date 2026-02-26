import { CORS } from '../cors.js';

export function listScenariosLogic() {
  throw new Error('Not implemented');
}

export function runScenarioLogic(id, overrides = {}) {
  throw new Error('Not implemented');
}

export async function handleListScenarios(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}

export async function handleScenarioSimulate(request, id) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}
