/**
 * Tall sequence diagrams (<Diagram> wraps them in .dg-seqvp): a fixed-height
 * scroll frame with the participant cards pinned on top, and auto-follow.
 *
 * - Header: a clone of the scene cropped to the card row (viewBox 0 0 W head),
 *   lifelines, messages and frames removed, ids stripped so the player never
 *   binds to it. Sticky at the top of the frame.
 * - Follow: when the player focuses a message (class is-focus on a .dg-edge),
 *   the frame scrolls it to about a third of the way down, unless the reader
 *   scrolled by hand in the last few seconds.
 */
const IDLE_MS = 3500;

export function initSeqScroll() {
  for (const vp of document.querySelectorAll<HTMLElement>('.dg-seqvp')) {
    if (vp.dataset.seqReady) continue;
    vp.dataset.seqReady = '1';
    const svg = vp.querySelector<SVGSVGElement>('svg.dg-scene');
    if (!svg) continue;
    const head = Number(vp.dataset.seqHead) || 60;
    const [, , w] = (svg.getAttribute('viewBox') ?? '0 0 1000 1000').split(/\s+/).map(Number);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('.dg-edge, .dg-elabel, .dg-lifeline, .dg-group, .dg-packet, desc').forEach((n) => n.remove());
    clone.querySelectorAll('[data-el]').forEach((n) => n.removeAttribute('data-el'));
    clone.setAttribute('viewBox', `0 0 ${w} ${head}`);
    clone.removeAttribute('role');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('dg-seqhead-svg');
    const bar = document.createElement('div');
    bar.className = 'dg-seqhead';
    bar.append(clone);
    const fit = vp.querySelector<HTMLElement>('.dg-fit')!;
    bar.style.setProperty('--w', String(w));
    bar.style.setProperty('--hh', String(head));
    // Same width as the scene so the cards line up with their lifelines.
    const sync = () => {
      bar.style.width = `${fit.getBoundingClientRect().width}px`;
      // Pull the scene up under the pinned header so its own card row sits exactly beneath it.
      vp.style.setProperty('--seq-head-px', `${bar.getBoundingClientRect().height}px`);
    };
    vp.prepend(bar);
    sync();
    new ResizeObserver(sync).observe(fit);

    let manualUntil = 0, auto = false;
    vp.addEventListener('scroll', () => { if (!auto) manualUntil = performance.now() + IDLE_MS; }, { passive: true });
    const follow = (el: Element) => {
      if (performance.now() < manualUntil) return;
      const vr = vp.getBoundingClientRect(), er = el.getBoundingClientRect();
      const target = vp.scrollTop + (er.top - vr.top) - vp.clientHeight / 3;
      auto = true;
      vp.scrollTo({ top: Math.max(0, target), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setTimeout(() => { auto = false; }, 600);
    };
    new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target as Element;
        if (el.classList.contains('dg-edge') && el.classList.contains('is-focus')) { follow(el); return; }
      }
    }).observe(svg, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}
