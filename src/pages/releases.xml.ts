import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { loadUpstream } from '../lib/upstream';
import { SITE_NAME, abs, appPath } from '../lib/site';

const MAX_ITEMS = 100;

export const GET: APIRoute = async () => {
  const up = await loadUpstream();
  const items = up.apps
    .flatMap((app) =>
      app.releases.map((r) => ({
        title: `${app.name} ${r.version}`,
        link: abs(appPath(app.id)),
        pubDate: new Date(`${r.date}T00:00:00Z`),
        description: `${app.name} ${r.version} is available in ${SITE_NAME}. Update with: flatpak update ${app.id}`,
        customData: `<guid isPermaLink="false">${app.id}@${r.version}</guid>`,
      })),
    )
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, MAX_ITEMS);

  return rss({
    title: `${SITE_NAME} releases`,
    description: 'New app versions published to the AI Extra Flatpak repository.',
    site: abs(),
    items,
    customData: '<language>en</language>',
  });
};
