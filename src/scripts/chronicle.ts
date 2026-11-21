/**
 * <Chronicle> behaviour (format: src/diagrams/chronicle.ts).
 *
 * State is a pure function of (path, position): replaying events without animation gives the picture at any
 * point, so seeking, clicking a log line or switching path is a replay. Live playback animates each event
 * (dots travel between box rectangles, a focus change grows the new frame from where its box was) and then
 * applies it. Between stages the reader is free: maximize (focus), minimize, restore, open any piece.
 * Text from the spec is put in with textContent and the small Markdown tree, never as HTML.
 */
import type { CArt, CBox, CEv, Chronicle, CPath, CStage, Status, Tone } from '@/diagrams/chronicle';
import { parseMd, type Inline } from '@/diagrams/md';
import { playSound } from './sound';
import { ICONS } from '@/diagrams/icons';
import { index as modelIndex, KIND_TAG, layoutFor, splitIdle, TILE, UNITS, type Index } from '@/diagrams/chronicle-model';

const SVGNS = 'http://www.w3.org/2000/svg';
/** A small branch glyph (two lines splitting), drawn: the font has no fork character. */
function forkIcon() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVGNS, 'path');
  p.setAttribute('d', 'M6 3v8c0 4 4 5 6 6s6 2 6 4M6 11v10M18 3v6');
  svg.append(p);
  return svg;
}
function icon(name: string | undefined) {
  const i = name ? (ICONS as Record<string, { title: string; color: string; path: string }>)[name] : undefined;
  if (!i) return null;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ch-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', i.path);
  path.setAttribute('fill', i.color);
  svg.append(path);
  return svg;
}

// Slow on purpose: each event is something to follow (ms at 1×; the speed button divides them).
const DUR: Record<string, number> = { focus: 1800, spawn: 1100, kill: 1100, send: 2600, place: 600, drop: 500, status: 800, call: 700, log: 600 };
const SPEEDS = [0.5, 1, 2, 4];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Call { text: string; at: string; tone: Tone; ref?: string; pos: number }
interface Line { text: string; pos: number; stage: number; head?: boolean; gen?: boolean }
interface State {
  alive: Set<string>;
  status: Map<string, Status>;
  badge: Map<string, string>;
  arts: Map<string, string[]>;
  calls: Call[];
  focus: string;
  lines: Line[];
}
interface Flat { ev: CEv; stage: number; pos: number }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const btn = (cls: string, text: string, title: string, on: (e: MouseEvent) => void) => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', (e) => { e.stopPropagation(); on(e); });
  return b;
};
/**
 * Window buttons, drawn (not glyphs: at 13 px "❐" and "▢" look alike). Maximize: one square. Restore: the front
 * square and, set off by a clear gap on both sides, the top and right edges of the square behind it. Minimize:
 * a bar at the bottom, like a window going to the taskbar.
 */
const WIN_ICON = {
  max: 'M3.5 3.5h9v9h-9z',
  restore: 'M2.5 6.5h7v7h-7zM6.5 4.5V2.5h7v7h-2',
  min: 'M4 12h8',
} as const;
const tb = (icon: keyof typeof WIN_ICON, title: string, on: (e: MouseEvent) => void) => {
  const b = btn(`ch-tb ch-tb-${icon}`, '', title, on);
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', WIN_ICON[icon]);
  svg.append(path);
  b.append(svg);
  return b;
};
function inline(items: Inline[], into: HTMLElement) {
  for (const i of items) {
    if (i.t === 'text') into.append(i.v);
    else if (i.t === 'code') into.append(el('code', undefined, i.v));
    else if (i.t === 'strong' || i.t === 'em') { const x = el(i.t); inline(i.c, x); into.append(x); }
    else { const a = el('a'); a.href = i.href; if (i.external) { a.target = '_blank'; a.rel = 'noopener'; } inline(i.c, a); into.append(a); }
  }
}
/** External code link (spec URLs are checked https at build time). */
function link(label: string, href: string, cls = 'ch-link') {
  const a = el('a', cls, label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}
function codeRow(links: { label: string; href: string }[] | undefined) {
  if (!links?.length) return null;
  const r = el('p', 'ch-code');
  r.append(el('span', 'ch-code-h', 'Code'));
  for (const l of links) r.append(link(l.label, l.href));
  return r;
}

function md(src: string | undefined, cls = 'ch-md') {
  const d = el('div', cls);
  for (const b of parseMd(src ?? '')) {
    if (b.t === 'p') { const p = el('p'); inline(b.c, p); d.append(p); }
    else { const ul = el('ul'); for (const it of b.items) { const li = el('li'); inline(it, li); ul.append(li); } d.append(ul); }
  }
  return d;
}

const clock = (secs: number) => {
  const t = Math.round(secs);
  return `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s`;
};

const ART_TAG: Record<string, string> = { file: 'file', yaml: 'yaml', image: 'image', cmd: 'cmd', script: 'script', secret: 'secret', metric: 'metric', pkg: 'pkg', log: 'log', net: 'net' };

import { CH_THEMES } from '@/diagrams/chronicle-themes';

/** The reader's theme choice (a UI preference, nothing sensitive), shared by every timeline on the site. */
const THEME_KEY = 'ch-theme';
const THEME_IDS = new Set(CH_THEMES.map((t) => t.id));
function savedTheme(): string {
  try {
    const v = localStorage.getItem(THEME_KEY) ?? '';
    return THEME_IDS.has(v) ? v : '';
  } catch { return ''; }
}
function applyTheme(id: string) {
  const v = THEME_IDS.has(id) ? id : '';
  document.querySelectorAll<HTMLElement>('[data-chronicle]').forEach((r) => {
    if (v) r.dataset.themeName = v; else delete r.dataset.themeName;
    const sel = r.querySelector<HTMLSelectElement>('[data-ch="theme"]');
    if (sel) sel.value = v;
  });
  try { if (v) localStorage.setItem(THEME_KEY, v); else localStorage.removeItem(THEME_KEY); } catch { /* private mode */ }
}

export function initChronicles() {
  applyTheme(savedTheme());
  document.querySelectorAll<HTMLSelectElement>('[data-chronicle] [data-ch="theme"]').forEach((sel) => {
    if (sel.dataset.bound) return;
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => applyTheme(sel.value));
  });
  document.querySelectorAll<HTMLElement>('[data-chronicle]').forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    const json = root.querySelector('script[type="application/json"]')?.textContent;
    if (!json) return;
    new Player(root, JSON.parse(json) as Chronicle);
  });
}

/** Longest series animation of the timeline bar, ms. */
const SEG_ANIM = 600;

class Player {
  private c: Chronicle;
  private boxes: Map<string, CBox>;
  private arts: Map<string, CArt>;
  private kids = new Map<string, string[]>();
  private ix!: Index;
  private path!: CPath;
  private flat: Flat[] = [];
  /** First event index of each stage (shown stages: prefix stages of a failure path count as one block). */
  private starts: number[] = [];
  private stages: CStage[] = [];
  /** Failure paths: how many leading stages are the happy-path prefix. */
  private prefix = 0;
  /** Seconds since the start at the beginning of each stage (last entry: the total). */
  private t0: number[] = [];
  /** Where each sub-step ends: one event that changes the picture, plus the log lines after it. */
  private stepEnds: number[] = [];
  /** Generated narration for a step with no log lines of its own, keyed by its picture-changing event. */
  private gen = new Map<number, string>();
  private pos = 0;
  private st!: State;
  private playing = false;
  /** The stage the caption shows (the one Next plays when it has not played yet). */
  private cur = 0;
  /** Callout markers already opened in this stage (they go away once read). */
  private opened = new Set<number>();
  private speed = 1;
  private token = 0;
  private minimized = new Set<string>();
  private ui: Record<string, HTMLElement> = {};
  /** The control the reader clicked last: details open under it. */
  private anchor: HTMLElement | null = null;
  /** The bottom bar's tray (boxes with nothing to open) is open. */
  private trayOpen = false;
  /** The timeline the reader used last: the arrow keys drive it. */
  static current: Player | null = null;

