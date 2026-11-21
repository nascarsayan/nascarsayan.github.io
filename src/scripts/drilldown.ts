/**
 * <Drilldown> behaviour. Each level (.dd) owns its figure, its panels (one per box
 * that opens) and a lens SVG. Opening a box shows its panel and draws the lens: a
 * faint trapezoid with dotted sides from the box's bottom corners to the panel's
 * top corners. One panel per level is open; closing a level closes everything below.
 * The open box ids, top level down, go in the URL hash (#computer/cpu/core).
 * A panel's data-dd-for lists the boxes that open it: several boxes of one level
 * may share one panel (same inside); switching between them keeps it open.
 */
import { playSound } from './sound';

interface Level { dd: HTMLElement; current(): string | null; set(key: string | null, o?: { scroll?: boolean; sound?: boolean }): void; draw(): void }
const levels = new WeakMap<HTMLElement, Level>();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const own = <T extends Element>(dd: Element, sel: string) => [...dd.children].filter((c): c is T => c.matches(sel));
const keysOf = (p: HTMLElement) => (p.dataset.ddFor ?? '').split(' ');
const panelOf = (dd: Element, k: string) => own<HTMLElement>(dd, 'section.dd-panel').find((p) => keysOf(p).includes(k));

function setup(dd: HTMLElement): Level {
  const fig = own<HTMLElement>(dd, 'figure.dg')[0];
  const panels = own<HTMLElement>(dd, 'section.dd-panel');
  const lens = own<SVGSVGElement>(dd, 'svg.dd-lens')[0];
  const box = (k: string) => fig?.querySelector<SVGGElement>(`.dg-node.dg-opens[data-el="${CSS.escape(k)}"]`) ?? null;
  let open: string | null = null;

  function draw() {
    if (!lens) return;
    const panel = open ? panelOf(dd, open) : undefined;
    const shape = open ? box(open)?.querySelector('.dg-shape') : null;
    if (!panel || !shape || panel.hidden || fig.classList.contains('is-expanded')) { lens.classList.remove('is-on'); return; }
    const r = dd.getBoundingClientRect(), b = shape.getBoundingClientRect(), p = panel.getBoundingClientRect();
    lens.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    lens.setAttribute('width', String(r.width));
    lens.setAttribute('height', String(r.height));
    const x = (v: number) => (v - r.left).toFixed(1), y = (v: number) => (v - r.top).toFixed(1);
    const [l1, l2] = lens.querySelectorAll('line');
    lens.querySelector('polygon')!.setAttribute('points', `${x(b.left)},${y(b.bottom)} ${x(b.right)},${y(b.bottom)} ${x(p.right)},${y(p.top)} ${x(p.left)},${y(p.top)}`);
    for (const [ln, bx, px] of [[l1, b.left, p.left], [l2, b.right, p.right]] as const) {
      ln.setAttribute('x1', x(bx)); ln.setAttribute('y1', y(b.bottom));
      ln.setAttribute('x2', x(px)); ln.setAttribute('y2', y(p.top));
    }
    lens.classList.add('is-on');
  }

  /** Redraw every frame while the panel animates in. */
  function follow(ms: number) {
    const end = performance.now() + ms;
    const f = () => { draw(); if (performance.now() < end) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  function set(key: string | null, { scroll = true, sound = true } = {}) {
    if (key === open) return;
    const was = open;
    open = key;
    for (const p of panels) {
      const on = key !== null && keysOf(p).includes(key);
      for (const k of keysOf(p)) {
        box(k)?.setAttribute('aria-expanded', String(k === key));
        box(k)?.classList.toggle('is-open', k === key);
      }
      const g = on ? box(key!) : null;
      if (on) {
        const colour = g?.querySelector('.dg-shape') ? getComputedStyle(g.querySelector('.dg-shape')!).stroke : '';
        dd.style.setProperty('--dd-c', colour);
        p.style.setProperty('--dd-c', colour);
        // The panel grows out of the box: its transform origin sits under the box.
        const gb = g?.getBoundingClientRect(), pb = dd.getBoundingClientRect();
        if (gb) p.style.setProperty('--dd-ox', `${(gb.left + gb.width / 2 - pb.left).toFixed(0)}px`);
        if (!p.hidden) continue; // another box of the same shared panel: it stays open
        p.hidden = false;
        p.classList.remove('is-in');
        requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('is-in')));
      } else if (!p.hidden) {
        p.hidden = true;
        p.classList.remove('is-in');
        // Everything below a closed level closes too.
        p.querySelectorAll<HTMLElement>('.dd').forEach((d) => levels.get(d)?.set(null, { scroll: false, sound: false }));
      }
    }
    if (sound) playSound(key ? 'popUpOn' : 'popUpOff');
    follow(reduced() ? 0 : 420);
    hash(dd);
    if (key && scroll) {
      const p = panelOf(dd, key)!;
      const top = p.getBoundingClientRect().top;
      if (top > innerHeight * 0.7) scrollBy({ top: top - innerHeight * 0.4, behavior: reduced() ? 'auto' : 'smooth' });
    } else if (!key && was && scroll) {
      const f = fig.getBoundingClientRect();
      if (f.bottom < 0 || f.top > innerHeight) fig.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    }
  }

  const toggle = (k: string) => set(open === k ? null : k);
  fig?.addEventListener('click', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.dg-node.dg-opens');
    if (g && fig.contains(g)) toggle(g.dataset.el!);
  });
  fig?.addEventListener('keydown', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.dg-node.dg-opens');
    if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    e.stopPropagation(); // Space would also start the step player
    toggle(g.dataset.el!);
  });
  for (const p of panels) {
    p.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || (e.target as Element).closest('figure.is-expanded')) return;
      // Only the innermost open panel handles it.
      if ((e.target as Element).closest('section.dd-panel') !== p) return;
      e.preventDefault();
      const k = open;
      set(null);
      if (k) box(k)?.focus();
    });
  }
  new ResizeObserver(() => draw()).observe(dd);
  const level = { dd, set, draw, current: () => open };
  levels.set(dd, level);
  return level;
}

