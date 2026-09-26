// Fetches first-storm/aiextra-flatpak into .upstream/ (or $UPSTREAM_DIR) so the
// site can be generated from its manifests. UPSTREAM_REF may be a branch, tag
// or commit SHA. Safe to re-run: the checkout is reset to the fetched commit.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = process.env.UPSTREAM_REPO || 'https://github.com/first-storm/aiextra-flatpak';
const ref = process.env.UPSTREAM_REF || 'main';
const dir = resolve(process.env.UPSTREAM_DIR || '.upstream');
const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' };

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'] }).trim();

if (!existsSync(resolve(dir, '.git'))) {
  git('init', '--quiet', dir);
  git('-C', dir, 'remote', 'add', 'origin', repo);
}
git('-C', dir, 'fetch', '--quiet', '--depth', '1', 'origin', ref);
git('-C', dir, 'checkout', '--quiet', '--force', '--detach', 'FETCH_HEAD');
git('-C', dir, 'clean', '-fdq', '-e', '.sync.json');

const sync = {
  repo,
  ref,
  sha: git('-C', dir, 'rev-parse', 'HEAD'),
  date: git('-C', dir, 'log', '-1', '--format=%cI'),
};
writeFileSync(resolve(dir, '.sync.json'), JSON.stringify(sync, null, 2) + '\n');
console.log(`upstream ${sync.ref} @ ${sync.sha.slice(0, 7)} (${sync.date}) -> ${dir}`);
