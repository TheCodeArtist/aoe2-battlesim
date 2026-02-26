import { CORS } from './cors.js';
import { handleSimulate, handleBatch, handleSweep } from './routes/simulate.js';
import { handleSimulate as handleSimulateV2, handleBatch as handleBatchV2, handleSweep as handleSweepV2 } from './routes/simulate_v2.js';
import { handleListScenarios, handleScenarioSimulate } from './routes/scenarios.js';
import { handleListUnits, handleGetUnit, handleListPresets, handleGetPreset, handleListV2Units, handleGetV2Unit } from './routes/catalog.js';
import { handleMcp } from './routes/mcp.js';
import { handleRoot } from './routes/root.js';
import { generateOpenApi, getSwaggerUiHtml } from './openapi.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export default {
  async fetch(request) {
    const url    = new URL(request.url);
    const method = request.method;
    const path   = url.pathname;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // POST routes
    if (method === 'POST') {
      if (path === '/simulate')              return handleSimulate(request);
      if (path === '/simulate/v2')           return handleSimulateV2(request);
      if (path === '/simulate/batch')        return handleBatch(request);
      if (path === '/simulate/v2/batch')     return handleBatchV2(request);
      if (path === '/simulate/v2/sweep')     return handleSweepV2(request);
      if (path === '/simulate/sweep')   return handleSweep(request);
      if (path === '/mcp' || path === '/mcp/')  return handleMcp(request);

      const scenarioMatch = path.match(/^\/scenarios\/([^/]+)\/simulate$/);
      if (scenarioMatch) return handleScenarioSimulate(request, scenarioMatch[1]);
    }

    // GET routes
    if (method === 'GET') {
      if (path === '/')             return handleRoot();
      if (path === '/openapi.json') return json(generateOpenApi(request));
      if (path === '/docs')         return new Response(getSwaggerUiHtml(), { headers: { ...CORS, 'Content-Type': 'text/html' } });
      if (path === '/scenarios')    return handleListScenarios(request);
      if (path === '/units')      return handleListUnits(request);
      if (path === '/presets')    return handleListPresets(request);

      const unitMatch   = path.match(/^\/units\/([^/]+)$/);
      const presetMatch = path.match(/^\/presets\/([^/]+)$/);
      if (unitMatch)   return handleGetUnit(request, unitMatch[1]);
      if (presetMatch) return handleGetPreset(request, presetMatch[1]);

      if (path === '/v2/units') return handleListV2Units(request);
      const v2UnitMatch = path.match(/^\/v2\/units\/([^/]+)$/);
      if (v2UnitMatch) return handleGetV2Unit(request, v2UnitMatch[1]);
    }

    // 405 for known paths with wrong method; 404 for everything else
    const knownPaths = ['/simulate', '/simulate/batch', '/simulate/sweep',
                        '/simulate/v2', '/simulate/v2/batch', '/simulate/v2/sweep',
                        '/scenarios', '/units', '/presets', '/mcp', '/mcp/',
                        '/v2/units'];
    const isKnown = knownPaths.includes(path)
      || /^\/scenarios\/[^/]+\/simulate$/.test(path)
      || /^\/units\/[^/]+$/.test(path)
      || /^\/presets\/[^/]+$/.test(path)
      || /^\/v2\/units\/[^/]+$/.test(path);
    return json({ error: isKnown ? 'Method Not Allowed' : 'Not Found' }, isKnown ? 405 : 404);
  },
};
