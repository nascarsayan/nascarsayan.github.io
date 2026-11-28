/**
 * <DecisionTree> in the browser: lays the tree out left to right (one column per choice), folds branches,
 * colours roads by a lens, highlights roads by outcome, shows a road's runs in the detail pane, and keeps
 * the selected road in the URL (#<id>=<node>). Spec format: src/diagrams/decision.ts.
 */
import { best, leafOutcome, leaves, OUTCOME_LABEL, OUTCOMES, type Decision, type DNode, type Mark, type Outcome, type Run } from '@/diagrams/decision';
import { playSound } from './sound';

const SVG = 'http://www.w3.org/2000/svg';
const PAD_X = 15;      // text inset in a box (clear of the info button)
const ROW_GAP = 8;     // between stacked boxes
const COL_GAP = 44;    // between columns (room for the curves); the minimum
const COL_GAP_MAX = 160; // gaps widen up to this to fill the frame
const FILL_MARGIN = 20;  // breathing space kept free at the right when the gaps widen (no scrollbar)
const H = 32;          // box height (one line)
const H_NOTE = 42;     // box height with a note line
const BAR_H = 4;       // outcome bar under a branch label
const FOLD_W = 24;     // fold zone at the right of a branch box
const EDGE = 10;       // room for the info buttons that stick out of the top-left corners
const TAG_GAP = 8;     // leaf box to its mark tag

