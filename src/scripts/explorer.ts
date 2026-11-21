/**
 * Browser side of <Explorer> (see src/lib/explorer.ts). Query values are only
 * ever compared against the configured allowlist.
 */
import { effective, matchVariant, type ExplorerConfig, type Selection } from '@/lib/explorer-core';
import { initDiagrams } from '@/scripts/diagram-player';
import { initReveal } from '@/scripts/reveal';

function setup(root: HTMLElement) {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const ex: ExplorerConfig = JSON.parse(root.querySelector('[data-sx-config]')!.textContent || '{}');
  const controls = root.querySelector<HTMLElement>('.sx-controls')!;
  const variants = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('.sx-variant').forEach((el) => variants.set(el.dataset.variant!, el));
  // Variants not shown at first arrive as <template>s (see Explorer.astro).
  const templates = new Map<string, HTMLTemplateElement>();
  root.querySelectorAll<HTMLTemplateElement>('template[data-sx-tpl]').forEach((t) => templates.set(t.dataset.sxTpl!, t));
  /** Brings a variant to life the first time it is picked. */
  const materialize = (id: string) => {
    const t = templates.get(id);
    if (!t) return;
    const el = t.content.firstElementChild!.cloneNode(true) as HTMLElement;
    t.replaceWith(el);
    templates.delete(id);
    variants.set(id, el);
    initDiagrams(); // set up its diagram (the others are already set up)
    initReveal(); // and its intro when it scrolls in
  };

  const q = new URLSearchParams(location.search);
  let sel: Selection = {};
  for (const o of ex.options) {
    const v = q.get(o.key);
    if (v !== null) sel[o.key] = v;
  }

  const render = (push: boolean) => {
    sel = effective(ex, sel);
    for (const o of ex.options) {
      const row = controls.querySelector<HTMLElement>(`[data-sx-row="${o.key}"]`)!;
      row.hidden = !(o.key in sel);
      row.querySelectorAll<HTMLButtonElement>('button[data-sx-value]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.sxValue === sel[o.key])),
      );
    }
    const shown = matchVariant(ex, sel)?.figure;
    if (shown) materialize(shown);
    variants.forEach((el, id) => { el.hidden = id !== shown; });
    if (push) {
      const u = new URLSearchParams(location.search);
      for (const o of ex.options) o.key in sel ? u.set(o.key, sel[o.key]) : u.delete(o.key);
      history.replaceState(null, '', `${location.pathname}?${u}${location.hash}`);
    }
  };

  controls.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.sxCopy !== undefined) {
      const url = new URL(location.href);
      url.hash = ex.section;
      const msg = controls.querySelector<HTMLElement>('[data-sx-msg]')!;
      navigator.clipboard?.writeText(url.toString()).then(
        () => { msg.textContent = 'Copied'; },
        () => { msg.textContent = url.toString(); },
      );
      return;
    }
    if (b.dataset.sxKey && b.dataset.sxValue) {
      sel = { ...sel, [b.dataset.sxKey]: b.dataset.sxValue };
      render(true);
    }
  });
  render(false);
  initDiagrams();
  requestAnimationFrame(() => { controls.dataset.ready = ''; });
}

export function initExplorers() {
  document.querySelectorAll<HTMLElement>('[data-sx-root]').forEach(setup);
}
