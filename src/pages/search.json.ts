/**
 * Site-wide search index, built at build time: one entry per article section
 * (title, heading, text), diagram labels per article, About, and every
 * standalone app. The header search dialog fetches it on first use.
 */
import type { APIRoute } from 'astro';
import { ROUTES } from '@/config/routes';

/** Written to dist/search.json at build time (the site is fully static). */
export const prerender = true;

interface Heading { depth: number; slug: string; text: string }
interface Entry { u: string; t: string; s: string; x: string }

const mods = import.meta.glob<{ frontmatter: { title: string }; getHeadings: () => Heading[] }>(['/src/pages/*/index.mdx', '/src/pages/learn/*/index.mdx', '/src/pages/index.mdx'], { eager: true });
const raws = import.meta.glob<string>(['/src/pages/*/index.mdx', '/src/pages/learn/*/index.mdx', '/src/pages/index.mdx'], { eager: true, query: '?raw', import: 'default' });
const diagrams = import.meta.glob<Record<string, unknown>>(['/src/pages/*/_*.diagram.ts', '/src/pages/learn/*/_*.diagram.ts'], { eager: true });

const urlOf = (path: string) => (path === '/src/pages/index.mdx' ? '/' : path.startsWith('/src/pages/learn/') ? `/learn/${path.split('/').at(-2)}/` : `/${path.split('/').at(-2)}/`);

/** MDX/Markdown source -> plain text, keeping component string props like title="…". */
function plain(src: string): string {
  return src
    .replace(/^---[\s\S]*?\n---\n/, '')
    .replace(/^(import|export) .*$/gm, '')
    .replace(/\b(?:title|caption|label|when)="([^"]*)"/g, ' $1 ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>|#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diagramText(spec: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'string' && ['label', 'detail', 'tag', 'info'].includes(k)) out.push(x);
        else walk(x);
      }
  };
  walk(spec);
  return out.join(' · ');
}

export const GET: APIRoute = () => {
  const entries: Entry[] = [];
  for (const [path, raw] of Object.entries(raws)) {
    const mod = mods[path];
    const url = urlOf(path);
    const title = mod.frontmatter.title;
    const heads = mod.getHeadings().filter((h) => h.depth === 2 || h.depth === 3);
    const parts = raw.replace(/^---[\s\S]*?\n---\n/, '').split(/^#{2,3} .*$/m);
    entries.push({ u: url, t: title, s: '', x: plain(parts[0]).slice(0, 3000) });
    parts.slice(1).forEach((p, i) => {
      const h = heads[i];
      if (h) entries.push({ u: `${url}#${h.slug}`, t: title, s: h.text, x: plain(p).slice(0, 3000) });
    });
  }
  const byPage = new Map<string, string[]>();
  for (const [path, mod] of Object.entries(diagrams)) {
    const url = urlOf(path);
    byPage.set(url, [...(byPage.get(url) ?? []), ...Object.values(mod).map(diagramText)]);
  }
  for (const [url, texts] of byPage) {
    const title = entries.find((e) => e.u === url)?.t ?? url;
    entries.push({ u: url, t: title, s: 'Diagrams', x: texts.join(' · ').slice(0, 4000) });
  }
  for (const r of ROUTES.filter((r) => r.kind === 'standalone')) entries.push({ u: `/${r.slug}/`, t: r.title, s: 'App', x: r.description });
  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json' } });
};
