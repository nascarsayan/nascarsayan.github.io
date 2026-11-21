/**
 * Option explorers (<Explorer> with <Variant> children): option buttons pick
 * which variant is shown. The selection lives in the URL query
 * (`?path=proxy&version=fix#explore`), so a view can be shared.
 *
 * Checked at build time: unknown variants, options or values, unused variants,
 * and reachable selections that match no variant fail the build.
 */
import { z } from 'astro/zod';
import { effective, matchVariant, type Selection } from './explorer-core';

export { effective, matchVariant };

const token = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);

const Option = z
  .object({
    key: token,
    label: z.string().min(1).max(80),
    default: token,
    values: z.array(z.object({ value: token, label: z.string().min(1).max(120) }).strict()).min(2).max(12),
    /** Use this option only while another option has one of these values. */
    when: z.record(token, z.array(token).min(1)).optional(),
  })
  .strict();

export const ExplorerSchema = z
  .object({
    section: token,
    options: z.array(Option).min(1).max(8),
    variants: z
      .array(z.object({ match: z.record(token, token), figure: z.string().min(1).max(120) }).strict())
      .min(1)
      .max(256),
  })
  .strict();

export type Explorer = z.infer<typeof ExplorerSchema>;

/** Every effective selection reachable from the buttons. */
function reachable(ex: Explorer): Selection[] {
  let sels: Selection[] = [{}];
  for (const o of ex.options) sels = sels.flatMap((s) => o.values.map((v) => ({ ...s, [o.key]: v.value })));
  const seen = new Map<string, Selection>();
  for (const s of sels) {
    const e = effective(ex, s);
    seen.set(JSON.stringify(e), e);
  }
  return [...seen.values()];
}

/** Validate an explorer config; `variantIds` are the <Variant> ids on the page. */
export function validateExplorer(input: unknown, where: string, variantIds: Set<string>): Explorer {
  const parsed = ExplorerSchema.safeParse(input);
  if (!parsed.success) throw new Error(`explorer ${where}: ${parsed.error.message}`);
  const ex = parsed.data;
  const fail = (msg: string) => { throw new Error(`explorer ${where}: ${msg}`); };
  const keys = new Map(ex.options.map((o) => [o.key, new Set(o.values.map((v) => v.value))]));
  for (const o of ex.options) {
    if (!keys.get(o.key)!.has(o.default)) fail(`option ${o.key}: default ${o.default} is not a value`);
    const earlier = ex.options.slice(0, ex.options.indexOf(o)).map((x) => x.key);
    for (const [k, vs] of Object.entries(o.when ?? {})) {
      if (!earlier.includes(k)) fail(`option ${o.key}: when ${k} must name an earlier option`);
      for (const v of vs) if (!keys.get(k)!.has(v)) fail(`option ${o.key}: when ${k}=${v} is unknown`);
    }
  }
  for (const v of ex.variants) {
    if (!variantIds.has(v.figure)) fail(`variant ${v.figure} has no <Variant id="${v.figure}">`);
    for (const [k, val] of Object.entries(v.match)) if (!keys.get(k)?.has(val)) fail(`variant ${v.figure}: ${k}=${val} is unknown`);
  }
  for (const id of variantIds) if (!ex.variants.some((v) => v.figure === id)) fail(`<Variant id="${id}"> is never selected`);
  for (const s of reachable(ex)) if (!matchVariant(ex, s)) fail(`no variant matches ${JSON.stringify(s)}`);
  return ex;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Controls markup, inserted after the section's header. Labels are escaped. */
export function controlsHtml(ex: Explorer): string {
  const initial = effective(ex, {});
  const rows = ex.options
    .map(
      (o) =>
        `<div class="sx-row" data-sx-row="${o.key}"${o.key in initial ? '' : ' hidden'}><span class="sx-label">${esc(o.label)}</span>` +
        `<div class="sx-seg" role="group" aria-label="${esc(o.label)}">` +
        o.values
          .map((v) => `<button type="button" data-sx-key="${o.key}" data-sx-value="${v.value}" aria-pressed="${initial[o.key] === v.value}" data-sound-click="popDown">${esc(v.label)}</button>`)
          .join('') +
        `</div></div>`,
    )
    .join('');
  return `<div class="sx-controls" data-sx="${ex.section}">${rows}<div class="sx-row"><span class="sx-label"></span><button type="button" class="sx-copy" data-sx-copy>Copy link to this view</button><span class="sx-msg" data-sx-msg aria-live="polite"></span></div></div>`;
}

