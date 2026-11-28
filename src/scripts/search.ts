/** Client side of the header search (see Search.astro). */
import { url } from '@/lib/base';

interface Entry { u: string; t: string; s: string; x: string }

let index: Promise<Entry[]> | undefined;
const load = () => (index ??= fetch(url('/search.json')).then((r) => (r.ok ? r.json() : [])).catch(() => []));

function score(e: Entry, terms: string[]): number {
  const t = e.t.toLowerCase(), s = e.s.toLowerCase(), x = e.x.toLowerCase();
  let total = 0;
  for (const term of terms) {
    const hit = (t.includes(term) ? 6 : 0) + (s.includes(term) ? 4 : 0) + (x.includes(term) ? 1 : 0);
    if (!hit) return 0;
    total += hit;
  }
  return total;
}

/** Text with every term wrapped in <mark>, built as DOM nodes. */
function highlighted(text: string, terms: string[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    let next = -1, len = 0;
    for (const term of terms) {
      const at = lower.indexOf(term, i);
      if (at >= 0 && (next < 0 || at < next)) { next = at; len = term.length; }
    }
    if (next < 0) { frag.append(text.slice(i)); break; }
    frag.append(text.slice(i, next));
    const m = document.createElement('mark');
    m.textContent = text.slice(next, next + len);
    frag.append(m);
    i = next + len;
  }
  return frag;
}

function snippet(x: string, terms: string[]): string {
  const lower = x.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return x.slice(0, 140);
  const start = Math.max(0, at - 50);
  return (start ? '…' : '') + x.slice(start, start + 160) + (start + 160 < x.length ? '…' : '');
}

export function initSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-search]');
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const list = document.querySelector<HTMLOListElement>('[data-search-results]');
  const empty = document.querySelector<HTMLElement>('[data-search-empty]');
  if (!dialog || !input || !list || !empty || dialog.dataset.ready) return;
  dialog.dataset.ready = '1';
  let active = 0;

  const open = () => { if (!dialog.open) { dialog.showModal(); input.select(); load(); } };
  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  const select = (i: number) => {
    const items = [...list.querySelectorAll('a')];
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((a, k) => a.setAttribute('aria-selected', String(k === active)));
    items[active].scrollIntoView({ block: 'nearest' });
  };

  const run = async () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    list.replaceChildren();
    if (!terms.length) { empty.hidden = true; return; }
    const results = (await load())
      .map((e) => ({ e, s: score(e, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20);
    empty.hidden = results.length > 0;
    for (const { e } of results) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url(e.u);
      // Standalone apps have no way back to the site: new tab.
      if (e.s === 'App') { a.target = '_blank'; a.rel = 'noopener'; }
      a.setAttribute('role', 'option');
      const title = document.createElement('span');
      title.className = 'r-title';
      title.append(highlighted(e.t, terms));
      if (e.s) {
        const sec = document.createElement('span');
        sec.className = 'r-section';
        sec.append(' › ', highlighted(e.s, terms));
        title.append(sec);
      }
      const snip = document.createElement('span');
      snip.className = 'r-snippet';
      snip.append(highlighted(snippet(e.x, terms), terms));
      a.append(title, snip);
      a.addEventListener('click', () => dialog.close());
      li.append(a);
      list.append(li);
    }
    select(0);
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
    else if (e.key === 'Enter') {
      const a = list.querySelectorAll('a')[active];
      if (a) { e.preventDefault(); dialog.close(); if (a.target === '_blank') open(a.href, '_blank', 'noopener'); else location.href = a.href; }
    }
  });
}
