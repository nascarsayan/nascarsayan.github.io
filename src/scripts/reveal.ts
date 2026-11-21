/**
 * Reveal-on-scroll and count-up. Adds `.is-in` once to [data-reveal],
 * [data-reveal-stagger] (children get --i) and figure.dg (diagram intro), and
 * counts up the numbers inside [data-count] when they appear.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el: HTMLElement) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; parts: (string | number)[]; decimals: number[] }[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? '';
    if (!/\d/.test(text)) continue;
    const parts: (string | number)[] = [];
    const decimals: number[] = [];
    text.split(/(\d+(?:\.\d+)?)/).forEach((p, i) => {
      if (i % 2) { parts.push(Number(p)); decimals.push((p.split('.')[1] ?? '').length); } else parts.push(p);
    });
    nodes.push({ node: n as Text, parts, decimals });
  }
  if (!nodes.length || reduced) return;
  const start = performance.now(), dur = 900;
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    for (const { node, parts, decimals } of nodes) {
      let k = 0;
      node.textContent = parts.map((p) => (typeof p === 'number' ? (p * e).toFixed(decimals[k++]) : p)).join('');
    }
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

let observer: IntersectionObserver | undefined;
export function initReveal() {
  document.documentElement.classList.add('js');
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('is-in');
        if (el.hasAttribute('data-count')) countUp(el);
        el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
        observer!.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );
  document.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((g) => [...g.children].forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i))));
  document.querySelectorAll('[data-reveal], [data-reveal-stagger], figure.dg').forEach((el) => observer!.observe(el));
}
