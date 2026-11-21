/**
 * Every route on the site: articles (listed on Pages, the home page) and
 * standalone apps (listed on Apps).
 *
 * - Articles: `src/pages/<slug>/index.mdx` with `layout: ../../layouts/ArticleLayout.astro`.
 *   Frontmatter gives title, description and updated; nothing else to register.
 * - Standalone apps: static pages outside this build (e.g. under `public/<slug>/`),
 *   listed in `STANDALONE`. None today.
 */
export interface SiteRoute {
  slug: string;
  title: string;
  description: string;
  kind: 'article' | 'standalone';
  /** Last meaningful update, YYYY-MM-DD. */
  updated: string;
  /** Articles: estimated reading time in minutes (from the MDX text, ~220 words per minute). */
  readMin?: number;
}

const STANDALONE: SiteRoute[] = [];

interface ArticleFrontmatter { title?: unknown; description?: unknown; updated?: unknown }
import { readMinutes } from '@/lib/read-time';
const articles = import.meta.glob<{ frontmatter: ArticleFrontmatter }>('/src/pages/*/index.mdx', { eager: true });
const sources = import.meta.glob<string>('/src/pages/*/index.mdx', { query: '?raw', import: 'default', eager: true });


function articleRoutes(): SiteRoute[] {
  return Object.entries(articles).map(([path, mod]) => {
    const slug = path.split('/').at(-2)!;
    const fm = mod.frontmatter;
    const fail = (msg: string) => { throw new Error(`${path}: ${msg}`); };
    if (typeof fm.title !== 'string') fail('title is required');
    if (typeof fm.description !== 'string') fail('description is required');
    if (typeof fm.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fm.updated)) fail('updated must be "YYYY-MM-DD"');
    return { slug, title: fm.title as string, description: fm.description as string, kind: 'article', updated: fm.updated as string, readMin: readMinutes(sources[path] ?? '') };
  });
}

export const ROUTES: SiteRoute[] = [...articleRoutes(), ...STANDALONE];

const slugs = new Set<string>();
for (const r of ROUTES) {
  if (slugs.has(r.slug)) throw new Error(`duplicate route ${r.slug}`);
  slugs.add(r.slug);
}

export const routeHref = (r: SiteRoute) => `/${r.slug}/`;
