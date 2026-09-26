# aiextra-flatpak-homepage

Homepage for [aiextra-flatpak](https://github.com/first-storm/aiextra-flatpak), served at <https://aiextra.cocoabrew.cc/>.

Pages are generated from the upstream repo and rebuilt when it changes.

## Develop

```sh
npm ci
npm run sync    # fetch upstream into .upstream/
npm run dev
npm run build
```
