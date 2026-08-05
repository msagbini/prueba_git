#!/usr/bin/env node
/**
 * Fails with a non-zero exit code if any directory that is required to
 * document itself (per CONTRIBUTING.md: "every module has a README.md") is
 * missing one. Run via `pnpm docs:check-readmes`, wired into CI.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Returns the immediate subdirectories of `dir`, excluding node_modules and dotfiles.
 * @param {string} dir absolute path to scan
 * @returns {string[]} absolute paths of subdirectories
 */
function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isDirectory());
}

const requiredReadmeDirs = [
  ...subdirs(join(ROOT, 'apps')),
  ...subdirs(join(ROOT, 'packages')),
  ...subdirs(join(ROOT, 'apps', 'api', 'src', 'modules')),
];

const missing = requiredReadmeDirs.filter((dir) => !existsSync(join(dir, 'README.md')));

if (missing.length > 0) {
  console.error('Missing required README.md in:');
  for (const dir of missing) console.error(`  - ${dir.replace(ROOT, '')}`);
  process.exit(1);
}

console.log(`OK — ${requiredReadmeDirs.length} module(s) all have a README.md.`);
