/**
 * The small Markdown used in diagram text (info cards, drill-down level notes), parsed
 * into a tree that each side renders without HTML strings: the client builds DOM
 * (scripts/diagram-player.ts), the server renders components/content/Md.astro.
 * Supported: paragraphs (blank line), "- " lists, `code`, **bold**, *italic*, [text](url).
 * Links: http(s) or site paths only (anything else stays text); external ones open in a new tab.
 */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong' | 'em'; c: Inline[] }
  | { t: 'a'; href: string; external: boolean; c: Inline[] };
export type Block = { t: 'p'; c: Inline[] } | { t: 'ul'; items: Inline[][] };

export function inlineMd(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    last = m.index! + m[0].length;
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'strong', c: inlineMd(m[2]) });
    else if (m[3] !== undefined) out.push({ t: 'em', c: inlineMd(m[3]) });
    else if (/^(https?:\/\/|\/|#)/.test(m[5])) out.push({ t: 'a', href: m[5], external: /^https?:/.test(m[5]), c: inlineMd(m[4]) });
    else out.push({ t: 'text', v: m[0] });
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

export function parseMd(src: string): Block[] {
  const out: Block[] = [];
  for (const para of src.split(/\n\s*\n/)) {
    const lines = para.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-*] /.test(l))) out.push({ t: 'ul', items: lines.map((l) => inlineMd(l.replace(/^\s*[-*] /, ''))) });
    else out.push({ t: 'p', c: inlineMd(lines.map((l) => l.trim()).join(' ')) });
  }
  return out;
}
