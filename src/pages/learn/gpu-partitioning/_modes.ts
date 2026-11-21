/**
 * MI355X partition modes. Partitions, XCC and DMA counts: the example
 * `amd-smi partition` output on the page (illustrative). Memory per partition = card HBM / partitions,
 * the rule AMD documents for MI300X (CPX: 8 × 24 GB, DPX: 2 × 96 GB, in NPS1 or
 * a matching NPS mode); assumed to hold for MI355X, not observed.
 */
export const cards = 8, xcds = 8, cusPerXcd = 32, iods = 2;
export const vramMiB = 294912, hbmGB = 288, preRender = 64;
export const compute = {
  SPX: { parts: 1, dma: 16 },
  DPX: { parts: 2, dma: 8 },
  QPX: { parts: 4, dma: 4 },
  CPX: { parts: 8, dma: 2 },
} as const;
export type CMode = keyof typeof compute;
export const memory = { NPS1: 1, NPS2: 2 } as const;
export type MMode = keyof typeof memory;
export const valid = (c: CMode, m: MMode) => memory[m] <= compute[c].parts;

export function mode(c: CMode, m: MMode) {
  const parts = compute[c].parts, pools = memory[m];
  return {
    c, m, parts, pools, ok: valid(c, m),
    xcds: xcds / parts, cus: (xcds / parts) * cusPerXcd, dma: compute[c].dma,
    hbmGB: hbmGB / parts, vramMiB: Math.floor(vramMiB / parts), poolGB: hbmGB / pools,
    perPool: parts / pools, node: parts * cards, render: parts * cards,
    // XCD i belongs to partition floor(i / (8 / parts)); XCDs 0-3 sit on IOD 0, 4-7 on IOD 1.
    owner: Array.from({ length: xcds }, (_, i) => Math.floor(i / (xcds / parts))),
  };
}

/** Walkthrough: one 8-GPU MI355X node in CPX + NPS2. */
export const cpx = mode('CPX', 'NPS2');
export const spx = mode('SPX', 'NPS1');
/** 8 cards × 8 partitions: amd-smi index of each logical GPU (row = card, column = partition). */
export const ids: number[][] = Array.from({ length: cards }, (_, card) => Array.from({ length: cpx.parts }, (_, p) => card * cpx.parts + p));
export const cardRows = Array.from({ length: cards }, (_, i) => `card ${i}`);
export const partCols = Array.from({ length: cpx.parts }, (_, i) => `XCP ${i}`);
/** Render minors per card in the example layout: primary renderD(128 + card), then its 7 spares from renderD(136 + 7·card). */
export const renderRange = (card: number) => `renderD${128 + card} + ${136 + 7 * card}–${142 + 7 * card}`;
export const fits = (gb: number) => ({ llama8bBf16: 16 <= gb, llama70bFp8: 70 <= gb, spare8b: gb - 16 });
