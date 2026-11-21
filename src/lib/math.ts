/**
 * Math in Markdown/MDX: Sätteri parses `$…$` (inline) and `$$…$$` (display)
 * when `features.math` is on; this plugin renders each with KaTeX at build time:
 * HTML drawn with KaTeX's fonts (katex.min.css, imported by ArticleLayout) plus a
 * hidden MathML copy for screen readers. No client JS. Native MathML alone was
 * dropped: it shows empty boxes on machines without a math font. A LaTeX error
 * fails the build (throwOnError) with the formula.
 */
import katex from 'katex';
import { defineMdastPlugin } from 'satteri';

const render = (tex: string, displayMode: boolean) => {
  try {
    return katex.renderToString(tex, { displayMode, output: 'htmlAndMathml', throwOnError: true, strict: 'error' });
  } catch (e) {
    throw new Error(`math: cannot render ${displayMode ? '$$' : '$'}${tex}${displayMode ? '$$' : '$'}: ${(e as Error).message}`);
  }
};

export const mathPlugin = defineMdastPlugin({
  name: 'site-math',
  math: (node) => ({ raw: `<div class="math-display">${render(node.value, true)}</div>`, mdxExpressions: false }),
  inlineMath: (node) => ({ raw: render(node.value, false), mdxExpressions: false }),
});
