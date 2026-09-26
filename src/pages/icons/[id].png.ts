import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { loadUpstream } from '../../lib/upstream';

// Serves each app's largest upstream icon as /icons/<app-id>.png.
export const getStaticPaths = (async () => {
  const up = await loadUpstream();
  return up.apps.filter((a) => a.iconFile).map((a) => ({ params: { id: a.id }, props: { file: a.iconFile! } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(readFileSync(props.file as string), { headers: { 'Content-Type': 'image/png' } });
