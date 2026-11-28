/**
 * <Diagram> behaviour: Expand for every figure, and a step player for figures
 * with steps. Step state lives in classes on the SVG groups:
 *   is-focus   focused this step
 *   is-end     start or end box of a focused edge (lights up)
 *   is-context parent group of something focused (build mode keeps it visible)
 *   is-seen    focused in an earlier step (build mode)
 * The figure gets data-active while a step shows; index -1 is the overview.
 */
import { playSound } from './sound';
import { parseMd, type Inline } from '@/diagrams/md';

/** Markdown for info cards (src/diagrams/md.ts), built as DOM nodes: no HTML strings. */
function infoMd(src: string): DocumentFragment {
  const inline = (parent: Node, items: Inline[]) => {
    for (const n of items) {
      if (n.t === 'text') { parent.appendChild(document.createTextNode(n.v)); continue; }
      const el = document.createElement(n.t);
      if (n.t === 'code') el.textContent = n.v;
      else inline(el, n.c);
      if (n.t === 'a') {
        (el as HTMLAnchorElement).href = n.href;
        if (n.external) { (el as HTMLAnchorElement).target = '_blank'; (el as HTMLAnchorElement).rel = 'noopener noreferrer'; }
      }
      parent.appendChild(el);
    }
  };
  const frag = document.createDocumentFragment();
  for (const b of parseMd(src)) {
    const el = document.createElement(b.t);
    if (b.t === 'p') inline(el, b.c);
    else for (const item of b.items) { const li = document.createElement('li'); inline(li, item); el.append(li); }
    frag.append(el);
  }
  return frag;
}

/**
 * Info cards. A box with more to say has an "i" button on its top-left corner (render.ts);
 * clicking the button (or Enter / Space on it) shows the card,
 * which stays until its Hide button, the "i" again, Esc, or a click elsewhere. Clicking the
 * box itself does nothing here. An arrow or its label with more to say (cursor: help) shows
 * its card on click and hides it when the pointer leaves, after a short grace so the pointer
 * can reach the card; it has the Hide button too.
 * Content: the box's tag, name and detail, or the arrow's "from → to" and label; then
 * `info` (Markdown, built as DOM by infoMd) or a <template data-dg-info> (a sequence
 * diagram's step text, rendered at build time) cloned in.
 */
function setupHover(fig: HTMLElement) {
  const svg = fig.querySelector<SVGSVGElement>('svg.dg-scene');
  const frame = fig.querySelector<HTMLElement>('.dg-frame');
  if (!svg || !frame) return;
  const card = document.createElement('div');
  card.className = 'dg-card';
  card.hidden = true;
  frame.append(card);
  const tpl = new Map([...fig.querySelectorAll<HTMLTemplateElement>('template[data-dg-info]')].map((t) => [t.dataset.dgInfo!, t]));
  // Arrows with step text get the help cursor like arrows with info.
  for (const id of tpl.keys()) svg.querySelectorAll<SVGElement>(`[data-el="${CSS.escape(id)}"]`).forEach((el) => el.setAttribute('data-has-info', ''));
  const text = (g: Element, cls: string) => [...g.querySelectorAll(`.${cls}`)].map((t) => t.textContent).join(' ');
  const name = (id: string) => { const n = svg.querySelector(`.dg-node[data-el="${CSS.escape(id)}"]`); return n ? text(n, 'dg-label') : id; };
  /** The element a pointer event is on that can show a card, and the key shared by an arrow and its label. */
  const target = (el: Element | null) => {
    const g = el?.closest<SVGGElement>('.dg-node[data-el], .dg-edge[data-el], .dg-elabel[data-el]');
    if (!g || !(g.dataset.info || tpl.has(g.dataset.el!))) return null;
    // A box's card opens from its "i" button only.
    if (g.dataset.kind === 'node' && !el!.closest('.dg-info-btn')) return null;
    return { g, key: `${g.dataset.kind === 'node' ? 'n' : 'e'}:${g.dataset.el}` };
  };
  let open: string | null = null, hideT = 0;
  let openBox: SVGGElement | null = null;
  function hide() {
    clearTimeout(hideT);
    open = null;
    openBox?.classList.remove('is-info-open');
    openBox?.querySelector('.dg-info-btn')?.setAttribute('aria-expanded', 'false');
    openBox = null;
    card.classList.remove('is-on');
    card.hidden = true;
  }
  function show(g: SVGGElement, key: string) {
    openBox?.classList.remove('is-info-open');
    openBox?.querySelector('.dg-info-btn')?.setAttribute('aria-expanded', 'false');
    openBox = null;
    const id = g.dataset.el!;
    const isNode = g.dataset.kind === 'node';
    const edge = isNode ? null : svg!.querySelector<SVGGElement>(`.dg-edge[data-el="${CSS.escape(id)}"]`);
    const label = isNode ? null : svg!.querySelector<SVGGElement>(`.dg-elabel[data-el="${CSS.escape(id)}"]`);
    const tone = [...(edge ?? g).classList].find((c) => c.startsWith('tone-')) ?? '';
    card.className = `dg-card ${tone}`;
    card.replaceChildren();
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dg-card-x';
    x.textContent = 'Hide';
    x.setAttribute('aria-label', 'Hide this card');
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = openBox?.querySelector<SVGGElement>('.dg-info-btn');
      hide();
      btn?.focus();
    });
    card.append(x);
    const add = (cls: string, s: string) => { if (!s) return; const el = document.createElement('div'); el.className = cls; el.textContent = s; card.append(el); };
    if (isNode) {
      add('dg-card-tag', text(g, 'dg-tag'));
      add('dg-card-title', text(g, 'dg-label'));
      add('dg-card-detail', text(g, 'dg-detail'));
    } else if (edge) {
      add('dg-card-tag', `${name(edge.dataset.from!)} → ${name(edge.dataset.to!)}`);
      add('dg-card-title', label ? text(label, 'dg-edge-label') : '');
    }
    const info = g.dataset.info ?? edge?.dataset.info;
    if (info) { const el = document.createElement('div'); el.className = 'dg-card-info'; el.append(infoMd(info)); card.append(el); }
    const t = tpl.get(id);
    if (t) { const el = document.createElement('div'); el.className = 'dg-card-info'; el.append(t.content.cloneNode(true)); card.append(el); }
    const anchor: Element = (isNode ? g.querySelector('.dg-shape') : label ?? edge) ?? g;
    card.hidden = false;
    // Kept inside the drawing (not over the player): below the box, else above,
    // else beside it (right, then left). Coordinates are relative to the frame.
    const fr = frame!.getBoundingClientRect(), sr = svg!.getBoundingClientRect(), br = anchor.getBoundingClientRect();
    const box = { l: br.left - fr.left, r: br.right - fr.left, t: br.top - fr.top, b: br.bottom - fr.top };
    const area = { l: sr.left - fr.left, r: sr.right - fr.left, t: sr.top - fr.top, b: sr.bottom - fr.top };
    const w = Math.min(420, area.r - area.l);
    card.style.width = `${w}px`;
    const h = card.offsetHeight;
    const clampX = (x: number) => Math.max(area.l, Math.min(area.r - w, x));
    const clampY = (y: number) => Math.max(area.t, Math.min(area.b - h, y));
    const cx = clampX((box.l + box.r) / 2 - w / 2), cy = clampY((box.t + box.b) / 2 - h / 2);
    const spots: [number, number, boolean][] = [
      [cx, box.b + 8, box.b + 8 + h <= area.b],
      [cx, box.t - 8 - h, box.t - 8 - h >= area.t],
      [box.r + 8, cy, box.r + 8 + w <= area.r],
      [box.l - 8 - w, cy, box.l - 8 - w >= area.l],
    ];
    const [left, top] = spots.find((p) => p[2]) ?? [cx, clampY(box.b + 8)];
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    requestAnimationFrame(() => card.classList.add('is-on'));
    open = key;
    if (isNode) {
      openBox = g;
      g.classList.add('is-info-open');
      g.querySelector('.dg-info-btn')?.setAttribute('aria-expanded', 'true');
    }
  }
  const toggle = (t: { g: SVGGElement; key: string }) => (open === t.key ? hide() : show(t.g, t.key));
  svg.addEventListener('click', (e) => {
    const t = target(e.target as Element);
    if (!t) { if (open && !(e.target as Element).closest('.dg-info-btn')) hide(); return; }
    // The "i" of a box that also opens (Drilldown): show the card, do not open the box.
    if (t.key.startsWith('n:')) e.stopPropagation();
    toggle(t);
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = (e.target as Element).closest('.dg-info-btn') ? target(e.target as Element) : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation(); // Space would also start the step player; Enter would open a drill-down box
    toggle(t);
  });
  // Leaving the thing (to something that is not it, nor the card) hides the card after the grace.
  const GRACE = 350;
  const keyOf = (el: Element | null) => target(el)?.key ?? null;
  svg.addEventListener('pointerover', (e) => { if (open && keyOf(e.target as Element) === open) clearTimeout(hideT); });
  svg.addEventListener('pointerout', (e) => {
    if (!open || open.startsWith('n:') || keyOf(e.target as Element) !== open) return;
    const to = e.relatedTarget as Element | null;
    if (to && (card.contains(to) || keyOf(to) === open)) return;
    clearTimeout(hideT);
    hideT = window.setTimeout(hide, GRACE);
  });
  card.addEventListener('pointerenter', () => clearTimeout(hideT));
  card.addEventListener('pointerleave', (e) => { if (open?.startsWith('n:')) return; if (keyOf(e.relatedTarget as Element | null) !== open) { clearTimeout(hideT); hideT = window.setTimeout(hide, GRACE); } });
  fig.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open && !e.defaultPrevented) { hide(); e.preventDefault(); e.stopPropagation(); } });
  document.addEventListener('click', (e) => { if (open && !fig.contains(e.target as Node)) hide(); });
}

