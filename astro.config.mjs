// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL is the full public URL of the site, including any sub-path. CI takes
// it from actions/configure-pages, so renaming the repo or adding a custom
// domain needs no change here.
const siteUrl = new URL(process.env.SITE_URL || 'https://first-storm.github.io/aiextra/');
const base = siteUrl.pathname.replace(/\/+$/, '') || '/';

export default defineConfig({
  site: siteUrl.origin,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
});
