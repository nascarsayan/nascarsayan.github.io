/** Text measurement and wrapping from the Albert Sans metrics table. */
import { ADVANCE } from './metrics';

const FALLBACK = 0.56; // em, for characters outside the table

export function measure(s: string, size: number, weight: 400 | 500 | 600 | 700 = 400): number {
  const table = ADVANCE[weight];
  let w = 0;
  for (const ch of s) w += table[ch] ?? FALLBACK;
  return w * size;
}

/** Greedy word wrap to `max` px. A word wider than `max` stays whole (the box widens). */
export function wrap(s: string, max: number, size: number, weight: 400 | 500 | 600 | 700 = 400): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  max = Math.max(max, ...words.map((w) => measure(w, size, weight)));
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, size, weight) <= max) { line = next; continue; }
      if (line) out.push(line);
      if (measure(word, size, weight) <= max) { line = word; continue; }
      let chunk = '';
      for (const ch of word) {
        if (measure(chunk + ch, size, weight) > max && chunk) { out.push(chunk); chunk = ''; }
        chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}

export const widest = (lines: string[], size: number, weight: 400 | 500 | 600 | 700 = 400) =>
  Math.max(0, ...lines.map((l) => measure(l, size, weight)));