  constructor(private root: HTMLElement, c: Chronicle) {
    this.c = c;
    this.boxes = new Map(c.boxes.map((b) => [b.id, b]));
    this.arts = new Map(c.arts.map((a) => [a.id, a]));
    for (const b of c.boxes) if (b.parent) this.kids.set(b.parent, [...(this.kids.get(b.parent) ?? []), b.id]);
    this.ix = modelIndex(c);
    this.build();
    this.usePath(c.paths[0].id, false);
    // Static (<Chronicle static>): no playback; open on the final state, the reader only moves between boxes.
    if (this.still) this.seek(this.flat.length);
  }

  /** A data piece's code: the build-time highlighted copy (Chronicle.astro templates), else plain text. */
  private codeBlock(id: string, part: 'brief' | 'body', text: string): HTMLElement {
    const t = [...this.root.querySelectorAll<HTMLTemplateElement>('template[data-ch-code]')].find((x) => x.dataset.chCode === `${id}|${part}`);
    const pre = t?.content.querySelector('pre');
    if (pre) return pre.cloneNode(true) as HTMLElement;
    const plain = el('pre');
    plain.append(el('code', undefined, text));
    return plain;
  }

  /** No playback: the stage strip, step controls and log are hidden (chronicle.css .is-static). */
  private get still() { return this.root.dataset.static === '1'; }

  // ---------------------------------------------------------------- model

  private usePath(id: string, play: boolean) {
    const p = this.c.paths.find((x) => x.id === id) ?? this.c.paths[0];
    this.path = p;
    this.flat = [];
    this.starts = [];
    this.stages = [];
    const happy = this.c.paths[0];
    let stages: CStage[] = p.stages;
    this.prefix = 0;
    if (p.kind === 'failure') {
      const at = happy.stages.findIndex((s) => s.id === p.forkAt);
      stages = [...happy.stages.slice(0, at), ...p.stages];
      this.prefix = at;
    }
    stages.forEach((s, i) => {
      this.starts.push(this.flat.length);
      this.stages.push(s);
      for (const ev of s.events) this.flat.push({ ev, stage: i, pos: this.flat.length });
    });
    this.starts.push(this.flat.length);
    // Steps: each picture-changing event, with the log lines around it (before it, up to the next change).
    // A step's log lines are its narration; a step without any gets a short generated line.
    this.stepEnds = [];
    this.gen.clear();
    const isChange = (e: CEv) => !('log' in e) && !('wait' in e);
    stages.forEach((_, si) => {
      let start = this.starts[si];
      let change = -1;
      const close = (end: number) => {
        if (end <= start) return;
        const hasLog = this.flat.slice(start, end).some((f) => 'log' in f.ev);
        if (!hasLog && change >= 0) this.gen.set(change, this.narrate(this.flat[change].ev));
        this.stepEnds.push(end);
      };
      for (let i = this.starts[si]; i < this.starts[si + 1]; i++) {
        if (!isChange(this.flat[i].ev)) continue;
        // A callout marker belongs to the change before it in the stage: no step of its own.
        if ('call' in this.flat[i].ev && change >= 0) continue;
        if (change >= 0) { close(i); start = i; }
        change = i;
      }
      close(this.starts[si + 1]);
    });
    this.t0 = [0];
    for (const s of stages) this.t0.push(this.t0[this.t0.length - 1] + (s.secs ?? 0));
    this.root.classList.toggle('is-failure', p.kind === 'failure');
    this.minimized.clear();
    const first = p.kind === 'failure' ? this.prefix : 0;
    this.seek(this.starts[first], first);
    this.drawPaths();
    this.drawTimeline();
    if (play) void this.nextStep();
  }

  private fresh(): State {
    const alive = new Set(this.c.boxes.filter((b) => b.initial || b.id === this.c.root).map((b) => b.id));
    return { alive, status: new Map(), badge: new Map(), arts: new Map(), calls: [], focus: this.c.root, lines: [] };
  }

  private descendants(id: string): string[] {
    const out: string[] = [];
    const walk = (x: string) => { for (const k of this.kids.get(x) ?? []) { out.push(k); walk(k); } };
    walk(id);
    return out;
  }

  private apply(st: State, f: Flat) {
    const e = f.ev;
    const list = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
    if ('focus' in e) st.focus = e.focus;
    else if ('spawn' in e) for (const b of list(e.spawn)) {
      // A box appears inside its parent: make the parent chain alive too.
      for (let x: string | undefined = b; x; x = this.boxes.get(x)?.parent) st.alive.add(x);
      if (e.status) st.status.set(b, e.status);
    }
    else if ('kill' in e) for (const b of list(e.kill)) {
      for (const x of [b, ...this.descendants(b)]) { st.alive.delete(x); st.arts.delete(x); st.status.delete(x); st.badge.delete(x); }
      while (!st.alive.has(st.focus)) st.focus = this.boxes.get(st.focus)?.parent ?? this.c.root;
    }
    else if ('send' in e) { if (e.keep !== false) this.addArt(st, e.to, e.send); }
    else if ('place' in e) this.addArt(st, e.on, e.place);
    else if ('drop' in e) for (const [k, v] of st.arts) st.arts.set(k, v.filter((a) => a !== e.drop));
    else if ('status' in e) for (const b of list(e.status)) { st.status.set(b, e.is); if (e.badge !== undefined) st.badge.set(b, e.badge); }
    else if ('call' in e) st.calls.push({ text: e.call, at: e.at, tone: e.tone ?? 'note', ref: e.ref, pos: f.pos });
    else if ('log' in e) for (const t of list(e.log)) st.lines.push({ text: t, pos: f.pos, stage: f.stage });
  }

  private addArt(st: State, box: string, art: string) {
    const v = st.arts.get(box) ?? [];
    if (!v.includes(art)) st.arts.set(box, [...v, art]);
  }

  /** State after the first n events (callouts only of the stage n is in). */
  private stateAt(n: number): State {
    const st = this.fresh();
    let stage = -1;
    for (let i = 0; i < n; i++) {
      const f = this.flat[i];
      if (f.stage !== stage) {
        stage = f.stage;
        st.calls = [];
        st.lines.push({ text: this.stageHead(stage), pos: i, stage, head: true });
      }
      const g = this.gen.get(i);
      if (g) st.lines.push({ text: g, pos: i, stage: f.stage, gen: true });
      this.apply(st, f);
    }
    return st;
  }

  /** A short line saying what an event is about to do (for steps that have no log line). */
  private narrate(e: CEv): string {
    const n = (id: string) => this.boxes.get(id)?.label ?? id;
    const ns = (v: string | string[]) => (Array.isArray(v) ? v : [v]).map(n).join(', ');
    const a = (id: string) => this.arts.get(id)?.label ?? id;
    let t = '';
    if ('focus' in e) t = `look inside ${n(e.focus)}`;
    else if ('spawn' in e) { const ids = Array.isArray(e.spawn) ? e.spawn : [e.spawn]; t = `start ${ns(e.spawn)} on ${n(this.boxes.get(ids[0])?.parent ?? '')}`; }
    else if ('kill' in e) t = `remove ${ns(e.kill)}`;
    else if ('send' in e) t = `${n(e.from)} → ${n(e.to)}: ${a(e.send)}`;
    else if ('place' in e) t = `${a(e.place)} on ${n(e.on)}`;
    else if ('drop' in e) t = `remove ${a(e.drop)}`;
    else if ('status' in e) t = `${ns(e.status)}: ${e.is}${e.badge ? ` (${e.badge})` : ''}`;
    else if ('call' in e) t = `${e.tone === 'risk' ? 'problem' : e.tone === 'warn' ? 'workaround' : e.tone === 'good' ? 'result' : 'note'} on ${n(e.at)}${e.ref ? ` (${e.ref})` : ''}: open the marker`;
    return `› ${t}`;
  }

  private stageHead(i: number) {
    const s = this.stages[i];
    return `── ${i + 1}/${this.stages.length} ${s.title}${s.when ? ` · ${s.when}` : ''}${s.took ? ` · ${s.took}` : ''}`;
  }

  private stageOf(pos: number) {
    let i = 0;
    while (i + 1 < this.stages.length && this.starts[i + 1] <= pos) i++;
    return i;
  }

