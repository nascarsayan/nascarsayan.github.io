/**
 * The HBM bad-page budget, computed. Rules from the amdgpu driver
 * source (mainline 6.16): one bad row retires 16 pages; the threshold is 128
 * pages (BAD_PAGE_THRESHOLD in amd-smi static). Page size: 4 KiB in the
 * kernel docs' example (not verified for MI355X).
 */
export const PAGES_PER_ROW = 16;
export const THRESHOLD = 128;
export const PAGE_BYTES = 4096;
export const HBM_BYTES = 309237645312; // mem_info_vram_total of one MI355X (example value: 288 GiB)
export const budgetRows = THRESHOLD / PAGES_PER_ROW; // 8

/** Grid after `bad` rows: budgetRows + 1 rows × 16 pages; 1 = retired. */
export function grid(bad: number) {
  return Array.from({ length: budgetRows + 1 }, (_, r) => Array.from({ length: PAGES_PER_ROW }, () => (r < bad ? 1 : 0)));
}
export const rowLabels = Array.from({ length: budgetRows + 1 }, (_, r) => `row ${r + 1}`);
export const pageLabels = Array.from({ length: PAGES_PER_ROW }, (_, p) => String(p + 1));
export function state(bad: number) {
  const pages = bad * PAGES_PER_ROW;
  const lost = pages * PAGE_BYTES;
  return {
    pages,
    pct: Math.round((100 * pages) / THRESHOLD),
    lostKiB: lost / 1024,
    lostShare: (lost / HBM_BYTES).toExponential(1),
    exceeded: pages > THRESHOLD,
    text: `${bad} bad row${bad === 1 ? '' : 's'} × ${PAGES_PER_ROW} pages = ${pages} retired pages, ${Math.round((100 * pages) / THRESHOLD)} % of the ${THRESHOLD}-page budget; ${lost / 1024} KiB of ${(HBM_BYTES / 1024 ** 3).toFixed(0)} GiB lost (${(lost / HBM_BYTES).toExponential(1)} of the memory)`,
  };
}