/**
 * Tracing: with many crossing wires it is hard to see what connects to what. Hovering (or
 * focusing) a box lights its wires and the boxes at their other ends; hovering a wire
 * lights it, its label and its two ends (diagram.css .is-tracing); nothing else changes.
 * A short delay keeps the picture calm while the pointer just passes over.
 */
function setupTrace(fig: HTMLElement) {
  const svg = fig.querySelector<SVGSVGElement>('svg.dg-scene[data-diagram=graph]');
  if (!svg) return;
  const edges = [...svg.querySelectorAll<SVGGElement>('.dg-edge[data-el]')];
  if (edges.length < 2) return;
  let t = 0;
  const clear = () => {
    fig.classList.remove('is-tracing');
    svg.querySelectorAll('.is-trace, .is-trace-end').forEach((el) => el.classList.remove('is-trace', 'is-trace-end'));
  };
  const light = (ids: Set<string>, ends: Set<string>) => {
    clear();
    for (const el of svg.querySelectorAll<SVGElement>('[data-el]')) if (ids.has(el.dataset.el!) || ends.has(el.dataset.el!)) el.classList.add('is-trace');
    for (const el of svg.querySelectorAll<SVGElement>('.dg-node[data-el]')) if (ends.has(el.dataset.el!)) el.classList.add('is-trace-end');
    for (const j of svg.querySelectorAll<SVGElement>('.dg-junction')) if (j.dataset.edges!.split(' ').some((x) => ids.has(x))) j.classList.add('is-trace');
    fig.classList.add('is-tracing');
  };
  const trace = (target: Element | null) => {
    clearTimeout(t);
    const node = target?.closest<SVGGElement>('.dg-node[data-el]');
    const edge = target?.closest<SVGGElement>('.dg-edge[data-el], .dg-elabel[data-el]');
    if (!node && !edge) { t = window.setTimeout(clear, 120); return; }
    t = window.setTimeout(() => {
      if (fig.dataset.active !== undefined) return; // a step owns the highlighting
      if (node) {
        const id = node.dataset.el!;
        const mine = edges.filter((e) => e.dataset.from === id || e.dataset.to === id);
        if (!mine.length) { clear(); return; }
        light(new Set([id, ...mine.map((e) => e.dataset.el!)]), new Set(mine.flatMap((e) => [e.dataset.from!, e.dataset.to!]).filter((x) => x !== id)));
      } else {
        const e = edges.find((x) => x.dataset.el === edge!.dataset.el);
        if (e) light(new Set([e.dataset.el!]), new Set([e.dataset.from!, e.dataset.to!]));
      }
    }, 140);
  };
  svg.addEventListener('pointerover', (e) => trace(e.target as Element));
  svg.addEventListener('pointerleave', () => trace(null));
  svg.addEventListener('focusin', (e) => trace(e.target as Element));
  svg.addEventListener('focusout', () => trace(null));
}