  // ---------------------------------------------------------------- playback

  /** Show the system after n events; `cur` is the stage to caption (default: the stage of event n-1). */
  private seek(n: number, cur = this.stageOf(Math.max(0, n - 1))) {
    this.token++;
    this.playing = false;
    this.cur = cur;
    this.opened.clear();
    this.pos = Math.max(0, Math.min(this.flat.length, n));
    this.st = this.stateAt(this.pos);
    this.render();
    this.drawLog();
    this.drawChrome();
  }

  private sleep(ms: number, tok: number) {
    return new Promise<boolean>((r) => setTimeout(() => r(tok === this.token), reduced() ? 0 : ms / this.speed));
  }

  /** The reader left the view the current step expects: another box maximized, or boxes minimized. */
  private wandered(): boolean {
    if (this.playing || this.pos === 0) return false;
    return this.stateAt(this.pos).focus !== this.st.focus || this.minimized.size > 0;
  }

  /** Back to the view the current step expects: its focused box, nothing minimized, no popover. */
  private goBack() {
    const expected = this.stateAt(this.pos).focus;
    this.ui.detail.hidden = true;
    this.trayOpen = false;
    this.minimized.clear();
    if (expected !== this.st.focus) this.setFocus(expected); else this.render();
  }

  /** Play one sub-step (one event plus its log lines), then stop. While one plays, Next finishes it. */
  private async nextStep() {
    if (this.playing) { const e = this.stepEnds.find((x) => x > this.pos) ?? this.flat.length; this.seek(e, this.flat[e - 1]?.stage ?? this.cur); return; }
    if (this.pos >= this.flat.length) return;
    // If the reader wandered off (another box maximized, boxes minimized, a popover open), go back to the view
    // this step expects first.
    if (this.wandered() || this.trayOpen || !this.ui.detail.hidden) {
      this.goBack();
      const t = ++this.token;
      if (!(await this.sleep(700, t))) return;
    }
    const end = this.stepEnds.find((x) => x > this.pos) ?? this.flat.length;
    const stage = this.flat[this.pos].stage;
    const tok = ++this.token;
    this.playing = true;
    if (this.pos === this.starts[stage]) {
      // A new stage: earlier callouts go, its heading starts the log.
      this.cur = stage;
      this.st.calls = [];
      this.opened.clear();
      this.render();
      this.st.lines.push({ text: this.stageHead(stage), pos: this.pos, stage, head: true });
      this.drawLog();
    }
    this.drawChrome();
    // 1. Say what will happen: the step's log lines (or its generated line) type out first.
    const start = this.pos;
    for (let i = start; i < end; i++) {
      const f = this.flat[i];
      const texts = 'log' in f.ev ? (Array.isArray(f.ev.log) ? f.ev.log : [f.ev.log]) : this.gen.has(i) ? [this.gen.get(i)!] : [];
      for (const text of texts) {
        this.st.lines.push({ text, pos: i, stage, gen: !('log' in f.ev) });
        this.drawLog(start, end);
        if (!(await this.type(text, tok))) return;
      }
    }
    // 2. Then the picture changes (log events are already shown).
    while (tok === this.token && this.pos < end) {
      const f = this.flat[this.pos];
      if (!('log' in f.ev) && !(await this.animate(f, tok))) return;
      this.pos++;
    }
    if (tok !== this.token) return;
    this.playing = false;
    this.drawLog();
    this.drawChrome();
    if (this.pos >= this.flat.length && this.path.kind === 'failure') this.showLesson();
  }