interface Placed { n: DNode; depth: number; x: number; y: number; w: number; h: number; parent?: Placed; kids: Placed[] }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const sv = (tag: string, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/** Markdown-lite for the detail pane: paragraphs, `code`, **bold**, [text](#anchor) (same-page links only). Built with text nodes only. */
function md(src: string): HTMLElement {
  const box = el('div', 'dt-md');
  for (const para of src.trim().split(/\n\s*\n/)) {
    const p = el('p');
    for (const part of para.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(#[\w-]+\))/)) {
      if (!part) continue;
      const link = part.match(/^\[([^\]]+)\]\((#[\w-]+)\)$/);
      if (link) { const a = el('a', undefined, link[1]); a.href = link[2]; p.append(a); }
      else if (part.startsWith('`')) p.append(el('code', undefined, part.slice(1, -1)));
      else if (part.startsWith('**')) p.append(el('strong', undefined, part.slice(2, -2)));
      else p.append(document.createTextNode(part));
    }
    box.append(p);
  }
  return box;
}

class Tree {
  private spec: Decision;
  private svg: SVGSVGElement;
  private detail: HTMLElement;
  private folded = new Set<string>();
  private lens = '*';
  private marked = new Set<Outcome>();
  private selected?: string;
  private focusId: string;
  private placed = new Map<string, Placed>();
  private byId = new Map<string, DNode>();
  private parentOf = new Map<string, DNode>();
  private measure = document.createElement('canvas').getContext('2d')!;
  /** Each marked road: the ids on it (root .. leaf). */
  private markPaths: { m: Mark; ids: Set<string> }[] = [];
  private onRoadTaken(id: string) { return this.markPaths.some((x) => x.ids.has(id)); }
  /** A column's info drawer is open (level index), instead of a box's. */
  private selLevel?: number;
  /** Gap between columns in the last layout: COL_GAP, widened to fill the frame's width. */
  private gap = COL_GAP;
  private scrollW = 0;

  constructor(private root: HTMLElement) {
    this.spec = JSON.parse(root.querySelector('script[type="application/json"]')!.textContent!);
    this.svg = root.querySelector('.dt-svg')!;
    this.detail = root.querySelector('.dt-detail')!;
    this.focusId = this.spec.root.id;
    const index = (n: DNode, p?: DNode) => {
      this.byId.set(n.id, n);
      if (p) this.parentOf.set(n.id, p);
      n.children?.forEach((c) => index(c, n));
    };
    index(this.spec.root);
    this.folded = new Set((this.spec.folded ?? []).filter((id) => this.byId.has(id)));
    this.markPaths = (this.spec.marks ?? []).map((m) => ({ m, ids: new Set([...this.ancestors(m.leaf).map((a) => a.id), m.leaf]) }));
    root.classList.add('is-js');
    this.wire();
    this.fromHash();
    this.render();
    // Re-lay out when the frame's width changes (window resize, full window), so the gaps keep filling it.
    const scroll = root.querySelector<HTMLElement>('.dt-scroll');
    if (scroll) {
      this.scrollW = scroll.clientWidth;
      new ResizeObserver(() => {
        if (scroll.clientWidth === this.scrollW) return;
        this.scrollW = scroll.clientWidth;
        this.render();
      }).observe(scroll);
    }
  }

  // ---- state ------------------------------------------------------------------------------------------------
  private outcome(n: DNode): Outcome {
    if (n.blocked) return 'blocked';
    if (this.lens !== '*') return leafOutcome(n, this.lens);
    return best(this.spec.lenses.map((l) => leafOutcome(n, l.id))) ?? 'untested';
  }
  private counts(n: DNode): Record<Outcome, number> {
    const c = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
    for (const l of leaves(n)) c[this.outcome(l)]++;
    return c;
  }
  private ancestors(id: string): DNode[] {
    const out: DNode[] = [];
    for (let p = this.parentOf.get(id); p; p = this.parentOf.get(p.id)) out.unshift(p);
    return out;
  }
  private reveal(id: string) { for (const a of this.ancestors(id)) this.folded.delete(a.id); }
  private matches(n: DNode): boolean {
    return !this.marked.size || leaves(n).some((l) => this.marked.has(this.outcome(l)));
  }

  // ---- layout -----------------------------------------------------------------------------------------------
  private textW(s: string, small = false) {
    const cs = getComputedStyle(this.root);
    this.measure.font = `${small ? 600 : 600} ${small ? 11 : 13}px ${cs.fontFamily}`;
    return Math.ceil(this.measure.measureText(s).width);
  }
  private boxW(n: DNode): number {
    const kids = n.children?.length ?? 0;
    let w = this.textW(n.label) + 2 * PAD_X + (kids ? FOLD_W : 0) + (!kids && !n.blocked ? 12 * this.spec.lenses.length + 6 : 0);
    if (n.note) w = Math.max(w, this.textW(n.note, true) + 2 * PAD_X + (kids ? FOLD_W : 0));
    return Math.min(w, 260);
  }
  private layout(): { w: number; h: number } {
    this.placed.clear();
    const colW: number[] = [];
    const visit = (n: DNode, depth: number) => {
      colW[depth] = Math.max(colW[depth] ?? 0, this.boxW(n));
      if (!this.folded.has(n.id)) n.children?.forEach((c) => visit(c, depth + 1));
    };
    visit(this.spec.root, 0);
    const tagW = Math.max(0, ...(this.spec.marks ?? []).map((m) => this.textW(m.label, true) + 22));
    const tail = 2 + (tagW ? TAG_GAP + tagW : 0);
    const scroll = this.root.querySelector<HTMLElement>('.dt-scroll');
    const avail = scroll ? scroll.clientWidth - 8 - 2 - FILL_MARGIN : 0; // less side padding, the svg's 2px, the margin
    const natural = EDGE + colW.reduce((a, b) => a + b, 0) + (colW.length - 1) * COL_GAP + tail;
    this.gap = colW.length > 1 && avail > natural ? Math.min(COL_GAP_MAX, COL_GAP + (avail - natural) / (colW.length - 1)) : COL_GAP;
    const colX: number[] = [];
    colW.reduce((x, w, i) => { colX[i] = x; return x + w + this.gap; }, EDGE);
    let cursor = EDGE;
    const place = (n: DNode, depth: number, parent?: Placed): Placed => {
      const h = n.note ? H_NOTE : H;
      const p: Placed = { n, depth, x: colX[depth], y: 0, w: colW[depth], h, parent, kids: [] };
      const open = n.children?.length && !this.folded.has(n.id);
      if (open) {
        p.kids = n.children!.map((c) => place(c, depth + 1, p));
        const first = p.kids[0], last = p.kids[p.kids.length - 1];
        p.y = (first.y + first.h / 2 + last.y + last.h / 2) / 2 - h / 2;
        if (p.y < cursor - h - ROW_GAP && p.kids.length === 1) p.y = first.y + (first.h - h) / 2;
      } else {
        p.y = cursor;
        cursor += h + ROW_GAP;
      }
      this.placed.set(n.id, p);
      return p;
    };
    place(this.spec.root, 0);
    const top = Math.min(...[...this.placed.values()].map((p) => p.y)) - EDGE;
    if (top < 0) for (const p of this.placed.values()) p.y -= top;
    const h = Math.max(...[...this.placed.values()].map((p) => p.y + p.h));
    return { w: colX[colX.length - 1] + colW[colW.length - 1] + tail, h: h + 2 };
  }

  // ---- drawing ----------------------------------------------------------------------------------------------
  private render() {
    const { w, h } = this.layout();
    const svg = this.svg;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `-1 -1 ${w + 2} ${h + 2}`);
    svg.setAttribute('width', String(w + 2));
    svg.setAttribute('height', String(h + 2));
    // Column heads (the choices) go in the HTML strip above.
    this.drawHeads();
    const edges = sv('g', { class: 'dt-edges' });
    const nodes = sv('g', { class: 'dt-nodes' });
    svg.append(edges, nodes);
    const path = new Set<string>(this.selected ? [...this.ancestors(this.selected).map((a) => a.id), this.selected] : []);
    for (const p of this.placed.values()) {
      if (p.parent) {
        const a = p.parent, x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = p.x, y2 = p.y + p.h / 2, mx = (x1 + x2) / 2;
        const o = p.n.children?.length ? best(leaves(p.n).map((l) => this.outcome(l)))! : this.outcome(p.n);
        edges.append(sv('path', {
          d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
          class: `dt-edge is-${o}${path.has(p.n.id) ? ' is-path' : ''}${this.onRoadTaken(p.n.id) ? ' is-taken' : ''}${this.matches(p.n) ? '' : ' is-dim'}`,
          'data-to': p.n.id,
        }));
      }
      nodes.append(this.drawNode(p, path.has(p.n.id)));
    }
    this.drawLegendCounts();
    this.drawDetail();
  }

  private drawHeads() {
    let strip = this.root.querySelector<HTMLElement>('.dt-heads');
    if (!strip) {
      strip = el('div', 'dt-heads');
      this.root.querySelector('.dt-scroll')!.prepend(strip);
    }
    strip.replaceChildren();
    const cols = new Map<number, Placed>();
    for (const p of this.placed.values()) if (!cols.has(p.depth)) cols.set(p.depth, p);
    for (const [d, p] of [...cols].sort((a, b) => a[0] - b[0])) {
      const lv = d > 0 ? this.spec.levels[d - 1] : undefined;
      const t = el('span', 'dt-head');
      if (lv && (lv.about || lv.options?.length)) {
        // The site's "i" button, as on the boxes: opens the column's drawer (what the choice and its options mean).
        const b = el('button', `dt-hinfo${this.selLevel === d - 1 ? ' is-open' : ''}`);
        b.type = 'button';
        b.dataset.dtLevel = String(d - 1);
        b.setAttribute('aria-label', `About the choice: ${lv.title}`);
        b.setAttribute('aria-expanded', String(this.selLevel === d - 1));
        b.title = `What "${lv.title}" means`;
        b.innerHTML = '<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle class="dg-info-bg" r="8.5"/><circle class="dg-info-dot" cy="-3.6" r="1.25"/><path class="dg-info-ic" d="M0 -0.6v5"/></svg>';
        t.append(b);
      }
      t.append(el('span', 'dt-head-t', d === 0 ? 'Start' : lv?.title ?? ''));
      t.style.left = `${p.x}px`;
      t.style.width = `${p.w + (d < cols.size - 1 ? this.gap - 8 : 0)}px`; // a head may run into the gap after its column (not past the last)
      strip.append(t);
    }
  }

  private drawNode(p: Placed, onPath: boolean): SVGGElement {
    const n = p.n;
    const isLeaf = !n.children?.length;
    const o = isLeaf ? this.outcome(n) : undefined;
    const g = sv('g', {
      class: `dt-node ${isLeaf ? `is-leaf is-${o}` : 'is-branch'}${n.id === this.selected ? ' is-sel is-info-open' : ''}${onPath ? ' is-path' : ''}${this.matches(n) ? '' : ' is-dim'}`,
      transform: `translate(${p.x},${p.y})`,
      role: 'treeitem',
      tabindex: n.id === this.focusId ? 0 : -1,
      'data-id': n.id,
      'aria-level': p.depth + 1,
      'aria-selected': String(n.id === this.selected),
    }) as SVGGElement;
    if (!isLeaf) g.setAttribute('aria-expanded', String(!this.folded.has(n.id)));
    const label = isLeaf
      ? `${n.label}: ${n.blocked ? `not possible, ${n.blocked}` : this.spec.lenses.map((l) => `${l.label} ${OUTCOME_LABEL[leafOutcome(n, l.id)]}`).join(', ')}`
      : `${this.spec.levels[p.depth]?.title ?? ''}: ${n.label}`;
    g.setAttribute('aria-label', label);
    const title = sv('title');
    title.textContent = label;
    g.append(title);
    g.append(sv('rect', { class: 'dt-box', width: p.w, height: p.h }));
    const tx = sv('text', { class: 'dt-label', x: PAD_X, y: n.note ? 17 : p.h / 2 + 4.5 });
    tx.textContent = n.label;
    g.append(tx);
    if (n.note) {
      const nt = sv('text', { class: 'dt-note', x: PAD_X, y: isLeaf ? 32 : 29 });
      nt.textContent = n.note;
      g.append(nt);
    }
    if (isLeaf && !n.blocked) {
      // One dot per lens on the right (a lens selected: that dot is ringed).
      this.spec.lenses.forEach((l, i) => {
        const cx = p.w - 10 - (this.spec.lenses.length - 1 - i) * 12;
        const dot = sv('circle', { class: `dt-dot is-${leafOutcome(n, l.id)}${this.lens === l.id ? ' is-lens' : ''}`, cx, cy: n.note ? 13 : p.h / 2, r: 4.5 });
        const t = sv('title');
        t.textContent = `${l.label}: ${OUTCOME_LABEL[leafOutcome(n, l.id)]}`;
        dot.append(t);
        g.append(dot);
      });
    }
    if (!isLeaf) {
      // Fold zone on the right (chevron, full height) and, under the label, a bar of how the roads below end.
      const folded = this.folded.has(n.id);
      const fold = sv('g', { class: 'dt-fold', role: 'button', 'aria-label': `${folded ? 'Unfold' : 'Fold'} ${n.label}` });
      const ft = sv('title');
      ft.textContent = folded ? 'Unfold' : 'Fold';
      fold.append(ft, sv('rect', { class: 'dt-fold-hit', x: p.w - FOLD_W, y: 1, width: FOLD_W - 1, height: p.h - 2 }),
        sv('path', { class: 'dt-chev', d: folded ? `M${p.w - 15},${p.h / 2 - 4} l4,4 -4,4` : `M${p.w - 17},${p.h / 2 - 2} l4,4 4,-4` }));
      g.append(fold);
      const c = this.counts(n), total = Object.values(c).reduce((a, b) => a + b, 0);
      let x = PAD_X;
      const bw = p.w - 2 * PAD_X - FOLD_W + 6;
      for (const oc of OUTCOMES) {
        if (!c[oc]) continue;
        const w = (bw * c[oc]) / total;
        g.append(sv('rect', { class: `dt-bar is-${oc}`, x, y: p.h - BAR_H - 3, width: Math.max(w - 1, 1), height: BAR_H, rx: 1.5 }));
        x += w;
      }
      if (folded) {
        const more = sv('text', { class: 'dt-more', x: p.w + 6, y: p.h / 2 + 4 });
        more.textContent = `+${leaves(n).length}`;
        g.append(more);
      }
    }
    g.append(this.infoButton(n));
    if (this.onRoadTaken(n.id)) g.classList.add('is-taken');
    // A small tag after the leaf of each marked road.
    let ty = 0;
    for (const { m } of this.markPaths.filter((x) => x.m.leaf === n.id)) {
      const tw = this.textW(m.label, true) + 18;
      const tag = sv('g', { class: 'dt-tag', transform: `translate(${p.w + TAG_GAP},${(p.h - 20) / 2 + ty})` });
      const tt = sv('title');
      tt.textContent = m.note ? `${m.label}: ${m.note}` : m.label;
      const tx2 = sv('text', { x: 9, y: 14 });
      tx2.textContent = m.label;
      tag.append(tt, sv('rect', { width: tw, height: 20, rx: 10 }), tx2);
      g.append(tag);
      ty += 24;
    }
    return g;
  }

  /** The site's "i" button (render.ts infoButton): top-left corner, opens this box's drawer. */
  private infoButton(n: DNode): SVGGElement {
    const b = sv('g', { class: 'dg-info-btn dt-info', role: 'button', 'aria-label': `About ${n.label}`, 'aria-expanded': String(n.id === this.selected) }) as SVGGElement;
    const t = sv('title');
    t.textContent = n.id === this.selected ? 'Close details' : 'Details';
    b.append(t, sv('circle', { class: 'dg-info-bg', cx: 3, cy: 3, r: 9 }), sv('circle', { class: 'dg-info-dot', cx: 3, cy: -0.6, r: 1.25 }),
      sv('path', { class: 'dg-info-ic', d: 'M3 2.4v5' }));
    return b;
  }

  private drawLegendCounts() {
    const c = this.counts(this.spec.root);
    this.root.querySelectorAll<HTMLElement>('[data-dt-count]').forEach((s) => {
      const o = s.dataset.dtCount as Outcome;
      s.textContent = String(c[o]);
      s.closest('button')!.toggleAttribute('hidden', !c[o]);
    });
    this.root.querySelectorAll<HTMLElement>('[data-dt-outcome]').forEach((b) =>
      b.setAttribute('aria-pressed', String(this.marked.has(b.dataset.dtOutcome as Outcome))));
    this.root.querySelectorAll<HTMLElement>('[data-dt-lens]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.dtLens === this.lens)));
  }

  // ---- detail pane ------------------------------------------------------------------------------------------
  private drawDetail() {
    const d = this.detail;
    const n = this.selected ? this.byId.get(this.selected) : undefined;
    d.hidden = !n && this.selLevel == null;
    d.replaceChildren();
    if (this.selLevel != null) { this.drawLevel(this.selLevel); return; }
    if (!n) return;
    requestAnimationFrame(() => this.placeDetail());
    const head = el('div', 'dt-dhead');
    const crumbs = el('div', 'dt-crumbs');
    const chain = [...this.ancestors(n.id), n].slice(1);
    chain.forEach((a, i) => {
      const b = el('button', 'dt-crumb');
      b.type = 'button';
      b.dataset.dtGo = a.id;
      b.append(el('span', 'dt-crumb-k', this.spec.levels[i]?.title ?? ''), el('span', 'dt-crumb-v', a.label));
      crumbs.append(b);
    });
    const x = el('button', 'dg-btn dt-x');
    x.type = 'button';
    x.dataset.dt = 'close';
    x.setAttribute('aria-label', 'Close details');
    x.title = 'Close (Esc)';
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    head.append(crumbs, x);
    d.append(head);
    if (n.note && n.children?.length) d.append(el('p', 'dt-dnote', n.note));
    this.markPaths.forEach(({ m }) => {
      if (m.leaf !== n.id) return;
      const pill = el('div', 'dt-markpill');
      pill.append(el('strong', undefined, m.label));
      if (m.note) pill.append(md(m.note));
      d.append(pill);
    });
    if (n.about) d.append(md(n.about));
    if (n.blocked) {
      d.append(el('p', 'dt-pill is-blocked', `Not possible: ${n.blocked}`));
      return;
    }
    if (n.children?.length) {
      // A branch: how its roads end, per lens.
      const t = el('table', 'dt-sum');
      const hr = el('tr');
      hr.append(el('th', undefined, ''), ...this.spec.lenses.map((l) => el('th', undefined, l.label)));
      t.append(hr);
      for (const o of OUTCOMES) {
        const per = this.spec.lenses.map((l) => leaves(n).filter((x) => leafOutcome(x, l.id) === o).length);
        if (!per.some(Boolean)) continue;
        const tr = el('tr');
        const th = el('th');
        th.append(el('i', `dt-sw is-${o}`), document.createTextNode(OUTCOME_LABEL[o]));
        tr.append(th, ...per.map((v) => el('td', undefined, v ? String(v) : '')));
        t.append(tr);
      }
      d.append(el('p', 'dt-dim', `${leaves(n).length} roads below. Click a road for its runs.`), t);
      return;
    }
    // A road: per lens, its runs.
    for (const l of this.spec.lenses) {
      const runs = (n.runs ?? []).filter((r) => r.lens === l.id);
      const sec = el('section', 'dt-lensrun');
      const h = el('h4');
      h.append(el('i', `dt-sw is-${leafOutcome(n, l.id)}`), document.createTextNode(`${l.label}: ${OUTCOME_LABEL[leafOutcome(n, l.id)]}`));
      sec.append(h);
      if (!runs.length) sec.append(el('p', 'dt-dim', 'Not run here.'));
      for (const r of runs) sec.append(this.drawRun(r));
      d.append(sec);
    }
  }

  /** A column's drawer: the choice, then each option with what it means and costs. */
  private drawLevel(i: number) {
    const d = this.detail, lv = this.spec.levels[i];
    const head = el('div', 'dt-dhead');
    const h = el('div', 'dt-lvtitle');
    h.append(el('span', 'dt-crumb-k', `Choice ${i + 1} of ${this.spec.levels.length}`), el('strong', undefined, lv.title));
    const x = el('button', 'dg-btn dt-x');
    x.type = 'button';
    x.dataset.dt = 'close';
    x.setAttribute('aria-label', 'Close details');
    x.title = 'Close (Esc)';
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    head.append(h, x);
    d.append(head);
    if (lv.about) d.append(md(lv.about));
    if (lv.options?.length) {
      const dl = el('dl', 'dt-opts');
      for (const o of lv.options) {
        dl.append(el('dt', undefined, o.label));
        const dd = el('dd');
        dd.append(md(o.about));
        dl.append(dd);
      }
      d.append(dl);
    }
    this.detail.style.top = '0px';
  }

  /** The drawer level with the selected box, inside the tree's visible height. */
  private placeDetail() {
    const p = this.selected ? this.placed.get(this.selected) : undefined;
    if (!p || this.detail.hidden) return;
    const scroll = this.root.querySelector<HTMLElement>('.dt-scroll')!;
    const off = scroll.offsetTop + 26; // .dt-scroll padding-top
    const max = Math.max(0, scroll.offsetHeight - this.detail.offsetHeight);
    this.detail.style.top = `${Math.min(Math.max(0, off + p.y - 24), max)}px`;
  }

  private drawRun(r: Run): HTMLElement {
    const box = el('div', `dt-run is-${r.outcome}`);
    const top = el('div', 'dt-run-top');
    top.append(el('code', 'dt-run-id', r.id), el('span', 'dt-run-title', r.title));
    if (r.at) top.append(el('span', 'dt-dim', r.at.slice(0, 16).replace('T', ' ')));
    box.append(top);
    if (r.extra?.length) {
      const ex = el('div', 'dt-extra');
      for (const e of r.extra) ex.append(el('code', undefined, e));
      box.append(ex);
    }
    if (r.checks) {
      const ul = el('ul', 'dt-checks');
      for (const [c, ok] of Object.entries(r.checks)) {
        const why = r.explained?.[c];
        const f = why ? this.spec.findings?.find((x) => x.id === why) : undefined;
        const title = this.spec.checks?.find((x) => x.id === c)?.title ?? c;
        const li = el('li', `dt-check ${ok ? 'is-pass' : f ? `is-known is-${f.scope}` : 'is-fail'}`);
        li.append(el('span', 'dt-check-k', c), el('span', 'dt-check-v', ok ? 'pass' : f ? f.scope === 'sim' ? 'sim limit' : f.scope === 'expected' ? 'expected' : 'limit' : 'FAIL'));
        li.title = ok ? title : f ? `${title}: ${f.title}` : title;
        ul.append(li);
      }
      box.append(ul);
      const seen = new Set<string>();
      for (const why of Object.values(r.explained ?? {})) {
        if (seen.has(why)) continue;
        seen.add(why);
        const f = this.spec.findings?.find((x) => x.id === why);
        if (!f) continue;
        const fd = el('details', `dt-finding is-${f.scope}`);
        const s = el('summary');
        s.append(el('span', 'dt-scope', f.scope === 'real' ? 'real' : f.scope === 'sim' ? 'sim only' : 'expected'), document.createTextNode(f.title));
        fd.append(s, md(f.detail));
        if (f.fix) fd.append(md(`**What to do:** ${f.fix}`));
        box.append(fd);
      }
    }
    if (r.log) {
      const lg = el('details', 'dt-log');
      lg.append(el('summary', undefined, r.log.title));
      const pre = el('pre');
      pre.textContent = r.log.lines.join('\n');
      lg.append(pre);
      box.append(lg);
    }
    return box;
  }

  // ---- input ------------------------------------------------------------------------------------------------
  private selectLevel(i: number | undefined) {
    this.selLevel = i;
    if (i != null) this.selected = undefined;
    history.replaceState(null, '', i != null ? `#${this.root.id}=choice-${this.spec.levels[i].key}` : location.pathname + location.search);
    playSound(i != null ? 'popUpOn' : 'popUpOff');
    this.render();
  }
  private select(id: string | undefined, sound = true) {
    this.selected = id;
    this.selLevel = undefined;
    if (id) { this.focusId = id; this.reveal(id); }
    const h = id ? `#${this.root.id}=${id}` : ' ';
    history.replaceState(null, '', h === ' ' ? location.pathname + location.search : h);
    if (sound) playSound(id ? 'popUpOn' : 'popUpOff');
    this.render();
  }
  private toggle(id: string) {
    const n = this.byId.get(id)!;
    if (!n.children?.length) return;
    if (this.folded.has(id)) this.folded.delete(id); else this.folded.add(id);
    if (this.selected && this.folded.has(id) && this.ancestors(this.selected).some((a) => a.id === id)) {
      this.selected = undefined;
      history.replaceState(null, '', location.pathname + location.search);
    }
    playSound(this.folded.has(id) ? 'popDown' : 'popUpOn');
    this.render();
  }
  private focus(id: string) {
    this.focusId = id;
    this.render();
    this.svg.querySelector<SVGGElement>(`[data-id="${id}"]`)?.focus();
  }
  private fromHash() {
    const lm = location.hash.match(new RegExp(`^#${this.root.id}=choice-([A-Za-z0-9_-]+)$`));
    const li = lm ? this.spec.levels.findIndex((l) => l.key === lm[1]) : -1;
    if (li >= 0) { this.selLevel = li; return; }
    const m = location.hash.match(new RegExp(`^#${this.root.id}=([a-z0-9-]+)$`));
    if (m && this.byId.has(m[1])) { this.selected = m[1]; this.focusId = m[1]; this.reveal(m[1]); }
  }
  private visibleSiblings(id: string): DNode[] {
    const p = this.parentOf.get(id);
    return p ? p.children! : [this.spec.root];
  }

  private wire() {
    const r = this.root;
    this.svg.addEventListener('click', (e) => {
      const g = (e.target as Element).closest<SVGGElement>('.dt-node');
      if (!g) return;
      const id = g.dataset.id!;
      const n = this.byId.get(id)!;
      this.focusId = id;
      if ((e.target as Element).closest('.dt-info') || !n.children?.length) this.select(this.selected === id ? undefined : id);
      else this.toggle(id);
    });
    this.svg.addEventListener('mouseover', (e) => {
      const g = (e.target as Element).closest<SVGGElement>('.dt-node');
      this.svg.querySelectorAll('.is-hover').forEach((x) => x.classList.remove('is-hover'));
      if (!g) return;
      const ids = [...this.ancestors(g.dataset.id!).map((a) => a.id), g.dataset.id!];
      for (const id of ids) {
        this.svg.querySelector(`.dt-node[data-id="${id}"]`)?.classList.add('is-hover');
        this.svg.querySelector(`.dt-edge[data-to="${id}"]`)?.classList.add('is-hover');
      }
    });
    this.svg.addEventListener('mouseleave', () => this.svg.querySelectorAll('.is-hover').forEach((x) => x.classList.remove('is-hover')));
    this.svg.addEventListener('keydown', (e) => {
      const id = (e.target as Element).closest<SVGGElement>('.dt-node')?.dataset.id;
      if (!id) return;
      const n = this.byId.get(id)!;
      const sibs = this.visibleSiblings(id), i = sibs.findIndex((s) => s.id === id);
      const open = n.children?.length && !this.folded.has(id);
      let to: string | undefined;
      if (e.key === 'ArrowDown') to = sibs[i + 1]?.id;
      else if (e.key === 'ArrowUp') to = sibs[i - 1]?.id;
      else if (e.key === 'ArrowRight') { if (n.children?.length && !open) { this.toggle(id); this.focus(id); } else to = n.children?.[0]?.id; }
      else if (e.key === 'ArrowLeft') { if (open) { this.toggle(id); this.focus(id); } else to = this.parentOf.get(id)?.id; }
      else if (e.key === 'Enter') { this.select(id); this.focus(id); }
      else if (e.key === ' ') { if (n.children?.length) this.toggle(id); else this.select(id); this.focus(id); }
      else return;
      e.preventDefault();
      if (to) this.focus(to);
    });
    r.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const go = t.closest<HTMLElement>('[data-dt-go]');
      if (go) { this.select(go.dataset.dtGo); return; }
      const lvb = t.closest<HTMLElement>('[data-dt-level]');
      if (lvb) { const i = Number(lvb.dataset.dtLevel); this.selectLevel(this.selLevel === i ? undefined : i); return; }
      const b = t.closest<HTMLElement>('[data-dt],[data-dt-lens],[data-dt-outcome]');
      if (!b) return;
      if (b.dataset.dtLens) { this.lens = b.dataset.dtLens; this.render(); return; }
      if (b.dataset.dtOutcome) {
        const o = b.dataset.dtOutcome as Outcome;
        if (this.marked.has(o)) this.marked.delete(o); else this.marked.add(o);
        playSound('popDown');
        this.render();
        return;
      }
      const a = b.dataset.dt;
      if (a === 'close') this.select(undefined);
      else if (a === 'expand') { this.folded.clear(); playSound('popUpOn'); this.render(); }
      else if (a === 'collapse') { for (const c of this.spec.root.children ?? []) if (c.children?.length) this.folded.add(c.id); this.select(undefined, false); playSound('popDown'); }
      else if (a === 'full') this.full();
    });
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Topmost layer first: the open selection (its detail), then the full window.
        if (this.selected || this.selLevel != null) this.select(undefined);
        else if (r.classList.contains('is-full')) this.full(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !(e.target as HTMLElement).closest('input,textarea')) {
        e.preventDefault();
        this.full();
      }
    });
  }

  private full(on = !this.root.classList.contains('is-full')) {
    this.root.classList.toggle('is-full', on);
    document.documentElement.classList.toggle('dt-lock', on);
    playSound(on ? 'popUpOn' : 'popUpOff');
    if (on) this.root.focus();
  }
}

export function initDecisions() {
  document.querySelectorAll<HTMLElement>('[data-decision]').forEach((r) => {
    if (!r.classList.contains('is-js')) new Tree(r);
  });
}
