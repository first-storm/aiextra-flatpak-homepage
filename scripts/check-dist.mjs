// Sanity checks on the built site, run in CI before deploying:
// - every internal href/src resolves to a file in dist/
// - canonical, og:url and sitemap URLs live under SITE_URL
// - JSON-LD blocks parse, and every indexable page has a title, description and one <h1>
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const site = new URL(process.env.SITE_URL || 'https://aiextra.cocoabrew.cc/');
const base = site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`;
const siteRoot = new URL(base, site).href;
const errors = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

function resolveLocal(pathname) {
  if (!pathname.startsWith(base)) return false;
  const rel = decodeURIComponent(pathname.slice(base.length));
  const candidates = [rel, join(rel, 'index.html'), `${rel}.html`];
  return candidates.some((c) => existsSync(join(dist, c)) && statSync(join(dist, c)).isFile());
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const name = relative(dist, file);
  const indexable = !/<meta name="robots" content="noindex"/.test(html);

  for (const [, attr] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(attr) && !attr.startsWith(siteRoot)) continue;
    const url = new URL(attr, new URL(`${base}${name}`, site));
    if (!resolveLocal(url.pathname)) errors.push(`${name}: broken internal link ${attr}`);
  }

  for (const [, tag, url] of html.matchAll(/<(link rel="canonical"|meta property="og:url") (?:href|content)="([^"]+)"/g)) {
    if (!url.startsWith(siteRoot)) errors.push(`${name}: ${tag} ${url} is outside ${siteRoot}`);
  }

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const ld = JSON.parse(json);
      if (!ld['@context'] || !ld['@type']) errors.push(`${name}: JSON-LD missing @context/@type`);
    } catch (e) {
      errors.push(`${name}: invalid JSON-LD (${e.message})`);
    }
  }

  if (indexable) {
    if (!/<title>[^<]{10,}<\/title>/.test(html)) errors.push(`${name}: missing or short <title>`);
    if (!/<meta name="description" content="[^"]{50,}"/.test(html)) errors.push(`${name}: missing or short description`);
    if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) errors.push(`${name}: expected exactly one <h1>`);
    if (!/<link rel="canonical"/.test(html)) errors.push(`${name}: missing canonical`);
  }
}

const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  if (!loc.startsWith(siteRoot)) errors.push(`sitemap: ${loc} is outside ${siteRoot}`);
  else if (!resolveLocal(new URL(loc).pathname)) errors.push(`sitemap: ${loc} has no page`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) in ${dist}/`);
  process.exit(1);
}
console.log(`ok: ${htmlFiles.length} pages, ${locs.length} sitemap URLs, ${files.length} files`);
