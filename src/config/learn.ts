/**
 * Learn: short topic pages under `src/pages/learn/<slug>/index.mdx`, joined
 * into a DAG by frontmatter.
 *
 *   track:    one of TRACKS (groups pages on /learn/ and colours the DAG)
 *   requires: slugs this page builds on (leaf) or combines (hub)
 *   hub:      true for an overview page that ties its `requires` together
 *
 * Build fails on an unknown slug, an unknown track or a cycle.
 */
export const TRACKS = [
  { id: 'silicon', label: 'Kernels & silicon', tone: 'lime' },
  { id: 'fundamentals', label: 'GPU fundamentals', tone: 'sky' },
  { id: 'inference', label: 'LLM inference', tone: 'pink' },
  { id: 'kubernetes', label: 'GPUs in Kubernetes', tone: 'primary' },
  { id: 'operations', label: 'Operating GPU nodes', tone: 'teal' },
  { id: 'platforms', label: 'GPU platforms', tone: 'peach' },
] as const;
export type TrackId = (typeof TRACKS)[number]['id'];

export interface LearnPage {
  slug: string;
  title: string;
  /** Short name for DAG boxes and chips. */
  short: string;
  description: string;
  updated: string;
  track: TrackId;
  hub: boolean;
  requires: string[];
  order: number;
}

interface Fm { title?: unknown; short?: unknown; description?: unknown; updated?: unknown; track?: unknown; hub?: unknown; requires?: unknown; order?: unknown }
// Frontmatter is read from the raw source, not by importing the pages: the
// pages' layout imports this module, and importing them back made a cycle that
// broke the dev server on hot reload.
const raws = import.meta.glob<string>('/src/pages/learn/*/index.mdx', { eager: true, query: '?raw', import: 'default' });

/** The single-line keys this module needs: "strings", bare words, numbers, true/false, [a, b] lists. */
function frontmatter(src: string): Fm {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)?.[1] ?? '';
  const out: Record<string, unknown> = {};
  for (const line of block.split(/\r?\n/)) {
    const m = /^(title|short|description|updated|track|hub|requires|order):\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const v = m[2];
    if (/^".*"$/.test(v)) out[m[1]] = JSON.parse(v);
    else if (/^'.*'$/.test(v)) out[m[1]] = v.slice(1, -1).replace(/''/g, "'");
    else if (/^\[.*\]$/.test(v)) out[m[1]] = v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
    else if (v === 'true' || v === 'false') out[m[1]] = v === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(v)) out[m[1]] = Number(v);
    else out[m[1]] = v;
  }
  return out as Fm;
}

function load(): LearnPage[] {
  const trackIds = new Set<string>(TRACKS.map((t) => t.id));
  const pages = Object.entries(raws).map(([path, raw]) => {
    const fm = frontmatter(raw);
    const fail = (msg: string): never => { throw new Error(`${path}: ${msg}`); };
    const slug = path.split('/').at(-2)!;
    if (typeof fm.title !== 'string') fail('title is required');
    if (typeof fm.short !== 'string' || fm.short.length > 32) fail('short is required (max 32 chars)');
    if (typeof fm.description !== 'string') fail('description is required');
    if (typeof fm.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fm.updated)) fail('updated must be "YYYY-MM-DD"');
    if (typeof fm.track !== 'string' || !trackIds.has(fm.track)) fail(`track must be one of ${[...trackIds].join(', ')}`);
    const requires = fm.requires ?? [];
    if (!Array.isArray(requires) || requires.some((r) => typeof r !== 'string')) fail('requires must be a list of slugs');
    return {
      slug, title: fm.title as string, short: fm.short as string, description: fm.description as string,
      updated: fm.updated as string, track: fm.track as TrackId, hub: fm.hub === true,
      requires: requires as string[], order: typeof fm.order === 'number' ? fm.order : 99,
    };
  });
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) for (const r of p.requires) if (!bySlug.has(r)) throw new Error(`learn/${p.slug}: requires unknown page "${r}"`);
  // Cycle check (DFS, colours).
  const state = new Map<string, 1 | 2>();
  const visit = (s: string, trail: string[]) => {
    if (state.get(s) === 2) return;
    if (state.get(s) === 1) throw new Error(`learn: cycle ${[...trail, s].join(' -> ')}`);
    state.set(s, 1);
    for (const r of bySlug.get(s)!.requires) visit(r, [...trail, s]);
    state.set(s, 2);
  };
  for (const p of pages) visit(p.slug, []);
  return pages.sort((a, b) => TRACKS.findIndex((t) => t.id === a.track) - TRACKS.findIndex((t) => t.id === b.track) || a.order - b.order);
}

export const LEARN: LearnPage[] = load();
export const learnHref = (slug: string) => `/learn/${slug}/`;
export const learnPage = (slug: string) => LEARN.find((p) => p.slug === slug);
/** Pages that list `slug` in their requires. */
export const dependents = (slug: string) => LEARN.filter((p) => p.requires.includes(slug));

/** Parents: pages built (partly) from `slug`, i.e. that list it in `requires`. */
export const parents = dependents;
/** Children: the building blocks `slug` is made from. */
export const children = (slug: string) => (learnPage(slug)?.requires ?? []).map((r) => learnPage(r)!).filter(Boolean);
