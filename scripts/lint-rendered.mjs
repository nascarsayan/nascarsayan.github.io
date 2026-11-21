/**
 * After a build: fail if any page shows an MDX expression as text, e.g.
 * "{m.held.join(' and ')}" where the value should be. That happens when MDX treats a
 * paragraph as plain Markdown (see the fix in the page, usually a blank line or
 * indentation inside a component). Only visible text is checked: <code>, <pre>,
 * <script>, <style>, <template>, attributes and KaTeX math are skipped.
 *
 *   node scripts/lint-rendered.mjs <outDir>
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : f.endsWith('.html') && files.push(p); } };
walk(dir);

// A JS-looking expression: {name}, {a.b}, {a.b(…)}, {a[0].b}, {fn(…)} — not prose in braces.
const EXPR = /\{\s*[A-Za-z_$][\w$]*(?:\s*(?:\.[A-Za-z_$][\w$]*|\[[^\]{}]{0,20}\]|\([^(){}]{0,60}\)))*\s*\}/g;
const bad = [];
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  s = s.replace(/<(script|style|template|code|pre|textarea)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<span class="katex[\s\S]*?<\/span><\/span><\/span>/g, ' ')
    .replace(/<math[\s\S]*?<\/math>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const m of s.matchAll(EXPR)) {
    // Prose like "{block size}" (a space between words) is not an expression.
    if (/^\{\s*[A-Za-z]+\s+[A-Za-z]/.test(m[0])) continue;
    bad.push(`${relative(dir, f)}: ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
  }
}
if (bad.length) {
  console.error(`Unrendered MDX expressions (${bad.length}); the page shows the code instead of its value:\n${bad.map((b) => `  ${b}`).join('\n')}\nUsually a paragraph inside a component that MDX read as plain text: check its indentation and blank lines.`);
  process.exit(1);
}
console.log(`lint-rendered: ${files.length} pages, no unrendered expressions`);
