// URL helpers that respect the configured base path (e.g. /aiextra/).
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Site-relative href, e.g. href('apps/x/') -> '/aiextra/apps/x/'. */
export const href = (path = '') => `${base}/${path.replace(/^\/+/, '')}`;

/** Absolute URL for canonical links, feeds, sitemaps and JSON-LD. */
export const abs = (path = '') => new URL(href(path), import.meta.env.SITE).href;

export const SITE_NAME = 'AI Extra';

export const appPath = (id: string) => `apps/${id}/`;
export const iconPath = (id: string) => `icons/${id}.png`;
export const docPath = (slug: string) => `docs/${slug}/`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const licenseLabel = (spdx: string) =>
  !spdx ? 'Unknown' : /proprietary/i.test(spdx) ? 'Proprietary (vendor licence)' : spdx;

/** Joins ["a","b","c"] as "a, b and c". */
export const listJoin = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** Trim text to a meta-description friendly length on a word boundary. */
export function clip(text: string, max = 158) {
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.]$/, '') + '…';
}
