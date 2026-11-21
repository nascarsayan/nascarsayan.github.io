/**
 * Chronicle: a chronological, nested-box story of how a system got built (and torn down).
 *
 * Boxes nest (site > machine > container > VM > pod). The viewer shows two layers at a time: the focused box
 * large, its parent as a narrow rail beside it. Events play in order: boxes appear and disappear, data pieces
 * (files, images, commands) travel between boxes as moving dots and stay on the box they reach, statuses
 * change, callouts point at boxes, and log lines appear in the log pane below. After each stage the viewer is
 * free: maximize / minimize / restore any box, open any data piece.
 *
 * A story has one happy path and any number of failure paths. A failure path starts from the happy path's
 * state at the beginning of stage `forkAt` and replaces the rest: what broke, and why the happy path does
 * what it does. Used by components/content/Chronicle.astro (server) and scripts/chronicle.ts (client).
 */
export type Tone = 'note' | 'good' | 'warn' | 'risk';
export type Status = 'off' | 'boot' | 'ok' | 'warn' | 'fail';
export type Phase = 'preflight' | 'setup' | 'validate' | 'teardown' | 'fail';
export type BoxKind = 'world' | 'site' | 'machine' | 'vm' | 'container' | 'process' | 'store' | 'k8s' | 'pod' | 'external';
export type ArtKind = 'file' | 'yaml' | 'image' | 'cmd' | 'script' | 'secret' | 'metric' | 'pkg' | 'log' | 'net';

export interface CBox {
  id: string;
  label: string;
  /** One short line under the label (role, address, version). */
  sub?: string;
  kind: BoxKind;
  parent?: string;
  /** Markdown (diagrams/md.ts): what it is, low-level facts. Shown in the details panel. */
  info?: string;
  /** Exists before the first event (otherwise it appears with a `spawn`). */
  initial?: boolean;
  /** Icon name from diagrams/icons.ts (brand logo or a simple generic shape). */
  icon?: string;
  /** Link to the code or config behind it (https). */
  src?: string;
  /** Extra importance for its tile size (added to what the viewer computes from activity). */
  weight?: number;
}

/** A code pointer: link text and an https URL (pin it to a commit). */
export interface CLink { label: string; href: string }

export interface CArt {
  id: string;
  /** Chip text: a few words. */
  label: string;
  kind: ArtKind;
  /** Details panel heading (default: label). */
  title?: string;
  /** Markdown note above the code. */
  note?: string;
  /** The essential part, shown first (a few lines). */
  brief?: string;
  /** The full content (shown under "Full"). */
  body?: string;
  /** Workaround IDs this piece carries (W-SIM-NET, ...). */
  refs?: string[];
  /** Link to the file it comes from (https). */
  src?: string;
  /** Shiki language of `brief` and `body` (default from the kind: artLang). 'text' turns highlighting off. */
  lang?: string;
}

/** Highlighting language of a data piece's code: its `lang`, else yaml for yaml pieces, bash for commands and scripts. */
export const artLang = (a: Pick<CArt, 'kind' | 'lang'>) =>
  a.lang ?? ({ yaml: 'yaml', cmd: 'bash', script: 'bash', log: 'log' } as Record<string, string>)[a.kind] ?? 'text';

export type CEv =
  | { focus: string }
  | { spawn: string | string[]; status?: Status }
  | { kill: string | string[] }
  | { send: string; from: string; to: string; keep?: boolean }
  | { place: string; on: string }
  | { drop: string }
  | { status: string | string[]; is: Status; badge?: string }
  | { call: string; at: string; tone?: Tone; ref?: string }
  | { log: string | string[] }
  | { wait: number };

export interface CStage {
  id: string;
  title: string;
  phase: Phase;
  /** Wall-clock start (UTC, as in the run's log) and duration, as text. */
  when?: string;
  took?: string;
  /** Duration in seconds: drives the elapsed-time clock (stages follow each other with no gap). */
  secs?: number;
  /** Markdown: what this stage does and why. */
  about: string;
  /** The code that does it. */
  code?: CLink[];
  events: CEv[];
}

