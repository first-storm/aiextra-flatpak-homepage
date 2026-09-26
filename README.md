# aiextra-flatpak-homepage

Homepage for [aiextra-flatpak](https://github.com/first-storm/aiextra-flatpak), served at <https://aiextra.cocoabrew.cc/>.

Pages are generated from the upstream repo on every build. The Pages workflow checks upstream hourly and redeploys when it changes.

## Develop

```sh
npm ci
npm run sync    # fetch upstream into .upstream/
npm run dev
npm run build
```

## Deploy

Settings → Pages: Source "GitHub Actions", custom domain `aiextra.cocoabrew.cc`.
DNS: `CNAME aiextra → first-storm.github.io`.
