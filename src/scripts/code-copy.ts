/**
 * A copy button on every Shiki code block in prose. The block is wrapped in a
 * positioned box so the button stays put while the code scrolls sideways.
 * Copies the block's text (no line numbers or markup).
 */
const COPY = '<svg class="i-copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
const DONE = '<svg class="i-done" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export function initCodeCopy(): void {
  document.querySelectorAll<HTMLPreElement>('.prose pre.astro-code').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.append(pre);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.title = 'Copy';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = COPY + DONE; // static markup only, no page text
    let timer = 0;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ''));
        btn.classList.add('is-done');
        btn.title = 'Copied';
        clearTimeout(timer);
        timer = window.setTimeout(() => { btn.classList.remove('is-done'); btn.title = 'Copy'; }, 1500);
      } catch { btn.title = 'Copy failed'; }
    });
    wrap.append(btn);
  });
}
