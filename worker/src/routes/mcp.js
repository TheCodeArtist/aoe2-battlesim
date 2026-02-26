import { CORS } from '../cors.js';

export const TOOLS = [];

export async function handleMcp(request) {
  return Response.json({ error: 'Not Implemented' }, { status: 501, headers: CORS });
}
