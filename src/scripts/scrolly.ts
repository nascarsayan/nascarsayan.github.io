/**
 * <Scrolly>: the chapter nearest the middle of the chapter list (its own scroll box) is
 * active and drives the diagram. Page scrolling does not change the step. Clicking a
 * chapter scrolls the list to it.
 */
export function initScrolly() {
  document.querySelectorAll<HTMLElement>('[data-scrolly]').forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = '1';
    const list = root.querySelector<HTMLElement>('.chapters');
    const chapters = [...root.querySelectorAll<HTMLElement>('.chapter')];
    const fig = root.querySelector<HTMLElement>('figure.dg');
    const count = root.querySelector<HTMLElement>('.count');
    if (!list || !fig || !chapters.length) return;
    let active = -1, raf = 0;
    const update = () => {
      raf = 0;
      const box = list.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      let best = 0, bestD = Infinity;
      chapters.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0;
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === active) return;
      active = best;
      chapters.forEach((c, i) => c.classList.toggle('is-active', i === best));
      if (count) count.textContent = `· ${best + 1} / ${chapters.length}`;
      fig.dispatchEvent(new CustomEvent('dg:go', { detail: best }));
    };
    const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    const go = (i: number) => {
      const c = chapters[Math.max(0, Math.min(chapters.length - 1, i))];
      list.scrollTo({ top: c.offsetTop - (list.clientHeight - c.offsetHeight) / 2, behavior: smooth() });
    };
    list.addEventListener('scroll', () => { raf ||= requestAnimationFrame(update); }, { passive: true });
    list.addEventListener('click', (e) => { const c = (e.target as Element).closest<HTMLElement>('.chapter'); if (c && !(e.target as Element).closest('a')) go(chapters.indexOf(c)); });
    list.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      go(active + d);
    });
    new ResizeObserver(() => update()).observe(list);
    // The diagram player attaches its listener on init; run after it.
    requestAnimationFrame(update);
  });
}
