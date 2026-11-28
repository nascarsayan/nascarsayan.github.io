/**
 * Glossary terms (src/config/glossary.ts). On load, the first use of each term
 * in the article text (.prose) becomes <span class="term" tabindex="0">; hover
 * (after a short delay) or focus it to see the definition card: the definition,
 * its further-reading links, and the full glossary (links open in a new tab). Escape or leaving the term closes it.
 *
 * Only running text is scanned: headings, links, code, diagrams, explorer
 * controls, buttons and comment UI are skipped. Matching is case-sensitive, on
 * whole words (not inside kube-vip or --vip).
 */
import { GLOSSARY, type GlossaryEntry } from '@/config/glossary';
import { url } from '@/lib/base';

const SKIP = 'h1, h2, h3, h4, h5, h6, a, code, pre, kbd, figure, button, .sx-controls, .qt, .term, .cm-mark, .cm, script, style';
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byId = new Map(GLOSSARY.map((e) => [e.id, e]));
const matchers = GLOSSARY.map((entry) => ({
  entry,
  re: new RegExp(`(?<![\\w/-])(?:${[entry.term, ...(entry.aliases ?? [])].map(escapeRe).join('|')})(?![\\w-])`),
}));

/** Wraps the first use of each glossary term in the page's article text. */
function markTerms() {
  const prose = document.querySelector<HTMLElement>('.prose');
  if (!prose) return;
  const seen = new Set<string>();
  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (let node of texts) {
    for (;;) {
      if (seen.size === matchers.length) return;
      // The earliest match in this text node of a term not yet marked.
      let best: { at: number; len: number; entry: GlossaryEntry } | undefined;
      for (const { entry, re } of matchers) {
        if (seen.has(entry.id)) continue;
        const m = re.exec(node.data);
        if (m && (!best || m.index < best.at)) best = { at: m.index, len: m[0].length, entry };
      }
      if (!best) break;
      seen.add(best.entry.id);
      const word = node.splitText(best.at);
      const rest = word.splitText(best.len);
      const span = document.createElement('span');
      span.className = 'term';
      span.tabIndex = 0;
      span.dataset.term = best.entry.id;
      span.dataset.name = best.entry.term;
      span.dataset.def = best.entry.definition;
      word.replaceWith(span);
      span.append(word);
      node = rest; // keep looking in the text after the term
    }
  }
}
let card: HTMLElement | undefined;
let showT = 0, hideT = 0;
let current: HTMLElement | null = null;

function ensureCard() {
  if (card) return card;
  card = document.createElement('div');
  card.className = 'term-card';
  card.setAttribute('role', 'tooltip');
  card.id = 'term-card';
  card.hidden = true;
  card.addEventListener('pointerenter', () => { clearTimeout(hideT); clearTimeout(showT); }); // keep this card, even if the pointer crossed another term on the way
  card.addEventListener('pointerleave', () => hide(350));
  document.body.append(card);
  return card;
}

function show(t: HTMLElement) {
  const c = ensureCard();
  clearTimeout(hideT);
  current = t;
  c.replaceChildren();
  const name = document.createElement('div');
  name.className = 'term-card-name';
  name.textContent = t.dataset.name ?? t.textContent ?? '';
  const def = document.createElement('p');
  def.className = 'term-card-def';
  def.textContent = t.dataset.def ?? '';
  const links = document.createElement('div');
  links.className = 'term-card-links';
  for (const l of byId.get(t.dataset.term ?? '')?.links ?? []) {
    const a = document.createElement('a');
    a.href = url(l.href);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = l.label;
    links.append(a);
  }
  const more = document.createElement('a');
  more.className = 'term-card-more';
  more.href = url(`/glossary/#${t.dataset.term}`);
  more.target = '_blank';
  more.rel = 'noopener';
  more.textContent = 'All definitions ↗';
  c.append(name, def, ...(links.childElementCount ? [links] : []), more);
  c.hidden = false;
  t.setAttribute('aria-describedby', c.id);
  // Below the term, or above it when there is no room; kept inside the window.
  const r = t.getBoundingClientRect();
  const w = Math.min(340, innerWidth - 24);
  c.style.width = `${w}px`;
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const h = c.offsetHeight;
  const top = r.bottom + 8 + h < innerHeight ? r.bottom + 8 : r.top - 8 - h;
  c.style.left = `${left + scrollX}px`;
  c.style.top = `${top + scrollY}px`;
  requestAnimationFrame(() => c.classList.add('is-on'));
}

function hide(delay = 0) {
  clearTimeout(showT);
  clearTimeout(hideT);
  hideT = window.setTimeout(() => {
    if (!card) return;
    card.classList.remove('is-on');
    card.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  }, delay);
}

let wired = false;
export function initTerms() {
  if (wired) return;
  wired = true;
  markTerms();
  const termOf = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('.term') : null);
  document.addEventListener('pointerover', (e) => {
    const t = termOf(e);
    if (!t || t === current) return;
    clearTimeout(showT);
    showT = window.setTimeout(() => show(t), 350);
  });
  document.addEventListener('pointerout', (e) => {
    const t = termOf(e);
    if (t && !(e.relatedTarget instanceof Node && (t.contains(e.relatedTarget) || card?.contains(e.relatedTarget)))) hide(350); // time to reach the card
  });
  document.addEventListener('focusin', (e) => { const t = termOf(e); if (t) show(t); });
  document.addEventListener('focusout', (e) => { if (termOf(e)) hide(150); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) hide(); });
}
