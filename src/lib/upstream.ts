// Build-time loader for the upstream first-storm/aiextra-flatpak checkout.
// Every page reads its data from here; nothing about individual apps is
// hard-coded in the site, so apps added or removed upstream show up on the
// next build.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { parse as parseYaml } from 'yaml';
import { readKey } from 'openpgp';
import { describePermissions, type Permission } from './permissions';

export const UPSTREAM_DIR = resolve(process.env.UPSTREAM_DIR || '.upstream');
export const UPSTREAM_GITHUB = 'https://github.com/first-storm/aiextra-flatpak';

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
}

export interface DownloadSource {
  host: string;
  arches: string[]; // empty = all arches
}

export interface Doc {
  slug: string;
  title: string;
  markdown: string;
  file: string; // path relative to the upstream root
}

export interface App {
  id: string;
  name: string;
  summary: string;
  descriptionHtml: string;
  descriptionText: string;
  developer: string;
  license: string;
  categories: string[];
  urls: Record<string, string>; // homepage, bugtracker, help, ...
  releases: Release[];
  latest: Release | null;
  arches: string[];
  permissions: Permission[];
  sources: DownloadSource[];
  iconFile: string | null; // absolute path of the largest PNG icon
  iconSize: number;
  runtime: string;
  base: string; // e.g. org.electronjs.Electron2.BaseApp
  docs: string[]; // doc slugs related to this app
  manifestUrl: string;
}

export interface Remote {
  name: string; // the remote name users add, derived from the .flatpakrepo filename
  file: string;
  url: string; // .flatpakrepo URL
  repoUrl: string;
  title: string;
  comment: string;
  description: string;
}

export interface SigningKey {
  fingerprint: string; // grouped, e.g. "01C7 6F3F ..."
  userIds: string[];
  keyUrl: string;
}

export interface Upstream {
  sha: string;
  date: string; // ISO commit date
  apps: App[];
  docs: Doc[];
  remote: Remote;
  key: SigningKey | null;
  updateCron: string | null;
  updateEvery: string | null; // human-readable form of updateCron
  license: string | null;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  trimValues: false,
});

type Node = Record<string, any>;

const tagOf = (n: Node) => Object.keys(n).find((k) => k !== ':@')!;
const children = (n: Node): Node[] => n[tagOf(n)] ?? [];
const attrs = (n: Node): Record<string, string> => n[':@'] ?? {};
const find = (nodes: Node[], tag: string) => nodes.filter((n) => tagOf(n) === tag);
const first = (nodes: Node[], tag: string) => find(nodes, tag)[0];

