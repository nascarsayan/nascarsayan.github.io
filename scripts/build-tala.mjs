#!/usr/bin/env node
/**
 * Build tools/tala-layout (TALA layout engine, Go) into .tools/tala-layout.
 * Rebuilds when its sources change. Needs Go >= 1.27 on PATH (or GO=/path/to/go).
 * Modules are verified against tools/tala-layout/go.sum (-mod=readonly).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'tools', 'tala-layout');
// Windows only spawns executables that carry an .exe extension.
const OUT = join(ROOT, '.tools', process.platform === 'win32' ? 'tala-layout.exe' : 'tala-layout');
const STAMP = `${OUT}.rev`;
const rev = createHash('sha256');
for (const f of ['main.go', 'go.mod', 'go.sum']) rev.update(readFileSync(join(SRC, f)));
const want = rev.digest('hex');
if (existsSync(OUT) && existsSync(STAMP) && readFileSync(STAMP, 'utf8') === want) process.exit(0);

// Go to use: $GO, else the first of `go` on PATH and mise's pinned go@1.27.3
// that is new enough (a shell's default go may be an older toolchain).
const GO_PIN = 'go@1.27.3';
const goVersion = (bin) => {
  try { return execFileSync(bin, ['env', 'GOVERSION'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
};
const newEnough = (v) => { const [maj, min] = v.replace(/^go/, '').split('.').map(Number); return maj > 1 || (maj === 1 && min >= 27); };
const candidates = process.env.GO ? [process.env.GO] : ['go'];
if (!process.env.GO) {
  try { candidates.push(execFileSync('mise', ['which', 'go', '--tool', GO_PIN], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* no mise */ }
}
let go = candidates[0], version = '';
for (const c of candidates) {
  const v = goVersion(c);
  if (v && newEnough(v)) { go = c; version = v; break; }
  if (v && !version) { go = c; version = v; }
}
if (!version) {
  // TALA is optional: diagrams fall back to the columns layout without it.
  console.warn('build-tala: Go not found; skipping TALA (graphs use the columns layout). Install Go >= 1.27 (e.g. `mise install go@1.27.3`) or set GO=/path/to/go.');
  process.exit(0);
}
const [maj, min] = version.replace(/^go/, '').split('.').map(Number);
if (maj < 1 || (maj === 1 && min < 27)) {
  console.warn(`build-tala: need Go >= 1.27, found ${version}; skipping TALA (graphs use the columns layout). Set GO=/path/to/go.`);
  process.exit(0);
}
mkdirSync(join(ROOT, '.tools'), { recursive: true });
execFileSync(go, ['build', '-mod=readonly', '-trimpath', '-o', OUT, '.'], {
  cwd: SRC,
  stdio: 'inherit',
  env: { ...process.env, CGO_ENABLED: '0' },
});
writeFileSync(STAMP, want);
console.log(`build-tala: built .tools/tala-layout with ${version}`);