/** The URL names the open boxes from the top level down; nothing open: no hash. */
function hash(dd: HTMLElement) {
  const root = dd.closest<HTMLElement>('.dd[data-dd=root]');
  if (!root) return;
  const keys: string[] = [];
  for (let d: HTMLElement | undefined = root; d; ) {
    const k = levels.get(d)?.current();
    const panel = k ? panelOf(d, k) : undefined;
    if (!k || !panel) break;
    keys.push(k);
    d = own<HTMLElement>(panel, '.dd')[0];
  }
  const url = location.pathname + location.search + (keys.length ? `#${root.id}/${keys.join('/')}` : '');
  if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
}

/** Open the levels along `path` ("cpu/core"); "" closes everything. */
function go(root: HTMLElement, path: string, scroll = true) {
  const keys = path ? path.split('/') : [];
  let dd: HTMLElement | null = root;
  let target: HTMLElement | undefined = root;
  levels.get(root)?.set(null, { scroll: false, sound: false });
  for (const k of keys) {
    const level = dd && levels.get(dd);
    if (!level) break;
    level.set(k, { scroll: false, sound: false });
    target = panelOf(dd!, k);
    dd = target ? own<HTMLElement>(target, '.dd')[0] ?? null : null;
  }
  if (!scroll) return;
  target?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
}

export function initDrilldowns() {
  document.querySelectorAll<HTMLElement>('.dd[data-dd=root]').forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    [root, ...root.querySelectorAll<HTMLElement>('.dd')].forEach(setup);
    root.addEventListener('click', (e) => {
      const t = e.target as Element;
      const goBtn = t.closest<HTMLElement>('[data-dd-go]');
      if (goBtn) {
        go(root, goBtn.dataset.ddGo!);
        goBtn.closest('details')?.removeAttribute('open');
        return;
      }
      const up = t.closest<HTMLElement>('[data-dd-up]');
      if (!up) return;
      // Close the open panel of the ancestor level `n`, which leaves level n as the deepest.
      const n = Number(up.dataset.ddUp);
      let dd = up.closest<HTMLElement>('.dd');
      while (dd && Number(dd.dataset.depth) > n) dd = dd.parentElement?.closest<HTMLElement>('.dd') ?? null;
      if (dd) levels.get(dd)?.set(null);
    });
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.slice(1));
      if (h.startsWith(`${root.id}/`)) go(root, h.slice(root.id.length + 1));
    };
    fromHash();
    addEventListener('hashchange', fromHash);
  });
}
