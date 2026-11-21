/**
 * Reading time of an MDX page source. Its own module, with no page imports: the
 * article layout uses it, and importing src/config/routes.ts there (which imports
 * every page, each of which imports the layout) is a cycle the dev server cannot load.
 */
/** Reading time: prose and step text only (no frontmatter, imports, code, tags or {expressions}). */
export function readMinutes(src: string) {
  const text = src
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`|>\[\]()-]/g, ' ');
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.round(words / 220));
}
