/**
 * Zoom and pan for <Diagram zoom>: the SVG sits in a scrollable viewport and is
 * drawn at `--z` times its natural size. Buttons (bottom right): out, in, fit
 * to width, 1:1. Drag to pan; Ctrl/⌘ + wheel zooms around the pointer; keys
 * + − 0 1 while the viewport has focus. Starts at fit-to-width (never above 1:1),
 * so it never scrolls sideways at first; zoom in for detail.
 */
const MIN = 0.2, MAX = 3, STEP = 1.25;

export function initZoom() {
  for (const vp of document.querySelectorAll<HTMLElement>('[data-zoom]')) {
    if (vp.dataset.zoomReady) continue;
    vp.dataset.zoomReady = '1';
    const fitEl = vp.querySelector<HTMLElement>('.dg-fit');
    const wrap = vp.parentElement!;
    const val = wrap.querySelector<HTMLElement>('.dg-zoom-val');
    if (!fitEl) continue;
    const w = Number(getComputedStyle(fitEl).getPropertyValue('--w')) || 1000;
    let z = 1;
    const fitZ = () => Math.max(MIN, Math.min(MAX, (vp.clientWidth - 8) / w));
    // Zoom keeping the point (cx, cy) of the viewport fixed.
    const set = (nz: number, cx = vp.clientWidth / 2, cy = vp.clientHeight / 2) => {
      nz = Math.max(MIN, Math.min(MAX, nz));
      const px = (vp.scrollLeft + cx) / z, py = (vp.scrollTop + cy) / z;
      z = nz;
      fitEl.style.setProperty('--z', String(z));
      vp.scrollLeft = px * z - cx;
      vp.scrollTop = py * z - cy;
      if (val) val.textContent = `${Math.round(z * 100)}%`;
    };
    set(Math.min(1, fitZ()));
    vp.scrollTo({ left: (vp.scrollWidth - vp.clientWidth) / 2, top: 0 });
    wrap.querySelectorAll<HTMLButtonElement>('[data-zoom-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.zoomAct;
      if (a === 'in') set(z * STEP);
      else if (a === 'out') set(z / STEP);
      else if (a === 'fit') { set(fitZ()); vp.scrollTo({ left: 0, top: 0 }); }
      else if (a === 'one') set(1);
    }));
    vp.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      set(z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    vp.addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') set(z * STEP);
      else if (e.key === '-') set(z / STEP);
      else if (e.key === '0') set(fitZ());
      else if (e.key === '1') set(1);
      else return;
      e.preventDefault();
    });
    // Drag to pan (not on links or boxes that open pages: those still click).
    let sx = 0, sy = 0, sl = 0, st = 0, moved = false, down = false;
    vp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY; sl = vp.scrollLeft; st = vp.scrollTop;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true; vp.classList.add('is-panning');
      vp.scrollLeft = sl - dx; vp.scrollTop = st - dy;
    });
    addEventListener('pointerup', () => { down = false; vp.classList.remove('is-panning'); });
    // A drag must not count as a click on a box.
    vp.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  }
}
