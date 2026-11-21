/** Selection logic shared by the build-time checks and the browser script. */
export interface ExplorerConfig {
  section: string;
  options: { key: string; label: string; default: string; values: { value: string; label: string }[]; when?: Record<string, string[]> }[];
  variants: { match: Record<string, string>; figure: string }[];
}
export type Selection = Record<string, string>;

/** Effective selection: unknown values fall back to the default; options whose `when` fails are dropped. */
export function effective(ex: ExplorerConfig, sel: Selection): Selection {
  const out: Selection = {};
  for (const o of ex.options) {
    if (o.when && !Object.entries(o.when).every(([k, vs]) => vs.includes(out[k]))) continue;
    const v = sel[o.key];
    out[o.key] = v !== undefined && o.values.some((x) => x.value === v) ? v : o.default;
  }
  return out;
}

/** First variant whose `match` keys all equal the selection (missing keys match anything). */
export function matchVariant(ex: ExplorerConfig, sel: Selection) {
  return ex.variants.find((v) => Object.entries(v.match).every(([k, val]) => sel[k] === val));
}