  /** Type the newest log line out, character by character. */
  private async type(text: string, tok: number) {
    const row = this.ui.log.querySelector<HTMLElement>('.ch-line.is-typing');
    if (!row || reduced()) return this.sleep(250, tok);
    const ms = Math.min(1600, 16 * text.length) / this.speed;
    const t0 = performance.now();
    while (tok === this.token) {
      const k = Math.min(text.length, Math.ceil(((performance.now() - t0) / ms) * text.length));
      row.textContent = text.slice(0, k);
      if (k >= text.length) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    row.classList.remove('is-typing');
    return this.sleep(450, tok);
  }

  /** Back one sub-step (no animation). */
  private prevStep() {
    const floor = this.path.kind === 'failure' ? this.starts[this.prefix] : 0;
    const e = [...this.stepEnds].reverse().find((x) => x < this.pos && x >= floor) ?? floor;
    this.seek(e, e === floor ? this.flat[floor]?.stage ?? 0 : this.flat[e - 1].stage);
  }

  /** The end of the next stage (no animation). */
  private nextStage() {
    const target = this.pos < this.starts[this.cur + 1] ? this.cur : Math.min(this.stages.length - 1, this.cur + 1);
    this.seek(this.starts[target + 1], target);
  }

  /** The end of the previous stage (no animation). */
  private prevStage() {
    const first = this.path.kind === 'failure' ? this.prefix : 0;
    if (this.cur > first) this.seek(this.starts[this.cur], this.cur - 1);
    else this.seek(this.starts[first], first);
  }

  private pause() {
    if (!this.playing) return;
    this.token++;
    this.playing = false;
    // The animation in flight is dropped: show the state it would have reached.
    this.st = this.stateAt(this.pos);
    this.render();
    this.drawLog();
    this.drawChrome();
  }

  /** Animate one event, then apply it. False when cancelled. */
  private async animate(f: Flat, tok: number): Promise<boolean> {
    const e = f.ev;
    const stage = this.ui.stage;
    if ('wait' in e) return this.sleep(e.wait, tok);
    if ('send' in e && !reduced()) {
      const a = this.visible(e.from), b = this.visible(e.to);
      a?.classList.add('is-src');
      b?.classList.add('is-dst');
      if (a && b) await this.travel(a, b, this.arts.get(e.send)?.label ?? '', DUR.send, tok);
      if (tok !== this.token) return false;
      this.apply(this.st, f);
      this.render();
      // Keep both ends lit after the redraw, until the next step redraws them.
      this.visible(e.from)?.classList.add('is-src');
      this.visible(e.to)?.classList.add('is-dst');
      this.flash(this.ui.stage.querySelector(`[data-art="${CSS.escape(e.send)}"][data-on="${CSS.escape(e.to)}"]`));
      return this.sleep(500, tok);
    }
    if ('kill' in e && !reduced()) {
      const ids = Array.isArray(e.kill) ? e.kill : [e.kill];
      const els = ids.map((i) => stage.querySelector<HTMLElement>(`[data-box="${CSS.escape(i)}"]`)).filter((x): x is HTMLElement => !!x);
      els.forEach((x) => x.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.82)', filter: 'blur(2px)' }], { duration: DUR.kill / this.speed, fill: 'forwards', easing: 'ease-in' }));
      if (!(await this.sleep(DUR.kill, tok))) return false;
      this.apply(this.st, f);
      this.render();
      return this.sleep(400, tok);
    }
    if ('focus' in e && !reduced()) {
      this.focusMotion(e.focus, () => { this.apply(this.st, f); this.render(); }, DUR.focus / this.speed);
      return this.sleep(DUR.focus, tok);
    }
    this.apply(this.st, f);
    if ('log' in e) { this.drawLog(); return this.sleep(Math.min(2400, DUR.log * (Array.isArray(e.log) ? e.log.length : 1)), tok); }
    this.render();
    if ('spawn' in e && !reduced()) {
      for (const i of Array.isArray(e.spawn) ? e.spawn : [e.spawn]) {
        stage.querySelector<HTMLElement>(`[data-box="${CSS.escape(i)}"]`)?.animate([{ opacity: 0, transform: 'scale(0.86)' }, { opacity: 1, transform: 'none' }], { duration: DUR.spawn / this.speed, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
    if ('status' in e) for (const i of Array.isArray(e.status) ? e.status : [e.status]) this.flash(stage.querySelector(`[data-box="${CSS.escape(i)}"]`));
    if ('call' in e) playSound(e.tone === 'risk' ? 'c5xx' : e.tone === 'warn' ? 'c4xx' : 'tick');
    const k = Object.keys(e)[0];
    return this.sleep(DUR[k] ?? 300, tok);
  }

  private flash(x: Element | null) {
    (x as HTMLElement | null)?.animate([{ boxShadow: '0 0 0 0 var(--ch-accent)' }, { boxShadow: '0 0 0 6px transparent' }], { duration: 700 / this.speed });
  }

  /** A dot (and its label) along a gentle arc from one element's centre to another's. */
  private async travel(a: HTMLElement, b: HTMLElement, label: string, ms: number, tok: number) {
    const base = this.ui.stage.getBoundingClientRect();
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const p0 = { x: ra.left + ra.width / 2 - base.left, y: ra.top + Math.min(ra.height / 2, 28) - base.top };
    const p2 = { x: rb.left + rb.width / 2 - base.left, y: rb.top + Math.min(rb.height / 2, 28) - base.top };
    if (a === b) { p2.y += 1; }
    const lift = Math.min(90, Math.hypot(p2.x - p0.x, p2.y - p0.y) * 0.25);
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - lift };
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
      frames.push({ transform: `translate(${x}px, ${y}px)` });
    }
    const dot = el('div', 'ch-dot');
    dot.title = label;
    this.ui.stage.append(dot);
    playSound('syn');
    const anim = dot.animate(frames, { duration: ms / this.speed, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    await anim.finished.catch(() => undefined);
    dot.remove();
    if (tok === this.token) playSound('ack');
  }

  // ---------------------------------------------------------------- view

  private aliveKids(id: string) {
    return (this.kids.get(id) ?? []).filter((k) => this.st.alive.has(k));
  }

  /** The element that stands for a box now: itself, else its nearest shown ancestor. */
  private visible(id: string): HTMLElement | null {
    for (let x: string | undefined = id; x; x = this.boxes.get(x)?.parent) {
      const e = this.ui.stage.querySelector<HTMLElement>(`[data-box="${CSS.escape(x)}"]`);
      if (e) return e;
    }
    return null;
  }

  private stopForUser() {
    if (this.playing) this.pause();
  }

  private setFocus(id: string) {
    this.stopForUser();
    this.trayOpen = false;
    this.focusMotion(id, () => {
      this.st.focus = id;
      this.minimized.delete(id);
      this.render();
    }, 420);
    playSound('popDown');
  }

  /** `a` is `b` or one of its ancestors. */
  private isAncestor(a: string, b: string) {
    for (let x: string | undefined = b; x; x = this.boxes.get(x)?.parent) if (x === a) return true;
    return false;
  }

  /**
   * Window motion when the focused box changes, as on a desktop. Down (maximize): the new frame grows from the
   * box's tile to full size. Up (restore): the frame being left shrinks from full size back into its tile in the
   * parent's grid (the tile on the path to it, when going up several levels). Across (a sibling from the
   * taskbar): the new frame grows from wherever that box shows. `change` applies the new focus and renders.
   */
  private focusMotion(next: string, change: () => void, ms: number) {
    const prev = this.st.focus;
    const stage = this.ui.stage;
    const up = next !== prev && this.isAncestor(next, prev);
    // A window still moving (a click during the last maximize or restore) is measured where it ends, not mid-way:
    // getBoundingClientRect includes the running transform.
    for (const x of stage.querySelectorAll<HTMLElement>('.ch-frame, .ch-box')) for (const a of x.getAnimations()) a.finish();
    const full = up ? stage.querySelector<HTMLElement>('.ch-frame.is-focus')?.getBoundingClientRect() : undefined;
    const from = up ? undefined : this.visible(next)?.getBoundingClientRect();
    change();
    if (reduced()) return;
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    const fromTo = (a: DOMRect, b: DOMRect) => `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
    if (up) {
      let k = prev;
      while (this.boxes.get(k)?.parent && this.boxes.get(k)!.parent !== next) k = this.boxes.get(k)!.parent!;
      const tile = stage.querySelector<HTMLElement>(`.ch-box[data-box="${CSS.escape(k)}"]`);
      if (!full || !tile) return;
      const to = tile.getBoundingClientRect();
      if (!to.width || !to.height) return;
      // Above its neighbours while it shrinks, so the window lands on top of the grid.
      tile.style.zIndex = '5';
      tile.animate([
        { transformOrigin: 'top left', transform: fromTo(full, to), opacity: 0.85 },
        { transformOrigin: 'top left', transform: 'none', opacity: 1 },
      ], { duration: ms, easing: ease }).finished.finally(() => { tile.style.zIndex = ''; });
      return;
    }
    const frame = stage.querySelector<HTMLElement>('.ch-frame.is-focus');
    if (!from || !frame) return;
    frame.animate([
      { transformOrigin: 'top left', transform: fromTo(from, frame.getBoundingClientRect()), opacity: 0.6 },
      { transformOrigin: 'top left', transform: 'none', opacity: 1 },
    ], { duration: ms, easing: ease });
  }

  private statusDot(id: string) {
    const s = this.st.status.get(id);
    const d = el('span', `ch-st ch-st-${s ?? 'none'}`);
    if (s) d.title = s;
    return d;
  }

  /** Title bar: one line (icon, kind, status, name, badge, window buttons), the sub line under it. */
  private head(b: CBox, mode: 'frame' | 'box' | 'card') {
    const outer = el('div', 'ch-head');
    const h = el('div', 'ch-title');
    outer.append(h);
    const ic = icon(b.icon);
    if (ic) h.append(ic);
    const t = el('span', `ch-kind ch-kind-${b.kind}`, KIND_TAG[b.kind] ?? '');
    if (KIND_TAG[b.kind]) h.append(t);
    h.append(this.statusDot(b.id));
    const name = el('button', 'ch-name', b.label);
    name.type = 'button';
    name.title = `${b.label}: details`;
    name.addEventListener('click', (e) => { e.stopPropagation(); this.details({ box: b.id }); });
    h.append(name);
    const badge = this.st.badge.get(b.id);
    if (badge) h.append(el('span', 'ch-badge', badge));
    const tools = el('span', 'ch-tools');
    if (mode === 'frame' && b.id !== this.c.root && this.st.focus === b.id) {
      const up = b.parent ?? this.c.root;
      tools.append(tb('min', `Minimize ${b.label}`, () => { this.minimized.add(b.id); this.setFocus(up); }));
      tools.append(tb('restore', `Restore ${b.label} (show its parent)`, () => this.setFocus(up)));
    }
    if (mode === 'frame' && this.st.focus !== b.id) {
      tools.append(tb('restore', `Restore ${b.label}`, () => this.setFocus(b.id)));
    }
    if (mode === 'box') {
      tools.append(tb('min', `Minimize ${b.label}`, () => { this.stopForUser(); this.minimized.add(b.id); this.render(); }));
      if (this.aliveKids(b.id).length) tools.append(tb('max', `Maximize ${b.label}`, () => this.setFocus(b.id)));
    }
    if (mode === 'card' && this.aliveKids(b.id).length) tools.append(tb('max', `Maximize ${b.label}`, () => this.setFocus(b.id)));
    // A maximized box's details sit on its title line (a dot apart), so the title bar stays one line tall.
    if (b.sub && mode === 'frame') h.append(el('span', 'ch-sub ch-sub-inline', b.sub));
    h.append(tools);
    if (b.sub && mode === 'box') outer.append(el('span', 'ch-sub', b.sub));
    return outer;
  }

  private chips(id: string, max: number) {
    const v = this.st.arts.get(id) ?? [];
    const row = el('div', 'ch-arts');
    v.slice(0, max).forEach((a) => {
      const art = this.arts.get(a)!;
      const c = el('button', `ch-art ch-art-${art.kind}`);
      c.type = 'button';
      c.dataset.art = a;
      c.dataset.on = id;
      c.title = art.title ?? art.label;
      c.append(el('span', 'ch-art-k', ART_TAG[art.kind] ?? art.kind), el('span', 'ch-art-l', art.label));
      if (art.refs?.length) c.append(el('span', 'ch-art-ref', '!'));
      c.addEventListener('click', (e) => { e.stopPropagation(); this.details({ art: a }); });
      row.append(c);
    });
    if (v.length > max) {
      const more = btn('ch-art ch-more', `+${v.length - max}`, 'All data pieces here', () => this.details({ box: id }));
      row.append(more);
    }
    return row;
  }

  private boxEl(id: string) {
    const b = this.boxes.get(id)!;
    const d = el('div', `ch-box ch-k-${b.kind}`);
    d.dataset.box = id;
    d.append(this.head(b, 'box'));
    if (this.st.arts.get(id)?.length) d.append(this.chips(id, 4));
    const kids = this.aliveKids(id);
    if (kids.length) {
      const row = el('div', 'ch-pills');
      for (const k of kids) {
        const kb = this.boxes.get(k)!;
        const p = el('button', `ch-pill ch-k-${kb.kind}`);
        p.type = 'button';
        p.dataset.box = k;
        p.title = `${kb.label}: details`;
        const pi = icon(kb.icon);
        p.append(this.statusDot(k));
        if (pi) p.append(pi);
        p.append(el('span', undefined, kb.label));
        p.addEventListener('click', (e) => { e.stopPropagation(); this.details({ box: k }); });
        row.append(p);
      }
      d.append(row);
    }
    return d;
  }

  private frameEl(id: string, focus: boolean) {
    const b = this.boxes.get(id)!;
    const f = el('section', `ch-frame ch-k-${b.kind}${focus ? ' is-focus' : ''}`);
    f.dataset.box = id;
    f.append(this.head(b, 'frame'));
    if (this.st.arts.get(id)?.length) f.append(this.chips(id, 8));
    return f;
  }

  private render() {
    const stage = this.ui.stage;
    stage.querySelectorAll('.ch-desk, .ch-frame, .ch-calls').forEach((x) => x.remove());
    const F = this.st.focus;
    const fb = this.boxes.get(F)!;
    const P = F === this.c.root ? undefined : fb.parent;
    // The focused box fills the view and keeps its title bar (restore, minimize), like a maximized OS window.
    const focusFrame = el('section', `ch-frame ch-k-${fb.kind} is-focus`);
    focusFrame.dataset.box = F;
    if (P) focusFrame.append(this.head(fb, 'frame'));
    if (this.st.arts.get(F)?.length) focusFrame.append(this.chips(F, 8));
    const kids = this.aliveKids(F);
    const grid = el('div', 'ch-grid');
    const tray = el('div', 'ch-tray');
    // Boxes with nothing in them go to a strip under the grid (named items), the rest are tiles.
    const { idle } = splitIdle(this.ix, this.st, kids.filter((k) => !this.minimized.has(k)));
    const strip = el('div', 'ch-strip');
    for (const k of idle) {
      const kb = this.boxes.get(k)!;
      const it = btn(`ch-strip-item ch-k-${kb.kind}`, '', `${kb.label}: details`, () => this.details({ box: k }));
      it.dataset.box = k;
      const ii = icon(kb.icon);
      it.append(this.statusDot(k));
      if (ii) it.append(ii);
      it.append(el('span', 'ch-strip-name', kb.label));
      if (kb.sub) it.append(el('span', 'ch-strip-sub', kb.sub));
      const bd = this.st.badge.get(k);
      if (bd) it.append(el('span', 'ch-app-n', bd));
      strip.append(it);
    }
    for (const k of kids) {
      if (this.minimized.has(k)) {
        const kb = this.boxes.get(k)!;
        const t = el('span', 'ch-tray-item');
        t.dataset.box = k;
        t.append(this.statusDot(k), el('span', undefined, kb.label), tb('restore', `Restore ${kb.label}`, () => { this.minimized.delete(k); this.render(); }));
        tray.append(t);
      }
    }
    if (!kids.length) grid.append(el('p', 'ch-empty', 'Nothing runs inside this box at this point.'));
    focusFrame.append(grid);
    if (strip.childElementCount) focusFrame.append(strip);
    if (tray.childElementCount) focusFrame.append(tray);
    // The bottom bar, like an OS taskbar: the parent (back up), the focused box (active), the parent's other boxes.
    const desk = el('div', 'ch-desk');
    const bar = el('div', 'ch-taskbar');
    // Boxes scroll on the left; Go back and the tray chevron stay fixed at the right end.
    const apps = el('div', 'ch-bar-apps');
    const right = el('div', 'ch-bar-right');
    if (P) {
      const pb = this.boxes.get(P)!;
      const up = btn('ch-app is-up', '', `Show ${pb.label}`, () => this.setFocus(P));
      up.dataset.box = P;
      const ui = icon(pb.icon);
      if (ui) up.append(ui);
      up.append(el('span', undefined, pb.label));
      apps.append(up);
    }
    // The parent's boxes in their fixed (spec) order; the focused one is the active app, in its place. Boxes that
    // cannot be maximized (nothing inside) wait in a tray behind a chevron, like an OS's hidden tray icons.
    const hidden: string[] = [];
    for (const sid of P ? this.aliveKids(P) : [F]) {
      const sb = this.boxes.get(sid)!;
      const active = sid === F;
      if (!active && !this.aliveKids(sid).length) { hidden.push(sid); continue; }
      const app = btn(`ch-app ch-k-${sb.kind}${active ? ' is-active' : ''}`, '', active ? `${sb.label}: details` : `Show ${sb.label}`,
        () => (active ? this.details({ box: sid }) : this.setFocus(sid)));
      if (!active) app.dataset.box = sid;
      const si = icon(sb.icon);
      app.append(this.statusDot(sid));
      if (si) app.append(si);
      app.append(el('span', undefined, sb.label));
      if (active && sb.sub) app.append(el('span', 'ch-app-sub', sb.sub));
      const badge = active ? this.st.badge.get(sid) : undefined;
      const n = active ? 0 : this.st.arts.get(sid)?.length ?? 0;
      if (badge) app.append(el('span', 'ch-app-n', badge));
      else if (n) app.append(el('span', 'ch-app-n', String(n)));
      apps.append(app);
    }
    // Right end, fixed order: Go back (only while wandered), then the tray chevron at the far right.
    if (this.wandered()) {
      const back = btn('ch-app ch-goback', '', this.still ? 'Back to the top view' : 'Back to the view this step shows', () => this.goBack());
      back.append(el('span', 'ch-goback-i', '↩'), el('span', undefined, this.still ? 'Top view' : 'Go back'));
      right.append(back);
    }
    if (hidden.length) {
      const wrap = el('span', 'ch-traywrap');
      const chev = btn(`ch-app ch-chev${this.trayOpen ? ' is-open' : ''}`, '', this.trayOpen ? 'Hide the other boxes' : `Show ${hidden.length} more`, () => { this.trayOpen = !this.trayOpen; this.render(); });
      chev.append(el('span', 'ch-chev-i', '⌃'), el('span', 'ch-app-n', String(hidden.length)));
      chev.setAttribute('aria-expanded', String(this.trayOpen));
      wrap.append(chev);
      if (this.trayOpen) {
        const pop = el('div', 'ch-traypop');
        for (const sid of hidden) {
          const sb = this.boxes.get(sid)!;
          const it = btn('ch-strip-item', '', `${sb.label}: details`, () => this.details({ box: sid }));
          it.dataset.box = sid;
          const si = icon(sb.icon);
          it.append(this.statusDot(sid));
          if (si) it.append(si);
          it.append(el('span', 'ch-strip-name', sb.label));
          if (sb.sub) it.append(el('span', 'ch-strip-sub', sb.sub));
          pop.append(it);
        }
        wrap.append(pop);
      }
      right.append(wrap);
    }
    bar.append(apps);
    if (right.childElementCount) bar.append(right);
    desk.append(focusFrame, bar);
    stage.append(desk);
    // Tiles: the same layout the build check replays (diagrams/chronicle-model.ts), for this grid's real size.
    if (kids.some((k) => !this.minimized.has(k))) {
      const cs = getComputedStyle(grid);
      const w = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // The model takes the window's height and subtracts the strip itself.
      const h = grid.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + (strip.isConnected ? strip.offsetHeight : 0);
      const L = layoutFor(this.ix, this.st, this.flat, this.starts[this.cur], this.pos, w, h, this.minimized);
      grid.style.gridTemplateColumns = `repeat(${L.cols * UNITS}, minmax(0, 1fr))`;
      grid.style.gridTemplateRows = `repeat(${L.rows}, minmax(${Math.floor(L.rowH)}px, 1fr))`;
      // The strip's cells take the bottom row's tile spans (same units as the grid), so their edges continue.
      if (strip.isConnected) {
        strip.style.gridTemplateColumns = `repeat(${L.cols * UNITS}, minmax(0, 1fr))`;
        [...strip.children].forEach((it, i) => {
          const c = L.strip[i];
          if (!c) return;
          (it as HTMLElement).style.gridColumn = `${c.col + 1} / span ${c.w}`;
          (it as HTMLElement).style.gridRow = String(c.row + 1);
        });
      }
      L.tiles.forEach((t, i) => {
        const b = this.boxEl(t.id);
        b.style.setProperty('--k', String(L.scale[i]));
        b.style.gridColumn = `${t.col + 1} / span ${t.w}`;
        b.style.gridRow = `${t.row + 1} / span ${t.h}`;
        if (t.w > UNITS || t.h > 1) b.classList.add('is-big');
        grid.append(b);
      });
      // The model estimates text widths; the browser has the real ones. Shrink any tile that still overflows
      // (content too tall, or a name cut short) down to TILE.minScale; past that its cards scroll inside it.
      L.tiles.forEach((t, i) => {
        const b = grid.querySelector<HTMLElement>(`:scope > .ch-box[data-box="${CSS.escape(t.id)}"]`);
        if (!b) return;
        const name = b.querySelector<HTMLElement>(':scope > .ch-head .ch-name');
        const tight = () => b.scrollHeight > b.clientHeight + 1 || (!!name && name.scrollWidth > name.clientWidth + 1);
        let k = L.scale[i];
        while (k > TILE.minScale && tight()) {
          k = Math.max(TILE.minScale, Math.round((k - 0.05) * 100) / 100);
          b.style.setProperty('--k', String(k));
        }
        b.classList.toggle('is-tight', b.scrollHeight > b.clientHeight + 1);
      });
      // Rounding (fonts, display scaling) can leave the rows a pixel or two taller than the grid: no scroll then.
      grid.style.overflowY = grid.scrollHeight - grid.clientHeight > 4 ? 'auto' : 'hidden';
      // Once the widths are final: a sub line still too wide gets a smaller font of its own (down to
      // TILE.subMinPx), so it fits instead of ending in an ellipsis.
      focusFrame.querySelectorAll<HTMLElement>('.ch-grid > .ch-box > .ch-head > .ch-sub, .ch-strip .ch-strip-sub, .ch-strip .ch-strip-name').forEach((sub) => {
        let px = parseFloat(getComputedStyle(sub).fontSize);
        while (sub.scrollWidth > sub.clientWidth + 1 && px > TILE.subMinPx) {
          px = Math.max(TILE.subMinPx, px * Math.min(0.97, sub.clientWidth / sub.scrollWidth));
          sub.style.fontSize = `${px.toFixed(2)}px`;
        }
      });
    }
    this.drawCalls();
  }

  /**
   * Callouts are markers: a small dot in the tone's colour at the top right of the box they are about. The text
   * opens only on a click (then the marker goes). Nothing moves on its own; the next stage clears them.
   */
  private drawCalls() {
    const stage = this.ui.stage;
    stage.querySelector('.ch-calls')?.remove();
    const layer = el('div', 'ch-calls');
    stage.append(layer);
    const base = stage.getBoundingClientRect();
    const perAnchor = new Map<HTMLElement, number>();
    for (const c of this.st.calls) {
      if (this.opened.has(c.pos)) continue;
      const anchor = this.visible(c.at);
      if (!anchor) continue;
      const n = perAnchor.get(anchor) ?? 0;
      perAnchor.set(anchor, n + 1);
      const r = anchor.getBoundingClientRect();
      const m = el('button', `ch-mark ch-tone-${c.tone}`);
      m.type = 'button';
      const what = c.tone === 'risk' ? 'Problem' : c.tone === 'warn' ? 'Workaround' : c.tone === 'good' ? 'Result' : 'Note';
      m.title = `${what}${c.ref ? ` (${c.ref})` : ''}: click to read`;
      m.setAttribute('aria-label', m.title);
      m.textContent = c.tone === 'risk' ? '!' : c.tone === 'warn' ? 'W' : c.tone === 'good' ? '✓' : 'i';
      // Left of the box's buttons, half above its top edge.
      // Boxes have buttons at the top right; narrow anchors (pills, app buttons) do not.
      const inset = r.width > 200 ? 74 : 12;
      const x = Math.max(4, Math.min(base.width - 24, r.right - base.left - inset - n * 22));
      const y = Math.max(4, r.top - base.top - 9);
      m.style.transform = `translate(${x}px, ${y}px)`;
      m.addEventListener('click', (e) => { e.stopPropagation(); this.opened.add(c.pos); this.drawCalls(); this.details({ call: c }); });
      layer.append(m);
    }
  }

  // ---------------------------------------------------------------- chrome

  private build() {
    const r = this.root;
    const q = <T extends HTMLElement>(s: string) => r.querySelector<T>(s)!;
    this.ui = {
      paths: q('.ch-paths'), timeline: q('.ch-timeline'), title: q('.ch-stage-title'), meta: q('.ch-stage-meta'),
      stage: q('.ch-stage'), log: q('.ch-log-body'), detail: q('.ch-detail'), dialog: q('.ch-dialog'),
      clock: q('.ch-clock'), next: q('[data-ch="next"]'), speed: q('.dg-speed-val'), banner: q('.ch-banner'),
    };
    r.querySelector('.ch-fallback')?.remove();
    r.addEventListener('click', (e) => { this.anchor = (e.target as HTMLElement).closest<HTMLElement>('button, a, .ch-box'); }, true);
    // A click outside the popover closes it.
    r.addEventListener('click', (e) => { const d = this.ui.detail; if (!d.hidden && !d.contains(e.target as Node) && !(e.target as HTMLElement).closest('.ch-art, .ch-name, .ch-mark, .ch-app, .ch-more, .ch-pill')) d.hidden = true; });
    r.classList.add('is-js');
    q('[data-ch="prev"]').addEventListener('click', () => this.prevStep());
    q('[data-ch="next"]').addEventListener('click', () => void this.nextStep());
    q('[data-ch="prev-stage"]').addEventListener('click', () => this.prevStage());
    q('[data-ch="next-stage"]').addEventListener('click', () => this.nextStage());
    const setSpeed = (d: number) => { const i = SPEEDS.indexOf(this.speed); this.speed = d === 0 ? 1 : SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + d))]; this.drawChrome(); };
    q('[data-ch="slower"]').addEventListener('click', () => setSpeed(-1));
    q('[data-ch="faster"]').addEventListener('click', () => setSpeed(1));
    q('.dg-speed-val').addEventListener('click', () => setSpeed(0));
    q('[data-ch="full"]').addEventListener('click', () => this.full());
    // Arrow keys always step the timeline used last (or the first one on the page), wherever focus is, except
    // while typing or choosing in a form control.
    Player.current ??= this;
    const claim = () => { Player.current = this; };
    r.addEventListener('pointerdown', claim, true);
    r.addEventListener('focusin', claim);
    document.addEventListener('keydown', (e) => {
      if (Player.current !== this || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))) return;
      if (e.key === 'Escape') {
        if (!this.ui.dialog.hidden) this.ui.dialog.hidden = true;
        else if (!this.ui.detail.hidden) this.ui.detail.hidden = true;
        else if (this.trayOpen) { this.trayOpen = false; this.render(); }
        else if (r.classList.contains('is-full')) this.full(false);
        else return;
        e.preventDefault();
      } else if (this.still && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { return;
      } else if (e.key === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) this.nextStage(); else void this.nextStep(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (e.shiftKey) this.prevStage(); else this.prevStep(); }
      else if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) { e.preventDefault(); this.full(); }
    });
    new ResizeObserver(() => { if (!this.playing) this.drawCalls(); }).observe(this.ui.stage);
  }

  private full(on = !this.root.classList.contains('is-full')) {
    this.root.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('ch-lock', on);
    playSound(on ? 'popUpOn' : 'popUpOff');
    this.render();
    if (on) this.root.focus();
  }

  private drawChrome() {
    const cur = this.cur;
    const s = this.stages[cur];
    const done = this.pos >= this.starts[cur + 1];
    this.ui.title.textContent = `${cur + 1}/${this.stages.length} ${s.title}`;
    // Sub-step k of n in this stage.
    const ends = this.stepEnds.filter((x) => x > this.starts[cur] && x <= this.starts[cur + 1]);
    const k = ends.filter((x) => x <= this.pos).length;
    this.ui.meta.textContent = [s.when, s.took, `${k}/${ends.length}`].filter(Boolean).join(' · ');
    this.ui.next.toggleAttribute('disabled', this.pos >= this.flat.length && !this.playing);
    void done;
    // Elapsed time: the stage's real start plus the played share of its real duration.
    const a = this.starts[cur], b = this.starts[cur + 1];
    const share = b === a ? (this.pos >= a ? 1 : 0) : Math.max(0, Math.min(1, (this.pos - a) / (b - a)));
    const total = this.t0[this.t0.length - 1];
    if (total > 0) {
      const now = this.t0[cur] + (s.secs ?? 0) * share;
      this.ui.clock.textContent = `T+${clock(now)} / ${clock(total)}`;
      this.ui.clock.title = 'Time since the run started, of the whole run';
    }
    this.ui.speed.textContent = `${this.speed}×`;
    this.root.dataset.phase = s.phase;
    // Timeline progress. Segments that change animate in series, like one bar: forward fills left to right,
    // back empties right to left. Each gets an equal slice of at most SEG_ANIM ms in total.
    const segs = [...this.ui.timeline.querySelectorAll<HTMLElement>('.ch-seg')];
    const next = segs.map((seg) => {
      const i = Number(seg.dataset.i);
      const a = this.starts[i], b = this.starts[i + 1];
      return b === a ? (this.pos >= a ? 1 : 0) : Math.max(0, Math.min(1, (this.pos - a) / (b - a)));
    });
    const changed = segs.map((seg, k) => k).filter((k) => (Number(segs[k].style.getPropertyValue('--p')) || 0) !== next[k]);
    const back = changed.length > 0 && next[changed[0]] < (Number(segs[changed[0]].style.getPropertyValue('--p')) || 0);
    if (back) changed.reverse();
    const slice = changed.length ? Math.min(200, SEG_ANIM / changed.length) : 200;
    segs.forEach((seg, k) => {
      const order = changed.indexOf(k);
      seg.style.setProperty('--t', `${reduced() ? 0 : slice}ms`);
      seg.style.setProperty('--d', `${order < 0 || reduced() ? 0 : order * slice}ms`);
      seg.style.setProperty('--p', String(next[k]));
      seg.classList.toggle('is-cur', Number(seg.dataset.i) === cur);
    });
    const failing = this.path.kind === 'failure' && cur >= this.prefix;
    this.ui.banner.hidden = this.path.kind !== 'failure';
    this.ui.banner.classList.toggle('is-live', failing);
    if (this.path.kind === 'failure') {
      this.ui.banner.replaceChildren(
        el('span', undefined, failing ? 'Failure path: not what the harness does.' : `Failure path from stage ${this.prefix + 1}.`),
        btn('ch-banner-back', 'Back to the happy path', 'Back to the happy path', () => this.backToHappy()),
      );
    }
  }

  private backToHappy() {
    const at = this.c.paths[0].stages.findIndex((s) => s.id === this.path.forkAt);
    this.ui.dialog.hidden = true;
    this.usePath(this.c.paths[0].id, false);
    this.seek(this.starts[Math.max(0, at)], Math.max(0, at));
  }

  private drawTimeline() {
    const t = this.ui.timeline;
    t.replaceChildren();
    const happy = this.c.paths[0];
    this.stages.forEach((s, i) => {
      const seg = el('button', `ch-seg ch-ph-${i < this.prefix ? 'prefix' : s.phase}`);
      seg.type = 'button';
      seg.dataset.i = String(i);
      seg.title = `${i + 1}. ${s.title}${s.took ? ` (${s.took})` : ''}`;
      seg.setAttribute('aria-label', seg.title);
      seg.append(el('span', 'ch-seg-n', String(i + 1)));
      seg.addEventListener('click', () => this.seek(this.starts[i + 1], i));
      // Forks leave from happy-path stages.
      const forks = this.path.kind === 'happy' ? this.c.paths.filter((p) => p.kind === 'failure' && p.forkAt === s.id) : [];
      const wrap = el('span', 'ch-seg-wrap');
      wrap.append(seg);
      if (forks.length) {
        const f = btn('ch-fork', forks.length > 1 ? String(forks.length) : '', `Failure paths from stage ${i + 1}: ${forks.map((p) => p.title).join('; ')}`, () => this.ask(forks[0].id, forks));
        f.prepend(forkIcon());
        wrap.append(f);
      }
      t.append(wrap);
    });
    void happy;
  }

  /** One picker: the happy path, then each failure path (by the stage it branches from). */
  private drawPaths() {
    const box = this.ui.paths;
    box.replaceChildren();
    const happy = this.c.paths[0];
    const sel = el('select', 'ch-path-sel');
    sel.setAttribute('aria-label', 'Path');
    const oh = el('option', undefined, 'Happy path');
    oh.value = happy.id;
    sel.append(oh);
    const grp = el('optgroup');
    grp.label = 'Failure paths (spoilers)';
    for (const p of this.c.paths.filter((x) => x.kind === 'failure')) {
      const at = happy.stages.findIndex((x) => x.id === p.forkAt);
      const o = el('option', undefined, `${at + 1}: ${p.title}`);
      o.value = p.id;
      grp.append(o);
    }
    sel.append(grp);
    sel.value = this.path.id;
    sel.addEventListener('change', () => {
      const v = sel.value;
      if (v === happy.id) this.backToHappy();
      else this.ask(v, [this.c.paths.find((x) => x.id === v)!]);
    });
    box.append(sel);
  }

  /** Spoiler warning before a failure path. */
  private ask(id: string, options: CPath[]) {
    this.stopForUser();
    const d = this.ui.dialog;
    const card = el('div', 'ch-dialog-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    const render = (p: CPath) => {
      card.replaceChildren();
      card.append(el('p', 'ch-dialog-eyebrow', 'Spoiler: failure path'));
      card.append(el('h4', undefined, p.title));
      if (options.length > 1) {
        const pick = el('div', 'ch-dialog-pick');
        for (const o of options) {
          const b = btn(`ch-path${o.id === p.id ? ' is-on' : ''}`, o.title, o.title, () => render(o));
          pick.append(b);
        }
        card.append(pick);
      }
      card.append(md(p.spoiler));
      card.append(md('The harness does not do this. This path shows what went wrong when we tried it, so that the workaround on the happy path makes sense. The logs on this path are short reconstructions from the run notes.', 'ch-md ch-dim'));
      const row = el('div', 'ch-dialog-row');
      row.append(
        btn('ch-btn ch-btn-risk', 'Show the failure', 'Show the failure', () => { d.hidden = true; this.usePath(p.id, true); }),
        btn('ch-btn', 'Stay on the happy path', 'Stay on the happy path', () => { d.hidden = true; this.drawPaths(); }),
      );
      card.append(row);
    };
    render(this.c.paths.find((p) => p.id === id)!);
    d.replaceChildren(card);
    d.hidden = false;
    (card.querySelector('.ch-btn-risk') as HTMLElement | null)?.focus();
  }

  private showLesson() {
    const p = this.path;
    const d = this.ui.dialog;
    const card = el('div', 'ch-dialog-card ch-lesson');
    card.append(el('p', 'ch-dialog-eyebrow', 'What this failure taught'));
    card.append(el('h4', undefined, p.title));
    card.append(md(p.lesson));
    if (p.refs?.length) {
      const r = el('p', 'ch-refs');
      for (const id of p.refs) r.append(el('span', 'ch-call-ref', id), el('span', 'ch-ref-name', this.c.refs?.[id] ?? ''));
      card.append(r);
    }
    const lc = codeRow(p.code);
    if (lc) card.append(lc);
    const row = el('div', 'ch-dialog-row');
    row.append(
      btn('ch-btn ch-btn-good', 'Back to the happy path', 'Back to the happy path', () => this.backToHappy()),
      btn('ch-btn', 'Stay here and explore', 'Close', () => { d.hidden = true; }),
    );
    card.append(row);
    d.replaceChildren(card);
    d.hidden = false;
  }

  /** The step that ends at `pos` (the last one played), as [start, end). */
  private lastStep(): [number, number] {
    const i = this.stepEnds.indexOf(this.pos);
    if (i < 0) return [this.pos, this.pos];
    return [i > 0 ? this.stepEnds[i - 1] : 0, this.pos];
  }

  /**
   * The log: the current step's lines large and bold, the next step's narration as a dim preview line, and the
   * current lines kept in the middle of the pane. `typing` marks the newest line while it types out.
   */
  private drawLog(nowFrom?: number, nowTo?: number) {
    const L = this.ui.log;
    L.replaceChildren();
    const cur = this.cur;
    const [a, b] = nowFrom !== undefined ? [nowFrom, nowTo!] : this.lastStep();
    const last = this.st.lines.length - 1;
    this.st.lines.forEach((l, idx) => {
      const now = !l.head && l.pos >= a && l.pos < b;
      const row = el('button', `ch-line${l.head ? ' is-head' : ''}${l.gen ? ' is-gen' : ''}${l.stage === cur ? ' is-cur' : ''}${now ? ' is-now' : ''}${nowFrom !== undefined && idx === last ? ' is-typing' : ''}`);
      row.type = 'button';
      const t = l.text;
      if (/\b(ERROR|FAIL|Error|denied|CrashLoopBackOff|ErrImagePull|not found)\b/.test(t)) row.classList.add('is-err');
      else if (/\b(WARN|skip|KNOWN|retry|waiting)\b/.test(t)) row.classList.add('is-warn');
      else if (/\b(PASS|ok|done|Ready|ready)\b/.test(t)) row.classList.add('is-ok');
      row.textContent = nowFrom !== undefined && idx === last ? '' : t;
      row.title = 'Show the system at this line';
      row.addEventListener('click', () => this.seek(l.pos + (l.head ? 0 : 1), l.stage));
      L.append(row);
    });
    // Preview of the next step, when nothing plays.
    if (nowFrom === undefined && !this.playing && this.pos < this.flat.length) {
      const end = this.stepEnds.find((x) => x > this.pos) ?? this.flat.length;
      let text = '';
      for (let i = this.pos; i < end && !text; i++) {
        const e = this.flat[i].ev;
        text = 'log' in e ? (Array.isArray(e.log) ? e.log[0] : e.log) : this.gen.get(i) ?? '';
      }
      if (text) {
        const nx = btn('ch-line is-next', `next: ${text.replace(/^› /, '')}`, 'Play the next step', () => void this.nextStep());
        L.append(nx);
      }
    }
    // Keep the current lines in the middle of the pane.
    const focus = [...L.querySelectorAll<HTMLElement>('.is-now')].pop() ?? L.querySelector<HTMLElement>('.is-next') ?? L.lastElementChild as HTMLElement | null;
    if (focus) L.scrollTop = Math.max(0, focus.offsetTop - L.offsetTop - L.clientHeight / 2 + focus.offsetHeight / 2);
  }

  // ---------------------------------------------------------------- details

  private details(what: { box?: string; art?: string; call?: Call }) {
    this.stopForUser();
    const d = this.ui.detail;
    const body = el('div', 'ch-detail-body');
    const close = btn('ch-tb ch-detail-x', '✕', 'Close details', () => (d.hidden = true));
    if (what.art) {
      const a = this.arts.get(what.art)!;
      body.append(el('p', 'ch-detail-eyebrow', ART_TAG[a.kind] ?? a.kind), el('h4', undefined, a.title ?? a.label));
      if (a.refs?.length) {
        const r = el('p', 'ch-refs');
        for (const id of a.refs) r.append(el('span', 'ch-call-ref', id), el('span', 'ch-ref-name', this.c.refs?.[id] ?? ''));
        body.append(r);
      }
      if (a.note) body.append(md(a.note));
      if (a.brief) body.append(this.codeBlock(a.id, 'brief', a.brief));
      if (a.body) {
        const fold = el('details');
        fold.append(el('summary', undefined, 'Full content'));
        fold.append(this.codeBlock(a.id, 'body', a.body));
        body.append(fold);
      }
      if (a.src) body.append(link('Source', a.src));
      const where = [...this.st.arts].filter(([, v]) => v.includes(a.id)).map(([k]) => this.boxes.get(k)!.label);
      if (where.length) body.append(el('p', 'ch-dim', `Now on: ${where.join(', ')}`));
    } else if (what.box) {
      const b = this.boxes.get(what.box)!;
      body.append(el('p', 'ch-detail-eyebrow', KIND_TAG[b.kind] || 'system'), el('h4', undefined, b.label));
      if (b.sub) body.append(el('p', 'ch-dim', b.sub));
      if (b.src) body.append(link('Source', b.src));
      const s = this.st.status.get(b.id);
      if (s) body.append(el('p', 'ch-dim', `Status now: ${s}${this.st.badge.get(b.id) ? ` (${this.st.badge.get(b.id)})` : ''}`));
      body.append(md(b.info ?? ''));
      const v = this.st.arts.get(b.id) ?? [];
      if (v.length) {
        body.append(el('p', 'ch-detail-h', 'Data pieces here'));
        const list = el('div', 'ch-arts');
        for (const a of v) {
          const art = this.arts.get(a)!;
          const c = btn(`ch-art ch-art-${art.kind}`, '', art.title ?? art.label, () => this.details({ art: a }));
          c.append(el('span', 'ch-art-k', ART_TAG[art.kind] ?? art.kind), el('span', 'ch-art-l', art.label));
          list.append(c);
        }
        body.append(list);
      }
      const kids = this.aliveKids(b.id);
      if (kids.length) {
        body.append(el('p', 'ch-detail-h', 'Inside'));
        const list = el('div', 'ch-pills');
        for (const k of kids) {
          const p = btn('ch-pill', '', `${this.boxes.get(k)!.label}: details`, () => this.details({ box: k }));
          p.append(this.statusDot(k), el('span', undefined, this.boxes.get(k)!.label));
          list.append(p);
        }
        body.append(list);
      }
    } else if (what.call) {
      const c = what.call;
      body.append(el('p', 'ch-detail-eyebrow', c.tone === 'risk' ? 'problem' : c.tone === 'warn' ? 'workaround' : c.tone === 'good' ? 'result' : 'note'));
      if (c.ref) {
        const r = el('p', 'ch-refs');
        r.append(el('span', 'ch-call-ref', c.ref), el('span', 'ch-ref-name', this.c.refs?.[c.ref] ?? ''));
        body.append(r);
      }
      body.append(md(c.text));
      body.append(el('p', 'ch-dim', `About: ${this.boxes.get(c.at)?.label ?? c.at}`));
    }
    d.replaceChildren(close, body);
    d.classList.toggle('is-wide', !!what.art && !!(this.arts.get(what.art)?.brief || this.arts.get(what.art)?.body));
    d.hidden = false;
    this.placeDetail();
    close.focus({ preventScroll: true });
  }

  /** Put the popover just under the clicked control (above it when there is no room below), inside the figure. */
  private placeDetail() {
    const d = this.ui.detail;
    const host = d.parentElement!.getBoundingClientRect();
    const a = this.anchor?.isConnected ? this.anchor.getBoundingClientRect() : null;
    const w = d.offsetWidth, h = d.offsetHeight;
    let left = a ? a.left - host.left : (host.width - w) / 2;
    left = Math.max(6, Math.min(host.width - w - 6, left));
    let top = a ? a.bottom - host.top + 6 : 40;
    if (a && top + h > host.height - 4 && a.top - host.top - h - 6 > 4) top = a.top - host.top - h - 6;
    top = Math.max(4, Math.min(Math.max(4, host.height - h - 4), top));
    d.style.left = `${left}px`;
    d.style.top = `${top}px`;
  }
}