/** An info card in this figure, or the glossary card, is open. */
function hasOpenPopover(fig: HTMLElement): boolean {
  return !!(fig.querySelector('.dg-card:not([hidden])') || document.querySelector('.term-card:not([hidden])'));
}

function setupExpand(fig: HTMLElement) {
  const btn = fig.querySelector<HTMLButtonElement>('[data-act=expand]');
  const toggle = (on = !fig.classList.contains('is-expanded')) => {
    fig.classList.toggle('is-expanded', on);
    btn?.setAttribute('aria-label', on ? 'Close' : 'Expand');
    if (on) fig.focus();
  };
  btn?.addEventListener('click', () => toggle());
  fig.addEventListener('keydown', (e) => {
    // Escape closes the topmost layer only: an open info card or glossary card first (their own handlers), then
    // the full window. This listener runs before the card's, so it checks for open cards itself.
    if (e.key === 'Escape' && fig.classList.contains('is-expanded')) {
      if (e.defaultPrevented || hasOpenPopover(fig)) return;
      toggle(false); e.preventDefault();
    }
    else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) { toggle(); e.preventDefault(); }
  });
}

/**
 * Animation speed, shared by every diagram (the − 1× + control in each bar).
 * It carries over while browsing in this tab (sessionStorage) and resets to 1×
 * on reload. All player timings divide by it; CSS animations read --dg-speed.
 */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
let speed = (() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'reload') { sessionStorage.removeItem('dg-speed'); return 1; }
    const v = Number(sessionStorage.getItem('dg-speed'));
    return SPEEDS.includes(v) ? v : 1;
  } catch { return 1; }
})();
const speedText = (v: number) => `${v}×`;
// The control's 1× plays at twice the timings written below (they were tuned slower).
const BASE_RATE = 2;
/** The effective playback rate: every player timing divides by it. */
const rate = () => speed * BASE_RATE;
function setSpeed(v: number) {
  speed = v;
  try { v === 1 ? sessionStorage.removeItem('dg-speed') : sessionStorage.setItem('dg-speed', String(v)); } catch { /* private mode */ }
  document.documentElement.style.setProperty('--dg-speed', String(v * BASE_RATE));
  document.querySelectorAll<HTMLElement>('.dg-speed-val').forEach((b) => {
    b.textContent = speedText(v);
    b.setAttribute('aria-label', `Speed ${speedText(v)}; reset to 1×`);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-act=slower]').forEach((b) => { b.disabled = v === SPEEDS[0]; });
  document.querySelectorAll<HTMLButtonElement>('[data-act=faster]').forEach((b) => { b.disabled = v === SPEEDS[SPEEDS.length - 1]; });
}
const stepSpeed = (dir: 1 | -1) => setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + dir))]);

