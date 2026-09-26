import type { APIRoute } from 'astro';
import { loadUpstream } from '../lib/upstream';

// Read by the Pages workflow to skip rebuilds when upstream hasn't changed.
export const GET: APIRoute = async () => {
  const up = await loadUpstream();
  return new Response(
    JSON.stringify({ upstreamSha: up.sha, upstreamDate: up.date, builtAt: new Date().toISOString() }, null, 2) + '\n',
    { headers: { 'Content-Type': 'application/json' } },
  );
};
