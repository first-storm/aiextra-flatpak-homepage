# AI Extra homepage

Static homepage for [first-storm/aiextra-flatpak](https://github.com/first-storm/aiextra-flatpak),
the unofficial Flatpak repository for AI desktop apps. Live at
<https://first-storm.github.io/aiextra/>.

Nothing about individual apps lives in this repo. Every build clones upstream
and generates the pages from it:

| Upstream file | Used for |
| --- | --- |
| `manifests/<id>/<id>.metainfo.xml` | name, summary, description, developer, links, release history |
| `manifests/<id>/<id>.yml` | sandbox permissions (`finish-args`), vendor download hosts, runtime |
| `manifests/<id>/architectures` | supported CPU architectures |
| `manifests/<id>/icons/*.png` | app icon (largest size) |
| `*.flatpakrepo` | remote name and URL used in install commands |
| `keys/*.asc` | signing key fingerprint |
| `docs/*.md` | guide pages, linked from the app named on the same README table row |
| `.github/workflows/update-check.yml` | "checks for updates every N hours" text |

Adding, removing or updating an app upstream needs no change here.

## Output

- `/`: overview, install commands, app list, how it works, signing, FAQ
- `/apps/<app-id>/`: one page per app with install/run commands, details, permissions and release history
- `/docs/<slug>/`: upstream guides
- `/releases.xml` (RSS), `/sitemap.xml`, `/robots.txt`, `/sync.json` (upstream commit the build came from)

SEO: unique titles and descriptions, canonical URLs, Open Graph/Twitter tags,
and JSON-LD (`WebSite`, `ItemList`, `FAQPage`, `SoftwareApplication`,
`TechArticle`, `BreadcrumbList`). Pages are static HTML with inlined CSS and no
web fonts. The only JavaScript is a small inline script for the copy buttons.

## Development

Requires Node 22+ and git.

```sh
npm ci
npm run sync      # clone/update upstream into .upstream/
npm run dev       # http://localhost:4321/aiextra/
npm run build     # -> dist/
npm run check     # validate links, canonical URLs, JSON-LD and sitemap in dist/
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_URL` | `https://first-storm.github.io/aiextra/` | public URL, including the sub-path |
| `UPSTREAM_REPO` | `https://github.com/first-storm/aiextra-flatpak` | repo to build from |
| `UPSTREAM_REF` | `main` | branch, tag or commit SHA |
| `UPSTREAM_DIR` | `.upstream` | where the checkout lives |

## Deployment and sync

`.github/workflows/pages.yml` builds on every push and PR. It deploys to
GitHub Pages from the default branch only. It stays in sync with upstream in
three ways:

- **Hourly schedule.** Compares upstream `main` with the `upstreamSha` in the
  deployed `sync.json` and rebuilds only when they differ. The run also
  re-enables the workflow, because GitHub disables schedules after 60 days of
  repository inactivity.
- **`repository_dispatch` (`upstream-updated`).** Instant rebuild if upstream
  asks for one (see below).
- **Manual:** *Actions → Pages → Run workflow*.

The site URL comes from `actions/configure-pages`. Renaming the repository or
adding a custom domain therefore needs no code change.

### One-time setup

1. GitHub serves project sites at `/<repo-name>/`. To publish at
   `first-storm.github.io/aiextra/`, rename this repository to **`aiextra`**
   (*Settings → General → Repository name*). GitHub redirects the old name.
2. *Settings → Pages → Build and deployment → Source*: **GitHub Actions**.
3. Run the workflow once, or push to the default branch.

### Optional: instant updates from upstream

Add a fine-grained token with *Contents: read and write* on this repository as
the `HOMEPAGE_DISPATCH_TOKEN` secret in `aiextra-flatpak`. Then add this step
to the end of its publish job:

```yaml
      - name: Refresh homepage
        if: success()
        env:
          GH_TOKEN: ${{ secrets.HOMEPAGE_DISPATCH_TOKEN }}
        run: gh api repos/first-storm/aiextra/dispatches -f event_type=upstream-updated
```

Without it, the hourly schedule picks up changes within an hour.

## Trademarks

App names and icons belong to their respective owners. This site is not affiliated with them.