export interface CPath {
  id: string;
  title: string;
  kind: 'happy' | 'failure';
  /** Failure paths: the happy-path stage they replace (they start from the state at its beginning). */
  forkAt?: string;
  /** Failure paths: the warning shown before playing (what the reader is about to see). */
  spoiler?: string;
  /** Failure paths: what it taught, shown at the end (Markdown). */
  lesson?: string;
  /** Workaround IDs the lesson explains. */
  refs?: string[];
  /** Code behind the fix. */
  code?: CLink[];
  stages: CStage[];
}

export interface Chronicle {
  title: string;
  /** The outermost box (kind 'world'). */
  root: string;
  boxes: CBox[];
  arts: CArt[];
  paths: CPath[];
  /** Short names for workaround IDs, shown on callouts and data pieces. */
  refs?: Record<string, string>;
  /** Markdown note on where the logs come from. */
  source?: string;
}

import { ICONS } from './icons';

export const defineChronicle = (c: Chronicle) => c;

const evIds = (e: CEv): { boxes: string[]; arts: string[]; ref?: string } => {
  const a = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
  if ('focus' in e) return { boxes: [e.focus], arts: [] };
  if ('spawn' in e) return { boxes: a(e.spawn), arts: [] };
  if ('kill' in e) return { boxes: a(e.kill), arts: [] };
  if ('send' in e) return { boxes: [e.from, e.to], arts: [e.send] };
  if ('place' in e) return { boxes: [e.on], arts: [e.place] };
  if ('drop' in e) return { boxes: [], arts: [e.drop] };
  if ('status' in e) return { boxes: a(e.status), arts: [] };
  if ('call' in e) return { boxes: [e.at], arts: [], ref: e.ref };
  return { boxes: [], arts: [] };
};

/** Build-time checks: every id resolves, one happy path first, forks name a happy stage. Returns errors. */
export function checkChronicle(c: Chronicle): string[] {
  const err: string[] = [];
  const boxes = new Map(c.boxes.map((b) => [b.id, b]));
  const arts = new Set(c.arts.map((x) => x.id));
  if (boxes.size !== c.boxes.length) err.push('duplicate box id');
  if (arts.size !== c.arts.length) err.push('duplicate data piece id');
  if (!boxes.has(c.root)) err.push(`root ${c.root} is not a box`);
  for (const b of c.boxes) {
    if (b.id !== c.root && !b.parent) err.push(`box ${b.id} has no parent`);
    if (b.parent && !boxes.has(b.parent)) err.push(`box ${b.id}: parent ${b.parent} is not a box`);
    if (b.icon && !(b.icon in ICONS)) err.push(`box ${b.id}: unknown icon ${b.icon}`);
  }
  const https = (where: string, u?: string) => { if (u !== undefined && !/^https:\/\/[^\s"<>]+$/.test(u)) err.push(`${where}: link must be an https URL: ${u}`); };
  for (const b of c.boxes) https(`box ${b.id}`, b.src);
  for (const a of c.arts) https(`data piece ${a.id}`, a.src);
  for (const p of c.paths) { for (const l of p.code ?? []) https(`path ${p.id}`, l.href); for (const s of p.stages) for (const l of s.code ?? []) https(`stage ${s.id}`, l.href); }
  if (c.paths[0]?.kind !== 'happy' || c.paths.filter((p) => p.kind === 'happy').length !== 1) err.push('exactly one happy path, listed first');
  const happy = c.paths[0];
  const stageIds = new Set(happy?.stages.map((s) => s.id));
  for (const p of c.paths) {
    if (p.kind === 'failure') {
      if (!p.forkAt || !stageIds.has(p.forkAt)) err.push(`path ${p.id}: forkAt ${p.forkAt} is not a happy-path stage`);
      if (!p.spoiler || !p.lesson) err.push(`path ${p.id}: a failure path needs spoiler and lesson`);
    }
    for (const s of p.stages) for (const e of s.events) {
      const ids = evIds(e);
      for (const b of ids.boxes) if (!boxes.has(b)) err.push(`${p.id}/${s.id}: unknown box ${b}`);
      for (const x of ids.arts) if (!arts.has(x)) err.push(`${p.id}/${s.id}: unknown data piece ${x}`);
      if (ids.ref && c.refs && !c.refs[ids.ref]) err.push(`${p.id}/${s.id}: unknown ref ${ids.ref}`);
    }
  }
  return err;
}
