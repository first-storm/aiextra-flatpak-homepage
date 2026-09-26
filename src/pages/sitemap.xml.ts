import type { APIRoute } from 'astro';
import { loadUpstream } from '../lib/upstream';
import { abs, appPath, docPath } from '../lib/site';

const day = (iso: string) => iso.slice(0, 10);

export const GET: APIRoute = async () => {
  const up = await loadUpstream();
  const newest = [up.date, ...up.apps.map((a) => a.latest?.date ?? '')].sort().at(-1)!;
  const urls = [
    { loc: abs(), lastmod: day(newest) },
    ...up.apps.map((a) => ({ loc: abs(appPath(a.id)), lastmod: day(a.latest?.date ?? up.date) })),
    ...up.docs.map((d) => ({ loc: abs(docPath(d.slug)), lastmod: day(up.date) })),
  ];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