function text(n: Node | undefined): string {
  if (!n) return '';
  const tag = tagOf(n);
  if (tag === '#text') return String(n['#text']);
  return children(n).map(text).join('');
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// AppStream descriptions allow a tiny markup subset; render only that and
// escape everything else.
const DESCRIPTION_TAGS = new Set(['p', 'ul', 'ol', 'li', 'em', 'code']);
function descriptionHtml(nodes: Node[]): string {
  return nodes
    .map((n) => {
      const tag = tagOf(n);
      if (tag === '#text') return escapeHtml(String(n['#text']).replace(/\s+/g, ' '));
      const inner = descriptionHtml(children(n));
      return DESCRIPTION_TAGS.has(tag) ? `<${tag}>${inner.trim()}</${tag}>` : inner;
    })
    .join('');
}

function descriptionText(nodes: Node[]): string {
  return clean(nodes.map((n) => (tagOf(n) === '#text' ? String(n['#text']) : ` ${descriptionText(children(n))} `)).join(''));
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function largestIcon(dir: string): { file: string | null; size: number } {
  if (!existsSync(dir)) return { file: null, size: 0 };
  let best = { file: null as string | null, size: 0 };
  for (const f of readdirSync(dir)) {
    const m = f.match(/-(\d+)\.png$/);
    if (m && Number(m[1]) > best.size) best = { file: join(dir, f), size: Number(m[1]) };
  }
  return best;
}

function collectSources(modules: any[], out: DownloadSource[] = []): DownloadSource[] {
  for (const mod of modules ?? []) {
    if (typeof mod !== 'object' || mod === null) continue;
    for (const src of mod.sources ?? []) {
      if (src?.type !== 'extra-data' || !src.url) continue;
      const host = new URL(src.url).host;
      const arches: string[] = src['only-arches'] ?? [];
      const existing = out.find((s) => s.host === host);
      if (existing) {
        if (!existing.arches.length || !arches.length) existing.arches = [];
        else existing.arches = [...new Set([...existing.arches, ...arches])];
      } else out.push({ host, arches: [...arches] });
    }
    collectSources(mod.modules, out);
  }
  return out;
}

function loadApp(root: string, id: string, readme: string): App {
  const dir = join(root, 'manifests', id);
  const metaPath = join(dir, `${id}.metainfo.xml`);
  const manifestPath = join(dir, `${id}.yml`);
  if (!existsSync(metaPath)) throw new Error(`${id}: missing ${metaPath}`);

  const doc = xml.parse(readText(metaPath)) as Node[];
  const component = first(doc, 'component');
  if (!component) throw new Error(`${id}: metainfo has no <component>`);
  const c = children(component);

  // Untranslated elements only (no xml:lang).
  const plain = (tag: string) => find(c, tag).find((n) => !attrs(n)['xml:lang']);
  const name = clean(text(plain('name')));
  const summary = clean(text(plain('summary')));
  if (!name || !summary) throw new Error(`${id}: metainfo needs <name> and <summary>`);

  const descNodes = children(plain('description') ?? { description: [] });
  const developerNode = first(c, 'developer');
  const developer = clean(
    developerNode ? text(first(children(developerNode), 'name')) : text(first(c, 'developer_name')),
  );

  const urls: Record<string, string> = {};
  for (const u of find(c, 'url')) urls[attrs(u).type ?? 'homepage'] = clean(text(u));

  const categories = find(children(first(c, 'categories') ?? { categories: [] }), 'category').map((n) => clean(text(n)));

  const releases: Release[] = find(children(first(c, 'releases') ?? { releases: [] }), 'release')
    .map((r) => {
      const a = attrs(r);
      const date = a.date || (a.timestamp ? new Date(Number(a.timestamp) * 1000).toISOString().slice(0, 10) : '');
      return { version: a.version, date };
    })
    .filter((r) => r.version)
    .sort((a, b) => b.date.localeCompare(a.date));

  const archPath = join(dir, 'architectures');
  const arches = existsSync(archPath)
    ? readText(archPath)
        .split('\n')
        .map((l) => l.replace(/#.*/, '').trim())
        .filter(Boolean)
    : ['x86_64'];

  const manifest = existsSync(manifestPath) ? parseYaml(readText(manifestPath)) : {};
  const icon = largestIcon(join(dir, 'icons'));

  // Docs linked from the same README table row as this app ID.
  const docs = readme
    .split('\n')
    .filter((l) => l.includes(`\`${id}\``))
    .flatMap((l) => [...l.matchAll(/\(docs\/([^)\s]+)\.md\)/g)].map((m) => m[1]));

  return {
    id,
    name,
    summary,
    descriptionHtml: descriptionHtml(descNodes),
    descriptionText: descriptionText(descNodes),
    developer,
    license: clean(text(first(c, 'project_license'))),
    categories,
    urls,
    releases,
    latest: releases[0] ?? null,
    arches,
    permissions: describePermissions(manifest['finish-args'] ?? []),
    sources: collectSources(manifest.modules ?? []),
    iconFile: icon.file,
    iconSize: icon.size,
    runtime: manifest.runtime ? `${manifest.runtime}//${manifest['runtime-version'] ?? ''}` : '',
    base: manifest.base ?? '',
    docs,
    manifestUrl: `${UPSTREAM_GITHUB}/tree/main/manifests/${id}`,
  };
}

function parseIni(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of src.split('\n')) {
    const m = line.match(/^([A-Za-z]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function loadRemote(root: string): Remote {
  const file = readdirSync(root).find((f) => f.endsWith('.flatpakrepo'));
  if (!file) throw new Error('upstream has no *.flatpakrepo file');
  const ini = parseIni(readText(join(root, file)));
  const repoUrl = ini.Url.endsWith('/') ? ini.Url : `${ini.Url}/`;
  return {
    name: basename(file, '.flatpakrepo'),
    file,
    url: new URL(file, repoUrl).href,
    repoUrl,
    title: ini.Title ?? '',
    comment: ini.Comment ?? '',
    description: ini.Description ?? '',
  };
}

async function loadKey(root: string): Promise<SigningKey | null> {
  const dir = join(root, 'keys');
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => f.endsWith('.asc'));
  if (!file) return null;
  const key = await readKey({ armoredKey: readText(join(dir, file)) });
  const hex = key.getFingerprint().toUpperCase();
  return {
    fingerprint: hex.match(/.{4}/g)!.join(' '),
    userIds: key.getUserIDs(),
    keyUrl: `${UPSTREAM_GITHUB}/blob/main/keys/${file}`,
  };
}

function loadDocs(root: string): Doc[] {
  const dir = join(root, 'docs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const markdown = readText(join(dir, f));
      const slug = basename(f, '.md');
      const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? slug;
      return { slug, title, markdown, file: `docs/${f}` };
    });
}

function loadUpdateCron(root: string): string | null {
  const path = join(root, '.github', 'workflows', 'update-check.yml');
  if (!existsSync(path)) return null;
  const wf = parseYaml(readText(path));
  return wf?.on?.schedule?.[0]?.cron ?? null;
}

// Covers the shapes a maintainer would realistically use; anything else is
// shown verbatim by the caller.
function describeCron(cron: string | null): string | null {
  if (!cron) return null;
  const [min, hour, dom, mon, dow] = cron.split(/\s+/);
  if (dom !== '*' || mon !== '*' || dow !== '*' || !/^\d+$/.test(min)) return null;
  if (hour === '*') return 'every hour';
  const every = hour.match(/^\*\/(\d+)$/);
  if (every) return `every ${every[1]} hours`;
  if (/^\d+$/.test(hour)) return 'once a day';
  return null;
}

function loadSync(root: string): { sha: string; date: string } {
  const syncPath = join(root, '.sync.json');
  if (existsSync(syncPath)) {
    const s = JSON.parse(readText(syncPath));
    return { sha: s.sha, date: s.date };
  }
  const git = (...a: string[]) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' }).trim();
  return { sha: git('rev-parse', 'HEAD'), date: git('log', '-1', '--format=%cI') };
}

let cached: Promise<Upstream> | null = null;

export function loadUpstream(): Promise<Upstream> {
  cached ??= (async () => {
    const root = UPSTREAM_DIR;
    if (!existsSync(join(root, 'manifests'))) {
      throw new Error(`No upstream checkout at ${root}. Run \`npm run sync\` first.`);
    }
    const readmePath = join(root, 'README.md');
    const readme = existsSync(readmePath) ? readText(readmePath) : '';
    const apps = readdirSync(join(root, 'manifests'))
      .filter((d) => statSync(join(root, 'manifests', d)).isDirectory() && !d.startsWith('_') && !d.startsWith('.'))
      .filter((d) => existsSync(join(root, 'manifests', d, `${d}.metainfo.xml`)))
      .map((id) => loadApp(root, id, readme))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!apps.length) throw new Error('upstream has no apps under manifests/');

    const updateCron = loadUpdateCron(root);
    const licensePath = join(root, 'LICENSE');
    const license = existsSync(licensePath) ? (readText(licensePath).match(/^(\w+) License/m)?.[1] ?? null) : null;
    return {
      ...loadSync(root),
      apps,
      docs: loadDocs(root),
      remote: loadRemote(root),
      key: await loadKey(root),
      updateCron,
      updateEvery: describeCron(updateCron),
      license,
    };
  })();
  return cached;
}
