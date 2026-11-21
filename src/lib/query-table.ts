/**
 * Query model for <QueryTable>: preset views are declarative (projection,
 * conditions, order), so the SQL shown to the reader and the filtering that
 * runs come from the same spec. Shared by the build (validation) and the
 * browser (scripts/query-table.ts).
 */

export type Cell = string | number | { label: string; url: string }[];
export type Row = Record<string, Cell>;

export interface Column {
  key: string;
  label: string;
  /** `enum`: few distinct values, filtered with a select; `links`: [{label,url}]. */
  kind?: 'text' | 'enum' | 'num' | 'links';
  /** Width hint in ch. */
  width?: number;
}

export type Op = '=' | '!=' | 'in' | 'not in' | 'like' | 'not like';
export interface Cond { col: string; op: Op; value: string | string[] }

export interface View {
  id: string;
  title: string;
  /** The question the view answers, in plain words. */
  question: string;
  cols: string[];
  where?: Cond[];
  order?: [string, 'asc' | 'desc'][];
}

export interface Config { table: string; columns: Column[]; views: View[]; rowKey: string }

export const cellText = (v: Cell | undefined): string =>
  v === undefined || v === null ? '' : Array.isArray(v) ? v.map((l) => l.label).join(', ') : String(v);

const like = (text: string, pattern: string) => text.toLowerCase().includes(pattern.toLowerCase());

export function matches(row: Row, c: Cond): boolean {
  const text = cellText(row[c.col]);
  const values = Array.isArray(c.value) ? c.value : [c.value];
  switch (c.op) {
    case '=': return text === values[0];
    case '!=': return text !== values[0];
    case 'in': return values.includes(text);
    case 'not in': return !values.includes(text);
    case 'like': return like(text, values[0]);
    case 'not like': return !like(text, values[0]);
  }
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function condSql(c: Cond): string {
  const values = Array.isArray(c.value) ? c.value : [c.value];
  if (c.op === 'in' || c.op === 'not in') return `${c.col} ${c.op.toUpperCase()} (${values.map(quote).join(', ')})`;
  if (c.op === 'like' || c.op === 'not like') return `${c.col} ${c.op.toUpperCase()} ${quote(`%${values[0]}%`)}`;
  // SQL's own spelling; `!=` also renders as a ≠ ligature in the site's mono font.
  return `${c.col} ${c.op === '!=' ? '<>' : c.op} ${quote(values[0])}`;
}

export function toSql(table: string, cols: string[], where: Cond[], order: [string, 'asc' | 'desc'][], extra: string[] = []): string {
  const lines = [`SELECT ${cols.join(', ')}`, `FROM ${table}`];
  const conds = [...where.map(condSql), ...extra];
  if (conds.length) lines.push(`WHERE ${conds.join('\n  AND ')}`);
  if (order.length) lines.push(`ORDER BY ${order.map(([c, d]) => `${c} ${d.toUpperCase()}`).join(', ')}`);
  return lines.join('\n') + ';';
}

export function compare(a: Cell | undefined, b: Cell | undefined): number {
  const x = cellText(a), y = cellText(b);
  const nx = Number(x), ny = Number(y);
  if (x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
  return x.localeCompare(y);
}

/** Build-time check: every view names real columns and its conditions match at least one row. */
export function validate(cfg: Config, rows: Row[]): void {
  const keys = new Set(cfg.columns.map((c) => c.key));
  if (!keys.has(cfg.rowKey)) throw new Error(`QueryTable: rowKey ${cfg.rowKey} is not a column`);
  const ids = new Set<string>();
  for (const v of cfg.views) {
    if (ids.has(v.id)) throw new Error(`QueryTable: duplicate view id ${v.id}`);
    ids.add(v.id);
    for (const c of [...v.cols, ...(v.where ?? []).map((w) => w.col), ...(v.order ?? []).map((o) => o[0])]) {
      if (!keys.has(c)) throw new Error(`QueryTable: view ${v.id} names unknown column ${c}`);
    }
    if (!rows.some((r) => (v.where ?? []).every((w) => matches(r, w)))) {
      throw new Error(`QueryTable: view ${v.id} matches no rows`);
    }
  }
}