function setupSteps(fig: HTMLElement) {
  const steps = [...fig.querySelectorAll<HTMLLIElement>('.dg-steps > .dg-step')];
  if (!steps.length) return;
  const focus = steps.map((li) => JSON.parse(li.dataset.focus || '[]') as string[]);
  type Hop = { from: string; to: string; e: string; r: boolean; x?: boolean; o?: boolean; s?: string };
  const paths = steps.map((li) => (li.dataset.path ? (JSON.parse(li.dataset.path) as Hop[]) : []));
  // The big outcome overlay (blurring the diagram) only helps when outcomes differ:
  // some step drops a hop, hangs, or answers 4xx/5xx. All-success diagrams keep the
  // drawing sharp and only narrate the answer.
  const mixedOutcomes = paths.some((p) => p.some((h) => h.x || (h.s !== undefined && !/^2/.test(h.s))));
  // Per-step looks (Step `state`): tone, detail, tag, label, dashed. Undone when the step changes.
  type Look = { tone?: string; detail?: string; tag?: string; label?: string; dashed?: boolean; svg?: string };
  const looks = steps.map((li) => (li.dataset.state ? (JSON.parse(li.dataset.state) as Record<string, Look>) : {}));
  let undoLook: (() => void)[] = [];
  function applyLook(look: Record<string, Look>) {
    for (const undo of undoLook.splice(0).reverse()) undo();
    for (const [id, o] of Object.entries(look)) {
      for (const g of els.get(id) ?? []) {
        if (o.tone) {
          const old = [...g.classList].find((c) => c.startsWith('tone-'));
          if (old) { g.classList.replace(old, `tone-${o.tone}`); undoLook.push(() => g.classList.replace(`tone-${o.tone}`, old)); }
        }
        if (o.dashed !== undefined && g.getAttribute('data-kind') === 'edge') {
          const had = g.classList.contains('is-dashed');
          g.classList.toggle('is-dashed', o.dashed);
          undoLook.push(() => g.classList.toggle('is-dashed', had));
        }
        const swap = (sel: string, text?: string) => {
          const ts = [...g.querySelectorAll(sel)];
          if (text === undefined || !ts.length) return;
          const old = ts.map((t) => t.textContent);
          ts.forEach((t, k) => { t.textContent = k === 0 ? text : ''; });
          undoLook.push(() => ts.forEach((t, k) => { t.textContent = old[k]; }));
        };
        if (o.svg && g.getAttribute('data-kind') === 'node') {
          // The box's text with the step's label/detail/tag, wrapped to the box at build
          // time (Diagram.astro, from our own escaped render): swap the whole text block.
          const old = [...g.querySelectorAll(':scope > .dg-tag, :scope > .dg-label, :scope > .dg-detail')];
          const tpl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          tpl.innerHTML = o.svg;
          const fresh = [...tpl.children];
          old.forEach((t) => t.remove());
          g.append(...fresh);
          undoLook.push(() => { fresh.forEach((t) => t.remove()); g.append(...old); });
        } else {
          swap('.dg-detail', o.detail);
          swap('.dg-tag', o.tag?.toUpperCase());
        }
        swap('.dg-edge-label', o.label);
      }
    }
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = fig.querySelector<SVGSVGElement>('svg.dg-scene');
  // Narration line in the bar (subtitles): what is happening right now. Step
  // `narration` ({ nodeId: text }) replaces the line when the packet reaches that node.
  const statusEl = fig.querySelector<HTMLElement>('.dg-status');
  const sayings = steps.map((li) => (li.dataset.say ? (JSON.parse(li.dataset.say) as Record<string, string>) : {}));
  // A line must be readable: 1.2 s plus 35 ms per character (at most 3.2 s). Each
  // hop lasts at least that long (see leg), so the packet never stops for text.
  const readTime = (text: string) => Math.min(3200, 1200 + text.length * 35);
  function say(text: string, tone = '') {
    if (!statusEl || statusEl.textContent === text) return;
    statusEl.textContent = text;
    statusEl.className = `dg-status is-on${tone ? ` is-${tone}` : ''}`;
    void statusEl.offsetWidth; // restart the entry animation
    statusEl.classList.add('is-new');
  }
  /**
   * Screen readers: one summary per step (the visual line changes every hop, so
   * it is aria-hidden). Said once when the step is shown, not on replays.
   */
  const srEl = fig.querySelector<HTMLElement>('.dg-sr');
  function announce(hops: Hop[]) {
    if (!srEl) return;
    if (!hops.length) { srEl.textContent = ''; return; }
    const { out, broken, hang, oneway, code } = legs(hops);
    const custom = sayings[index] ?? {};
    const route = [out[0].from, ...out.map((h) => h.to)].map(labelOf).join(' → ');
    const far = labelOf(out[out.length - 1].to), origin = labelOf(out[0].from);
    const codeText = code === '200' ? '200 OK' : code;
    const outcome = broken ? `Lost on the way to ${far}; no reply.`
      : hang ? `${far} never answers; ${origin} waits.`
      : oneway ? `Reached ${far}.`
      : `${far} answers ${codeText}; the reply returns to ${origin}.`;
    const extra = Object.values(custom).join(' ');
    srEl.textContent = `${route}. ${outcome}${extra ? ` ${extra}` : ''}`;
  }
  /** Important outcomes, large over the blurred diagram, at the end of every run. */
  const fit = fig.querySelector<HTMLElement>('.dg-fit');
  const outcomeEl = document.createElement('div');
  outcomeEl.className = 'dg-outcome';
  outcomeEl.setAttribute('aria-hidden', 'true'); // the .dg-sr summary already says it
  fit?.append(outcomeEl);
  const OUTCOME_MS = 2200;
  function showOutcome(big: string, small: string, tone: string) {
    outcomeEl.replaceChildren();
    const b = document.createElement('div'); b.className = 'dg-outcome-big'; b.textContent = big;
    const m = document.createElement('div'); m.className = 'dg-outcome-small'; m.textContent = small;
    outcomeEl.append(b, m);
    outcomeEl.className = `dg-outcome is-on is-${tone}`;
    fit?.classList.add('is-outcome');
  }
  function hideOutcome() { outcomeEl.className = 'dg-outcome'; fit?.classList.remove('is-outcome'); }
  function hush() { if (statusEl) { statusEl.className = 'dg-status'; statusEl.textContent = ''; } hideOutcome(); }
  const labelOf = (id: string) => {
    const g = els.get(id)?.find((x) => x.getAttribute('data-kind') === 'node');
    return [...(g?.querySelectorAll('.dg-label') ?? [])].map((t) => t.textContent).join(' ') || id;
  };
  let runner: SVGCircleElement | undefined;
  let overlay: SVGGElement | undefined;
  let runToken = 0;
  let onCycle: (() => void) | null = null; // autoplay waits for the current run to finish
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms / rate())); // scaled by the speed control
  // The dot always moves at one constant speed (px per ms), on every arrow:
  // long arrows take longer, short ones less. About 0.8 s on a typical arrow.
  const SPEED = 0.2;
  const DWELL = 400; // the dot pauses this long at each box between two hops, so short arrows stay readable
  const LOST_AT = 0.55; // a dropped request stops this far along its broken hop
  const HANG_AT = 0.88; // a request to a node that hangs dies just as it reaches it
  const HANG_WAIT = 2600; // how long the clock runs before the step calls it: no answer
  const LOST_FADE = 1200; // the lost dot's fade (dg-lost)
  const BADGE_DRAW = 700; // the last tick / code badge drawing in
  const lineOf = (h: Hop) => els.get(h.e)?.[0]?.querySelector<SVGPathElement>('.dg-line');

  /**
   * A path is a request and its reply. `a -> b -> c` goes out and the reply
   * comes back the same way; a path that already returns to its start
   * (`a -> b -> a`) carries its own reply. A `-x>` hop breaks the connection:
   * the request is lost there and no reply comes.
   */
  type Answer = 'ok' | 'c4' | 'c5';
  function legs(hops: Hop[]) {
    const half = hops.length / 2;
    const mirrored = hops.length % 2 === 0 && hops.slice(half).every((h, i) => h.from === hops[half - 1 - i].to && h.to === hops[half - 1 - i].from);
    let out = mirrored ? hops.slice(0, half) : hops;
    const broken = out.findIndex((h) => h.x);
    if (broken >= 0) out = out.slice(0, broken + 1);
    const oneway = out.some((h) => h.o);
    // The far end's answer: 2xx (default), 4xx, 5xx, or hang (it never answers).
    const st = out[out.length - 1]?.s ?? '200';
    const hang = st === 'hang';
    const answer: Answer = st[0] === '4' ? 'c4' : st[0] === '5' ? 'c5' : 'ok';
    const code = /^\d{3}$/.test(st) ? st : st.toUpperCase();
    const back = broken >= 0 || oneway || hang ? [] : mirrored ? hops.slice(half) : [...out].reverse().map((h) => ({ ...h, from: h.to, to: h.from, r: !h.r }));
    return { out, back, broken: broken >= 0, oneway, hang, answer, code };
  }
  const HOLD_OK = 1600;
  const PAUSE = 250; // at the far end, between the request arriving and the reply leaving
  const HOLD_LOST = 2600;
  const REWIND = 520;

  // Classes a run adds, so a rewind removes exactly those (not the step's own focus).
  let added: [Element, string][] = [];
  const runMark = (ids: string[], cls: string) => {
    for (const id of ids) els.get(id)?.forEach((g) => { if (!g.classList.contains(cls)) { g.classList.add(cls); added.push([g, cls]); } });
  };
  // Badges on a node's top-right corner: typing dots while it waits for a
  // reply, then a green tick (drawn once) when the reply gets back to it.
  const badges = new Map<string, SVGGElement>();
  function badge(id: string, cls: string, inner: string) {
    const node = els.get(id)?.find((g) => g.getAttribute('data-kind') === 'node');
    const shape = node?.querySelector<SVGGraphicsElement>('.dg-shape');
    if (!svg || !node || !shape) return;
    if (!overlay) {
      overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlay.setAttribute('class', 'dg-overlay');
    }
    // Added once, as the last layer. Never re-append it: moving it in the DOM
    // restarts its badges' animations (old ticks would redraw).
    if (!overlay.isConnected) svg.append(overlay);
    badges.get(id)?.remove();
    const b = shape.getBBox();
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', cls);
    g.setAttribute('transform', `translate(${b.x + b.width - 22} ${b.y})`);
    g.style.setProperty('--dg-accent', getComputedStyle(node).getPropertyValue('--dg-accent'));
    g.innerHTML = inner;
    overlay.append(g);
    badges.set(id, g);
  }
  /** Typing dots: this node sent a request and is waiting for the reply. */
  function waitOn(id: string) {
    runMark([id], 'is-wait');
    if (badges.get(id)?.classList.contains('dg-wait')) return;
    badge(id, 'dg-wait', '<rect x="-16" y="-8" width="32" height="16" rx="8"/>' + [-7, 0, 7].map((x, i) => `<circle cx="${x}" cy="0" r="2" style="animation-delay:${i * 160}ms"/>`).join(''));
  }
  /**
   * The reply reached this node. 2xx: the dots become a green tick, drawn once.
   * 4xx / 5xx: an amber / orange pill with the status code (5xx also shakes once).
   */
  function waitOff(id: string, answer: Answer = 'ok', code = '') {
    els.get(id)?.forEach((g) => g.classList.remove('is-wait'));
    if (!badges.get(id)?.classList.contains('dg-wait')) return;
    if (answer === 'ok') badge(id, 'dg-done', '<rect x="-16" y="-8" width="32" height="16" rx="8"/><path pathLength="1" d="M-5 0.5 L-1.5 4 L5.5 -3.5"/>');
    else badge(id, `dg-code is-${answer}`, `<rect x="-16" y="-8" width="32" height="16" rx="8"/><text x="0" y="0.5" text-anchor="middle" dominant-baseline="central">${code}</text>`);
  }
  /** The wait is over: the clock stops on a cross (timed out). */
  function timedOut(id: string) {
    const b = badges.get(id);
    if (!b?.classList.contains('dg-hang')) return;
    b.classList.add('is-out');
    b.insertAdjacentHTML('beforeend', '<path class="cross" pathLength="1" d="M-3.2 -3.2 L3.2 3.2 M3.2 -3.2 L-3.2 3.2"/>');
  }
  /** No answer is coming: the senders' dots turn red and slow down; the stuck node gets a clock. */
  function hangOn(id: string) {
    runMark([id], 'is-hung');
    badge(id, 'dg-hang', '<rect x="-16" y="-8" width="32" height="16" rx="8"/><circle cx="0" cy="0" r="5"/><path class="hand" d="M0 0 V-3.4"/><path d="M0 0 H2.4"/>');
    for (const b of badges.values()) if (b.classList.contains('dg-wait')) b.classList.add('is-stale');
  }
  const trails: SVGElement[] = [];
  const revealOf = new WeakMap<SVGPathElement, SVGPathElement>();
  const maskBase = `dgm-${Math.random().toString(36).slice(2, 8)}`; // unique per diagram on the page
  let maskSeq = 0;
  const defs = () => {
    let d = svg!.querySelector('defs');
    if (!d) { d = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg!.prepend(d); }
    return d;
  };
  function clearRun() {
    for (const [g, cls] of added) g.classList.remove(cls);
    added = [];
    for (const t of trails.splice(0)) t.remove();
    for (const g of badges.values()) g.remove();
    badges.clear();
    if (runner) { runner.style.opacity = '0'; runner.classList.remove('is-lost', 'is-reply'); }
  }

  /**
   * Moves the dot along a whole leg (several hops) at constant speed, with no
   * easing and no stops. One per-frame loop drives everything from the same
   * clock, so nothing lags the dot: its position, the arrow filling in behind it
   * (red out: sent, no reply yet; green back: answered), and `on.start(i)` /
   * `on.end(i)` the moment the dot enters / leaves hop i. `lostAt` (0-1) ends
   * the last hop part-way: the request is lost there.
   */
  function leg(hops: Hop[], token: number, kind: 'out' | 'back' | 'c4' | 'c5' | 'msg', on: { start?: (i: number) => void; end?: (i: number) => void }, lostAt?: number, lines: string[] = []): Promise<void> {
    if (!runner || !hops.length || token !== runToken) return Promise.resolve();
    // Sample the route once (every ~3px), with the distance travelled at each point.
    const xs: number[] = [], ys: number[] = [], ds: number[] = [];
    const bounds = [0];
    // Solid edges reveal their trail with one growing dash; dashed edges keep their
    // dash pattern and instead grow the trail's path itself up to the dot.
    const hopRuns: { trail?: SVGPathElement; run: number; dashed: boolean; pts: string[]; at: number[]; drawn: number }[] = [];
    let total = 0;
    hops.forEach((h, i) => {
      const line = lineOf(h);
      const len = line?.getTotalLength() ?? 0;
      const upto = i === hops.length - 1 && lostAt ? len * lostAt : len;
      const n = Math.max(2, Math.ceil(upto / 3));
      const own: string[] = [];
      const at: number[] = [];
      for (let k = 0; k <= n && line; k++) {
        const d = (k / n) * upto;
        const p = line.getPointAtLength(h.r ? len - d : d);
        xs.push(p.x); ys.push(p.y); ds.push(total + d);
        own.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
        at.push(d);
      }
      const g = els.get(h.e)?.[0];
      const dashed = !!g?.classList.contains('is-dashed');
      let trail: SVGPathElement | undefined;
      if (g && upto > 0) {
        trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        trail.setAttribute('class', `dg-trail is-${kind}${dashed ? ' is-dashed' : ''}`);
        if (dashed && svg && line) {
          // An exact copy of the dashed line (same path, same dash phase, so it
          // lines up in either direction), revealed by a mask that grows with the dot.
          trail.setAttribute('d', line.getAttribute('d') ?? '');
          const vb = svg.viewBox.baseVal;
          const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
          mask.id = `${maskBase}-${++maskSeq}`;
          for (const [a, v] of [['maskUnits', 'userSpaceOnUse'], ['x', vb.x], ['y', vb.y], ['width', vb.width], ['height', vb.height]]) mask.setAttribute(String(a), String(v));
          const reveal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          reveal.setAttribute('class', 'dg-reveal');
          reveal.setAttribute('d', `M${own[0]}`);
          mask.append(reveal);
          defs().append(mask);
          trails.push(mask);
          trail.setAttribute('mask', `url(#${mask.id})`);
          revealOf.set(trail, reveal);
        } else {
          trail.setAttribute('d', `M${own.join(' L')}`);
          trail.style.strokeDasharray = `${upto} ${upto}`;
          trail.style.strokeDashoffset = `${upto}`;
        }
        g.insertBefore(trail, g.querySelector('.dg-arrow'));
        trails.push(trail);
      }
      hopRuns.push({ trail, run: upto, dashed, pts: own, at, drawn: 1 });
      total += upto;
      bounds.push(total);
    });
    if (!total) return Promise.resolve();
    const edge = els.get(hops[0].e)?.[0];
    if (edge) runner.style.setProperty('--dg-accent', getComputedStyle(edge).getPropertyValue('--dg-accent'));
    runner.setAttribute('cx', String(xs[0]));
    runner.setAttribute('cy', String(ys[0]));
    runner.style.opacity = '1';
    let k = 0;
    // Hop by hop: constant speed within a hop (no easing), then a DWELL at the box.
    // A hop lasts at least as long as its narration line needs to be read, so
    // short arrows slow down instead of the packet stopping for the text.
    // on.start(i) fires as the dot leaves for hop i, on.end(i) as it arrives.
    let hop = 0, moving = true, phaseStart = performance.now(), finished = false;
    const hopMs = (i: number) => Math.max((bounds[i + 1] - bounds[i]) / SPEED, lines[i] ? readTime(lines[i]) : 0) / rate();
    on.start?.(0);
    const distAt = (now: number) => {
      if (moving) {
        const run = bounds[hop + 1] - bounds[hop];
        const d = bounds[hop] + Math.min(run, ((now - phaseStart) / hopMs(hop)) * run);
        if (d < bounds[hop + 1]) return d;
        on.end?.(hop);
        if (hop === hops.length - 1) { finished = true; return total; }
        moving = false; phaseStart = now;
        return bounds[hop + 1];
      }
      if (now - phaseStart >= DWELL / rate()) { hop++; moving = true; phaseStart = now; on.start?.(hop); return bounds[hop]; }
      return bounds[hop + 1]; // dwelling at the box the dot just reached
    };
    return new Promise<void>((done) => {
      const frame = (now: number) => {
        if (token !== runToken) return done();
        const d = distAt(now);
        // Position: linear between the two samples around d.
        while (k < ds.length - 2 && ds[k + 1] <= d) k++;
        const span = ds[k + 1] - ds[k] || 1, f = Math.min(1, (d - ds[k]) / span);
        runner!.setAttribute('cx', (xs[k] + (xs[k + 1] - xs[k]) * f).toFixed(2));
        runner!.setAttribute('cy', (ys[k] + (ys[k + 1] - ys[k]) * f).toFixed(2));
        // Trails fill exactly up to the dot.
        hopRuns.forEach((h, i) => {
          if (!h.trail || d < bounds[i]) return;
          const along = Math.min(h.run, d - bounds[i]);
          if (!h.dashed) { h.trail.style.strokeDashoffset = String(h.run - along); return; }
          let m = h.drawn;
          while (m < h.at.length && h.at[m] <= along) m++;
          if (m === h.drawn && along < h.run) return; // no new sample point this frame
          h.drawn = m;
          const tip = along < h.run ? ` L${runner!.getAttribute('cx')} ${runner!.getAttribute('cy')}` : '';
          revealOf.get(h.trail)?.setAttribute('d', `M${h.pts.slice(0, m).join(' L')}${tip}`);
        });
        if (!finished) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
  }

  /**
   * Plays the request and its reply, then replays after a pause until the step
   * changes. Out: each arrow fills red behind the dot (sent, no reply yet) and
   * the sender waits (typing dots). Back: the reply fills each arrow green and
   * lights each node fully as it arrives. On a broken hop the request is lost
   * part-way: the red stops there, no reply comes, and every sender keeps waiting.
   */
  async function runPath(hops: Hop[], token: number): Promise<void> {
    if (!svg || !hops.length) return;
    const { out, back, broken, oneway, hang, answer, code } = legs(hops);
    const custom = sayings[index] ?? {};
    const far = out[out.length - 1].to, origin = out[0].from;
    const codeText = code === '200' ? '200 OK' : code;
    if (reduced) {
      runMark(out.map((h) => h.e), 'is-focus');
      if (broken) { runMark([out[out.length - 1].e], 'is-broken'); out.forEach((h) => waitOn(h.from)); return; }
      if (oneway) { runMark(out.map((h) => h.e), 'is-delivered'); runMark([out[out.length - 1].to], 'is-end'); return; }
      if (hang) { out.forEach((h) => waitOn(h.from)); hangOn(out[out.length - 1].to); return; }
      runMark(out.map((h) => h.e), answer === 'ok' ? 'is-ok' : `is-${answer}`);
      runMark([...out.map((h) => h.from), out[out.length - 1].to], 'is-end');
      return;
    }
    if (!runner) {
      runner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      runner.setAttribute('r', '6.5');
      runner.setAttribute('class', 'dg-runner');
      svg.insertBefore(runner, overlay?.isConnected ? overlay : null); // below the badges
    }
    // Narration, one line per hop. The far end's answer leads the first reply line.
    const outLines = out.map((h) => `${labelOf(h.from)} → ${labelOf(h.to)}`);
    const backLines = back.map((h, i) => (i === 0 ? `${labelOf(far)} answers ${codeText} → ${labelOf(h.to)}` : `${labelOf(h.from)} → ${labelOf(h.to)} · ${codeText}`));
    // The outcome comes after what led to it: `before` ms of the evidence first
    // (the clock running out, the dot fading, the last tick being drawn).
    const outcome = async (big: string, small: string, tone: string, before: number) => {
      await sleep(before);
      if (token !== runToken) return;
      say(small, tone);
      if (tone === 'ok') playSound('ok2xx');
      else if (tone === 'c4') playSound('c4xx');
      else if (tone === 'c5') playSound('c5xx');
      if (!mixedOutcomes) { await sleep(700); return; } // all-success diagram: narration only, no overlay
      showOutcome(big, small, tone); // on every run: each replay ends the same way
      await sleep(OUTCOME_MS);
      if (token === runToken) hideOutcome();
    };
    while (token === runToken) {
      runner.classList.remove('is-lost', 'is-reply', 'is-c4', 'is-c5', 'is-msg');
      if (oneway) runner.classList.add('is-msg');
      // Out: each hop lights as the dot enters it, and its sender starts waiting
      // (not for a one-way message: nothing will come back).
      // An arrowhead takes the fill colour the moment the fill reaches it: at the
      // end of a hop that runs with the arrow, at the start of one that runs against it.
      const sent = oneway ? 'is-delivered' : 'is-sent';
      await leg(out, token, oneway ? 'msg' : 'out', {
        start: (i) => {
          const h = out[i];
          say(outLines[i]);
          playSound('syn');
          if (!oneway) waitOn(h.from);
          runMark([h.e], 'is-focus');
          if (h.x) runMark([h.e], 'is-broken');
          else if (h.r) runMark([h.e], sent);
        },
        end: (i) => {
          if (custom[out[i].to]) say(custom[out[i].to]);
          if (!out[i].x && !out[i].r) runMark([out[i].e], sent);
          if (oneway) runMark([out[i].to], 'is-end'); // a one-way flow lights each stage as it gets there
        },
      }, broken ? LOST_AT : hang ? HANG_AT : undefined, outLines);
      if (token !== runToken) return;
      if (broken) {
        // Dropped on the wire: the dot dies there; the senders stop expecting much.
        runner.classList.add('is-lost');
        playSound('lost');
        for (const b of badges.values()) if (b.classList.contains('dg-wait')) b.classList.add('is-stale');
        await outcome('Request lost', custom[far] ?? `Dropped on the way to ${labelOf(far)}: no reply`, 'bad', LOST_FADE);
      } else if (hang) {
        // It reaches the far end, which swallows it and never answers.
        runner.classList.add('is-lost');
        hangOn(out[out.length - 1].to);
        say(`Waiting for ${labelOf(far)}…`, 'bad');
        // The clock runs (ticking every half second)...
        for (let t = 0; t < HANG_WAIT; t += 500) {
          playSound('tick');
          await sleep(Math.min(500, HANG_WAIT - t));
          if (token !== runToken) return;
        }
        timedOut(out[out.length - 1].to); // ...and runs out
        playSound('timeout');
        await outcome('No answer', custom[far] ?? `${labelOf(far)} never answers: ${labelOf(origin)} waits`, 'bad', 300);
      } else if (oneway) {
        // Delivered: the receiver lights; nothing comes back.
        runMark([out[out.length - 1].to], 'is-end');
        runner.style.opacity = '0';
        say(custom[far] ?? `Reached ${labelOf(far)}`, 'msg');
      } else {
        runMark([out[out.length - 1].to], 'is-end');
        if (custom[far]) say(custom[far], answer);
        await sleep(PAUSE);
        if (token !== runToken) return;
        // Back: the reply fills each hop green (amber/orange for an error answer)
        // and lights each node as it gets there.
        runner.classList.add('is-reply');
        if (answer !== 'ok') runner.classList.add(`is-${answer}`);
        const acked = answer === 'ok' ? 'is-acked' : `is-acked-${answer}`;
        await leg(back, token, answer === 'ok' ? 'back' : answer, {
          start: (i) => {
            say(backLines[i], answer);
            playSound('ack');
            if (back[i].r) runMark([back[i].e], acked);
          },
          end: (i) => {
            const h = back[i];
            runMark([h.e], acked);
            runMark([h.e], answer === 'ok' ? 'is-ok' : `is-${answer}`);
            waitOff(h.to, answer, code);
            runMark([h.to], 'is-end');
          },
        }, undefined, backLines);
        if (token !== runToken) return;
        runner.style.opacity = '0';
        await outcome(codeText, answer === 'ok' ? `${labelOf(origin)} got its answer` : `${labelOf(origin)} got ${codeText} from ${labelOf(far)}`, answer, BADGE_DRAW);
      }
      if (token !== runToken) return;
      // A short hold on the finished picture before the replay.
      await sleep(broken || hang ? HOLD_LOST : HOLD_OK);
      if (token !== runToken) return;
      onCycle?.(); // autoplay: this run is complete
      if (token !== runToken) return;
      // Rewind: fade everything this run lit, then go again.
      fig.classList.add('is-rewinding');
      hush();
      await sleep(REWIND);
      if (token !== runToken) return;
      clearRun();
      fig.classList.remove('is-rewinding');
      await sleep(300);
    }
  }
  const parentOf = new Map<string, string>();
  // Edge endpoints from the rendered edges (works for sequence message ids too).
  const endsOf = new Map<string, string[]>();
  fig.querySelectorAll<SVGGElement>('[data-kind=edge][data-from]').forEach((g) => endsOf.set(g.dataset.el!, [g.dataset.from!, g.dataset.to!]));
  const els = new Map<string, Element[]>();
  fig.querySelectorAll('[data-el]').forEach((g) => {
    const id = g.getAttribute('data-el')!;
    els.set(id, [...(els.get(id) ?? []), g]);
  });
  fig.querySelectorAll<SVGGElement>('[data-parent]').forEach((g) => parentOf.set(g.dataset.el!, g.dataset.parent!));
  const ancestors = (id: string) => {
    const out: string[] = [];
    for (let p = parentOf.get(id); p; p = parentOf.get(p)) out.push(p);
    return out;
  };

  // Absent when the figure is driven externally (data-player="external").
  const count = fig.querySelector<HTMLElement>('.dg-count') ?? document.createElement('span');
  const caption = fig.querySelector<HTMLElement>('.dg-caption') ?? document.createElement('div');
  const dots = fig.querySelector<HTMLElement>('.dg-dots') ?? document.createElement('div');
  const playBtn = fig.querySelector<HTMLButtonElement>('[data-act=play]') ?? document.createElement('button');
  const resetBtn = fig.querySelector<HTMLButtonElement>('[data-act=reset]');
  const build = fig.dataset.mode === 'build';
  const interval = Number(fig.dataset.interval) || 3200;
  let index = -1;
  let timer = 0;

  steps.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dg-dot';
    b.dataset.soundClick = 'popDown';
    b.setAttribute('aria-label', `Step ${i + 1}`);
    b.addEventListener('click', () => { stop(); go(i); });
    dots.append(b);
  });
  const mark = (ids: Iterable<string>, cls: string) => { for (const id of ids) els.get(id)?.forEach((g) => g.classList.add(cls)); };

  // Looping packets on the edges a step lights (steps without a packet path).
  // Created on demand and removed on the next step, so idle diagrams run no animation.
  let packets: Element[] = [];
  function addPackets() {
    fig.querySelectorAll<SVGGElement>('.dg-edge.is-focus:not(.tone-risk)').forEach((g) => {
      const d = g.querySelector('.dg-line')?.getAttribute('d');
      if (!d) return;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'dg-packet');
      c.setAttribute('r', '4.5');
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      m.setAttribute('dur', `${(Number(g.dataset.dur) || 1.5) / speed}s`);
      m.setAttribute('repeatCount', 'indefinite');
      m.setAttribute('path', d);
      c.append(m);
      g.insertBefore(c, g.querySelector('.dg-arrow'));
      packets.push(c);
    });
  }
  function go(i: number) {
    for (const p of packets.splice(0)) p.remove();
    index = Math.max(-1, Math.min(steps.length - 1, i));
    runToken++;
    fig.classList.remove('is-rewinding');
    clearRun();
    hush();
    applyLook(index >= 0 ? looks[index] : {});
    fig.classList.toggle('is-pathing', index >= 0 && paths[index].length > 0);
    fig.querySelectorAll('.is-focus, .is-context, .is-seen, .is-end').forEach((g) => g.classList.remove('is-focus', 'is-context', 'is-seen', 'is-end'));
    if (resetBtn) resetBtn.disabled = index < 0;
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', String(k === index)));
    if (index < 0) {
      delete fig.dataset.active;
      count.textContent = `${steps.length} steps`;
      caption.hidden = true;
      return;
    }
    fig.dataset.active = '';
    const now = focus[index];
    const context = new Set<string>();
    const ends = new Set<string>();
    for (const id of now) {
      ancestors(id).forEach((x) => context.add(x));
      for (const e of endsOf.get(id) ?? []) { ends.add(e); ancestors(e).forEach((x) => context.add(x)); }
    }
    if (build) {
      const seen = new Set(focus.slice(0, index).flat());
      for (const id of seen) ancestors(id).forEach((x) => context.add(x));
      mark(seen, 'is-seen');
    }
    mark(context, 'is-context');
    mark(ends, 'is-end');
    mark(now, 'is-focus');
    if (!paths[index].length && !reduced) addPackets();
    count.textContent = `${index + 1} / ${steps.length}`;
    if (paths[index].length) void runPath(paths[index], runToken);
    caption.innerHTML = steps[index].innerHTML;
    announce(paths[index]);
    caption.hidden = false;
  }
  function stop() {
    clearTimeout(timer);
    timer = 0;
    onCycle = null;
    playBtn.setAttribute('aria-label', 'Play');
    fig.classList.remove('is-playing');
  }
  function tick() {
    if (index >= steps.length - 1) return stop();
    go(index + 1);
    // A packet path: move on once its first full run (narration included) is done.
    if (paths[index].length && !reduced) {
      timer = -1; // playing, waiting for the run
      onCycle = () => { onCycle = null; if (timer) timer = window.setTimeout(tick, 400); };
    } else timer = window.setTimeout(tick, interval / speed); // caption-only steps: reading pace, not the 2× base
  }
  function play() {
    if (timer) return stop();
    if (index >= steps.length - 1) go(-1);
    playBtn.setAttribute('aria-label', 'Pause');
    fig.classList.add('is-playing');
    tick();
  }

  fig.addEventListener('click', (e) => {
    const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'slower') stepSpeed(-1);
    else if (act === 'faster') stepSpeed(1);
    else if (act === 'speed-reset') setSpeed(1);
    else if (act === 'prev') { stop(); go(index - 1); }
    else if (act === 'next') { stop(); go(index + 1); }
    else if (act === 'play') play();
    else if (act === 'reset') { stop(); go(-1); }
  });
  fig.addEventListener('keydown', (e) => {
    if (fig.dataset.player === 'external') return;
    if ((e.target as Element).closest('a, input, textarea')) return;
    if ((e.key === ' ' || e.key === 'Enter') && (e.target as Element).closest('.dg-opens')) return; // opens the box (drilldown.ts)
    if (e.key === 'ArrowRight') { stop(); go(index + 1); }
    else if (e.key === 'ArrowLeft') { stop(); go(index - 1); }
    else if (e.key === ' ' || e.key === 'k') play();
    else if (e.key === 'Home' || (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && index >= 0)) { stop(); go(-1); }
    else if (e.key === 'End') { stop(); go(steps.length - 1); }
    else return;
    e.preventDefault();
  });
  new IntersectionObserver((entries) => entries.forEach((en) => { if (!en.isIntersecting) stop(); })).observe(fig);
  // External driver (e.g. <Scrolly>): dispatch `dg:go` with the step index (-1 = overview).
  fig.addEventListener('dg:go', (e) => { stop(); go((e as CustomEvent<number>).detail); });
  fig.classList.add('has-player');
  go(-1);
}

export function initDiagrams() {
  setSpeed(speed); // sync every speed control (and --dg-speed) with the current speed
  document.querySelectorAll<HTMLElement>('figure.dg').forEach((fig) => {
    if (fig.dataset.ready) return;
    fig.dataset.ready = '1';
    setupExpand(fig);
    setupHover(fig);
    setupTrace(fig);
    setupSteps(fig);
  });
}
