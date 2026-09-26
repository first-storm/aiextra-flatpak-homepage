// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL is the full public URL of the site, including any sub-path.
const siteUrl = new URL(process.env.SITE_URL || 'https://aiextra.cocoabrew.cc/');
const base = siteUrl.pathname.replace(/\/+$/, '') || '/';

export default defineConfig({
  site: siteUrl.origin,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
});
