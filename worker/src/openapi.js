import { TOOLS } from './routes/mcp.js';

const INFO = {
  title: 'Age of Empires II Battle Simulator API',
  description: 'API for simulating battles, retrieving unit stats, and running scenarios.',
  version: '0.1.0',
};

// MAPPING: Tool Name -> HTTP Route
// IMPORTANT: Update this map when adding new tools/routes to ensure they appear in OpenAPI spec.
const ROUTE_MAP = {
  simulate:          { method: 'POST', path: '/simulate' },
  simulate_v2:       { method: 'POST', path: '/simulate/v2' },
  simulate_batch:    { method: 'POST', path: '/simulate/batch' },
  simulate_v2_batch: { method: 'POST', path: '/simulate/v2/batch' },
  simulate_sweep:    { method: 'POST', path: '/simulate/sweep' },
  simulate_v2_sweep: { method: 'POST', path: '/simulate/v2/sweep' },
  list_units:     { method: 'GET',  path: '/units', query: ['name'] },
  get_unit:       { method: 'GET',  path: '/units/{id}', pathParams: ['id'] },
  list_presets:   { method: 'GET',  path: '/presets', query: ['name'] },
  get_preset:     { method: 'GET',  path: '/presets/{id}', pathParams: ['id'] },
  list_scenarios: { method: 'GET',  path: '/scenarios' },
  run_scenario:   { method: 'POST', path: '/scenarios/{id}/simulate', pathParams: ['id'] },
};

export function generateOpenApi(request) {
  const url = new URL(request.url);
  const serverUrl = `${url.protocol}//${url.host}`;

  const paths = {};

  for (const tool of TOOLS) {
    const mapping = ROUTE_MAP[tool.name];
    if (!mapping) continue;

    const { method, path, query, pathParams } = mapping;
    
    if (!paths[path]) paths[path] = {};

    const parameters = [];
    const requestBodySchema = JSON.parse(JSON.stringify(tool.inputSchema)); // Deep copy
    
    // Handle Path Parameters
    if (pathParams) {
      for (const paramName of pathParams) {
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: requestBodySchema.properties[paramName] || { type: 'string' },
          description: requestBodySchema.properties[paramName]?.description,
        });
        delete requestBodySchema.properties[paramName];
        if (requestBodySchema.required) {
          requestBodySchema.required = requestBodySchema.required.filter(r => r !== paramName);
        }
      }
    }

    // Handle Query Parameters
    if (query) {
      for (const paramName of query) {
        parameters.push({
          name: paramName,
          in: 'query',
          required: requestBodySchema.required?.includes(paramName) || false,
          schema: requestBodySchema.properties[paramName] || { type: 'string' },
          description: requestBodySchema.properties[paramName]?.description,
        });
        delete requestBodySchema.properties[paramName];
        if (requestBodySchema.required) {
          requestBodySchema.required = requestBodySchema.required.filter(r => r !== paramName);
        }
      }
    }

    const operation = {
      summary: tool.description.split('.')[0] + '.',
      description: tool.description,
      parameters,
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object' }, // We don't have explicit output schemas in TOOLS yet, using generic object
            },
          },
        },
      },
    };

    // Add requestBody for POST methods if there are remaining properties
    if (method === 'POST' && Object.keys(requestBodySchema.properties || {}).length > 0) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: requestBodySchema,
          },
        },
      };
    }

    paths[path][method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.0.0',
    info: INFO,
    servers: [{ url: serverUrl }],
    paths,
  };
}

export function getSwaggerUiHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AoE2 BattleSim API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>
  `;
}
