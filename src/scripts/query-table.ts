/**
 * Browser side of <QueryTable>: the view picker, search, sort, per-column
 * filters and the column chooser. All text goes in through textContent; links
 * must be https. The column choice per view persists in localStorage.
 */
import { cellText, compare, matches, toSql, type Cell, type Column, type Cond, type Row, type View } from '@/lib/query-table';

interface Payload { table: string; rowKey: string; columns: Column[]; views: View[]; rows: Row[] }
interface Item { value: string; label: string; hint?: string; count?: number; selected?: boolean }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * A themed popover list anchored to a button. Fixed-positioned on <body>, so a
 * scrolling table cannot clip it. `multi` keeps it open after a pick.
 */
let openPop: { pop: HTMLElement; anchor: HTMLElement; close: () => void } | null = null;
function popover(anchor: HTMLElement, items: Item[], onPick: (v: string) => void, opts: { multi?: boolean; wide?: boolean } = {}) {
  if (openPop?.anchor === anchor) { openPop.close(); return; }
  openPop?.close();
  const pop = el('div', `qt-pop${opts.wide ? ' qt-pop-wide' : ''}`);
  pop.setAttribute('role', opts.multi ? 'menu' : 'listbox');
  const buttons = items.map((it) => {
    const b = el('button', 'qt-opt');
    b.type = 'button';
    b.setAttribute('role', opts.multi ? 'menuitemcheckbox' : 'option');
    b.setAttribute(opts.multi ? 'aria-checked' : 'aria-selected', String(!!it.selected));
    const main = el('span', 'qt-opt-main');
    main.append(el('span', 'qt-opt-label', it.label));
    if (it.count !== undefined) main.append(el('span', 'qt-opt-count', String(it.count)));
    b.append(el('span', 'qt-opt-mark', '✓'), main);
    if (it.hint) b.append(el('span', 'qt-opt-hint', it.hint));
    b.addEventListener('click', () => {
      onPick(it.value);
      if (opts.multi) b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
      else close();
    });
    return b;
  });
  pop.append(...buttons);
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.minWidth = `${Math.max(r.width, opts.wide ? 440 : 200)}px`;
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.maxHeight = `${Math.max(window.innerHeight - r.bottom - 18, 200)}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  anchor.setAttribute('aria-expanded', 'true');
  const onDoc = (e: Event) => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const onScroll = (e: Event) => { if (!pop.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { close(); anchor.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[Math.min(i + 1, buttons.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[Math.max(i - 1, 0)]?.focus(); }
  };
  function close() {
    pop.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', onScroll, true);
    if (openPop?.pop === pop) openPop = null;
  }
  document.addEventListener('pointerdown', onDoc, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', onScroll, true);
  openPop = { pop, anchor, close };
  (buttons.find((b) => b.getAttribute('aria-selected') === 'true') ?? buttons[0])?.focus({ preventScroll: true });
}

function renderCell(td: HTMLElement, v: Cell | undefined) {
  if (Array.isArray(v)) {
    v.forEach((l, i) => {
      if (i) td.append(', ');
      if (/^https:\/\//.test(l.url)) {
        const a = el('a', undefined, l.label);
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener';
        td.append(a);
      } else td.append(l.label);
    });
  } else {
    td.textContent = cellText(v);
    td.title = td.textContent;
  }
}

function init(root: HTMLElement) {
  const cfgEl = root.querySelector<HTMLScriptElement>('[data-qt-config]');
  if (!cfgEl?.textContent) return;
  const cfg: Payload = JSON.parse(cfgEl.textContent);
  const colByKey = new Map(cfg.columns.map((c) => [c.key, c]));
  const storeKey = `qt:${location.pathname}:${root.dataset.qtRoot}:cols`;
  const savedCols: Record<string, string[]> = JSON.parse(localStorage.getItem(storeKey) || '{}');

  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const picker = $<HTMLButtonElement>('.qt-picker');
  const pickerValue = $<HTMLElement>('.qt-picker-v');
  const question = $<HTMLElement>('.qt-question');
  const sqlEl = $<HTMLElement>('.qt-sql code');
  const search = $<HTMLInputElement>('.qt-search');
  const count = $<HTMLElement>('.qt-count');
  const thead = $<HTMLElement>('thead');
  const tbody = $<HTMLElement>('tbody');
  const colsBtn = $<HTMLButtonElement>('.qt-cols');

  let view: View = cfg.views.find((v) => v.id === new URLSearchParams(location.search).get('view')) ?? cfg.views[0];
  let filters: Record<string, string> = {};
  let sort: [string, 'asc' | 'desc'][] = [];

  const cols = () => savedCols[view.id] ?? view.cols;
  const userConds = (skip?: string): Cond[] => Object.entries(filters).filter(([k, v]) => v !== '' && k !== skip).map(([col, v]) =>
    colByKey.get(col)?.kind === 'enum' ? { col, op: '=', value: v } : { col, op: 'like', value: v });
  const viewRows = (conds: Cond[]) => cfg.rows.filter((r) => conds.every((c) => matches(r, c)));

  function renderHead() {
    const names = el('tr');
    const inputs = el('tr', 'qt-filters');
    for (const key of cols()) {
      const c = colByKey.get(key)!;
      const th = el('th');
      const b = el('button', 'qt-sort', c.label);
      b.type = 'button';
      b.title = 'Sort';
      const s = sort.find(([k]) => k === key);
      if (s) b.dataset.dir = s[1];
      b.addEventListener('click', () => {
        sort = !s ? [[key, 'asc']] : s[1] === 'asc' ? [[key, 'desc']] : [];
        render();
      });
      if (c.width) th.style.minWidth = `${c.width}ch`;
      th.append(b);
      names.append(th);
      const fth = el('th');
      if (c.kind === 'enum') {
        const f = el('button', 'qt-fsel');
        f.type = 'button';
        f.setAttribute('aria-haspopup', 'listbox');
        f.setAttribute('aria-expanded', 'false');
        f.setAttribute('aria-label', `Filter ${c.label}`);
        f.append(el('span', 'qt-fsel-v', filters[key] || 'All'), el('span', 'qt-chev'));
        if (filters[key]) f.classList.add('is-set');
        f.addEventListener('click', () => {
          const m = new Map<string, number>();
          for (const r of viewRows([...(view.where ?? []), ...userConds(key)])) m.set(cellText(r[key]), (m.get(cellText(r[key])) ?? 0) + 1);
          popover(f, [{ value: '', label: 'All', selected: !filters[key] },
            ...[...m].sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ value: v, label: v || '(empty)', count: n, selected: filters[key] === v }))],
            (v) => { filters[key] = v; render(); });
        });
        fth.append(f);
      } else {
        const inp = el('input', 'qt-ftext');
        inp.type = 'search';
        inp.placeholder = 'Filter';
        inp.setAttribute('aria-label', `Filter ${c.label}`);
        inp.value = filters[key] ?? '';
        inp.addEventListener('input', () => { filters[key] = inp.value; renderBody(); });
        fth.append(inp);
      }
      inputs.append(fth);
    }
    thead.replaceChildren(names, inputs);
  }

  function renderBody() {
    const conds = [...(view.where ?? []), ...userConds()];
    const q = search.value.trim();
    let rows = viewRows(conds);
    if (q) rows = rows.filter((r) => cfg.columns.some((c) => cellText(r[c.key]).toLowerCase().includes(q.toLowerCase())));
    const order = sort.length ? sort : view.order ?? [];
    rows.sort((a, b) => {
      for (const [c, d] of order) {
        const x = compare(a[c], b[c]);
        if (x) return d === 'asc' ? x : -x;
      }
      return 0;
    });
    sqlEl.textContent = toSql(cfg.table, cols(), conds, order, q ? [`ANY_COLUMN LIKE '%${q.replace(/'/g, "''")}%'`] : []);
    count.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
    tbody.replaceChildren(...rows.map((r) => {
      const tr = el('tr');
      for (const key of cols()) {
        const td = el('td');
        renderCell(td, r[key]);
        tr.append(td);
      }
      return tr;
    }));
    if (!rows.length) {
      const tr = el('tr');
      const td = el('td', 'qt-empty', 'No rows match.');
      td.colSpan = cols().length;
      tr.append(td);
      tbody.append(tr);
    }
  }

  function render() {
    pickerValue.textContent = view.title;
    question.textContent = view.question;
    renderHead();
    renderBody();
  }

  picker.addEventListener('click', () => popover(picker,
    cfg.views.map((v) => ({ value: v.id, label: v.title, hint: v.question, selected: v.id === view.id })),
    (id) => {
      view = cfg.views.find((v) => v.id === id)!;
      filters = {};
      sort = [];
      search.value = '';
      const url = new URL(location.href);
      url.searchParams.set('view', id);
      history.replaceState(null, '', url);
      render();
    }, { wide: true }));
  colsBtn.addEventListener('click', () => popover(colsBtn,
    cfg.columns.map((c) => ({ value: c.key, label: c.label, selected: cols().includes(c.key) })),
    (key) => {
      const on = !cols().includes(key);
      savedCols[view.id] = cfg.columns.map((x) => x.key).filter((k) => (k === key ? on : cols().includes(k)));
      localStorage.setItem(storeKey, JSON.stringify(savedCols));
      render();
    }, { multi: true }));
  search.addEventListener('input', renderBody);
  render();
}

export function initQueryTables() {
  document.querySelectorAll<HTMLElement>('[data-qt-root]').forEach(init);
}
