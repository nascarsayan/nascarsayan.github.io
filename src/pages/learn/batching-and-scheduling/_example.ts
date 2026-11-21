/**
 * Worked examples for the batching page, computed at build time.
 *
 * 1. A toy scheduler: five requests, a 16-token budget per step, simulated
 *    step by step with continuous batching (decodes first, then prefill
 *    chunks in arrival order) and with static batching (fixed groups of 3,
 *    prompts padded to the longest). The requests are made up.
 * 2. A step-time model for the calculator.
 */

// ---------- 1. Toy scheduler ----------

export const BUDGET = 16;
export interface Req { id: string; arrive: number; prompt: number; output: number }
export const reqs: Req[] = [
  { id: 'A', arrive: 0, prompt: 10, output: 3 },
  { id: 'B', arrive: 0, prompt: 4, output: 6 },
  { id: 'C', arrive: 1, prompt: 24, output: 2 },
  { id: 'D', arrive: 3, prompt: 5, output: 4 },
  { id: 'E', arrive: 4, prompt: 3, output: 2 },
];

/** One cell of the step grid: what a request did in a step. */
export type Kind = 'none' | 'wait' | 'prefill' | 'first' | 'decode' | 'idle' | 'pad' | 'done';
export interface Cell { kind: Kind; tokens: number; pad?: number }
export interface Sim { grid: Cell[][]; finish: number[]; steps: number; used: number[]; waste: number; notes: string[] }

/** Continuous batching: every step, running decodes take 1 token each, then prefills in arrival order fill the rest. */
function continuous(): Sim {
  const st = reqs.map(() => ({ done: 0, out: 0, fin: -1 }));
  const grid: Cell[][] = reqs.map(() => []);
  const used: number[] = [], notes: string[] = [];
  for (let s = 0; st.some((x) => x.fin < 0); s++) {
    let budget = BUDGET;
    const did: string[] = [];
    const cells: Cell[] = reqs.map((r, i) => ({ kind: r.arrive > s ? 'none' : st[i].fin >= 0 ? 'done' : 'wait', tokens: 0 }));
    // 1. decodes
    const dec: string[] = [];
    reqs.forEach((r, i) => {
      const x = st[i];
      if (cells[i].kind === 'wait' && x.done === r.prompt && x.out >= 1 && budget > 0) {
        budget--; x.out++; cells[i] = { kind: 'decode', tokens: 1 }; dec.push(r.id);
      }
    });
    if (dec.length) did.push(`decodes ${dec.join(', ')} (${dec.length} token${dec.length > 1 ? 's' : ''})`);
    // 2. prefills, first come first served
    reqs.forEach((r, i) => {
      const x = st[i];
      if (cells[i].kind !== 'wait' || x.done >= r.prompt || budget === 0) return;
      const t = Math.min(r.prompt - x.done, budget);
      budget -= t; x.done += t;
      const last = x.done === r.prompt;
      if (last) x.out = 1;
      cells[i] = { kind: last ? 'first' : 'prefill', tokens: t };
      did.push(last && t === r.prompt ? `${r.id}'s whole prompt (${t})` : last ? `${r.id}'s last chunk (${t}, prompt done)` : `${r.id} chunk (${t} of ${r.prompt - x.done + t} left)`);
    });
    const waiting = reqs.filter((_, i) => cells[i].kind === 'wait').map((r) => r.id);
    reqs.forEach((r, i) => {
      if ((cells[i].kind === 'decode' || cells[i].kind === 'first') && st[i].out === r.output) st[i].fin = s;
      grid[i].push(cells[i]);
    });
    used.push(BUDGET - budget);
    const left = reqs.filter((r, i) => st[i].fin === s).map((r) => r.id);
    notes.push(`${did.join(', then ') || 'nothing'}: ${BUDGET - budget} of ${BUDGET} tokens.` +
      (waiting.length ? ` ${waiting.join(', ')} wait${waiting.length > 1 ? '' : 's'}: no budget left.` : '') +
      (left.length ? (left.length > 1 ? ` ${left.join(' and ')} produce their last tokens and leave.` : ` ${left[0]} produces its last token and leaves.`) : ''));
  }
  return { grid, finish: st.map((x) => x.fin), steps: used.length, used, waste: used.reduce((a, u) => a + BUDGET - u, 0), notes };
}

/** Static batching: groups of up to 3 waiting requests; prompts padded to the longest; nobody joins until the whole group ends. */
function staticBatch(group = 3): Sim {
  const fin = reqs.map(() => -1);
  const grid: Cell[][] = reqs.map(() => []);
  const used: number[] = [], notes: string[] = [];
  let waste = 0, s = 0;
  const pending = [...reqs.keys()];
  const push = (cells: Cell[], u: number, note: string) => { cells.forEach((c, i) => grid[i].push(c)); used.push(u); notes.push(note); s++; };
  const base = () => reqs.map((r, i): Cell => ({ kind: r.arrive > s ? 'none' : fin[i] >= 0 ? 'done' : 'wait', tokens: 0 }));
  while (pending.length) {
    // The server waits until a full group has arrived (or the last requests).
    const ready = pending.filter((i) => reqs[i].arrive <= s);
    if (ready.length < Math.min(group, pending.length)) { push(base(), 0, `waiting for a full group of ${group}: nothing runs.`); waste += BUDGET; continue; }
    const g = ready.slice(0, group);
    g.forEach((i) => pending.splice(pending.indexOf(i), 1));
    const L = Math.max(...g.map((i) => reqs[i].prompt));
    let left = L * g.length, pos = 0;
    // Prefill the padded group, BUDGET tokens per step, slot by slot.
    while (left > 0) {
      const cells = base();
      let b = BUDGET;
      for (const i of g) {
        const start = pos, slotTokens = Math.max(0, Math.min(L * (g.indexOf(i) + 1) - start, b));
        if (slotTokens <= 0) continue;
        const real = Math.max(0, Math.min(reqs[i].prompt - (start - L * g.indexOf(i)), slotTokens));
        cells[i] = { kind: 'prefill', tokens: real, pad: slotTokens - real };
        pos += slotTokens; b -= slotTokens; left -= slotTokens;
      }
      const pad = cells.reduce((a, c) => a + (c.pad ?? 0), 0);
      waste += pad + b;
      push(cells, BUDGET - b, `${left === 0 ? 'last ' : ''}prefill step for the padded group ${g.map((i) => reqs[i].id).join(', ')} (every prompt padded to ${L}): ${BUDGET - b} tokens, ${pad} of them padding${left === 0 ? '. Every request in the group gets its first token' : ''}.`);
    }
    // First token for all, then decode until the longest output ends.
    const out = g.map(() => 1);
    const maxOut = Math.max(...g.map((i) => reqs[i].output));
    for (let k = 1; k < maxOut; k++) {
      const cells = base();
      let idle = 0;
      g.forEach((i, n) => {
        if (out[n] < reqs[i].output) { out[n]++; cells[i] = { kind: 'decode', tokens: 1 }; if (out[n] === reqs[i].output) fin[i] = s; }
        else { cells[i] = { kind: 'idle', tokens: 0 }; idle++; }
      });
      waste += BUDGET - (g.length - idle);
      push(cells, g.length - idle, `decode the group: ${g.length - idle} token${g.length - idle > 1 ? 's' : ''}${idle ? `; ${idle} finished slot${idle > 1 ? 's sit' : ' sits'} idle` : ''}.`);
    }
    g.forEach((i, n) => { if (fin[i] < 0) fin[i] = s - 1; });
  }
  return { grid, finish: fin, steps: used.length, used, waste, notes };
}

export const cont = continuous();
export const stat = staticBatch();
const kinds = (sim: Sim, k: Kind) => sim.grid.flat().filter((c) => c.kind === k).length;
/** Headline numbers for both policies: steps to finish everything, mean latency in steps, waste. */
export const compare = [cont, stat].map((sim) => ({
  steps: sim.steps,
  meanLatency: Math.round((reqs.reduce((a, r, i) => a + sim.finish[i] - r.arrive + 1, 0) / reqs.length) * 10) / 10,
  padding: sim.grid.flat().reduce((a, c) => a + (c.pad ?? 0), 0),
  idle: kinds(sim, 'idle'),
  emptySteps: sim.used.filter((u) => u === 0).length,
}));
export const totalWork = reqs.reduce((a, r) => a + r.prompt + r.output - 1, 0);

// ---------- 2. Step-time model for the calculator ----------
/**
 * Assumed, not measured: ms ≈ a + b × tokens, with b from gpt-oss-120b's
 * ~9 GFLOP per token at 30% of an MI355X's ~5 PFLOP/s dense FP8 peak
 * (9e9 / 1.5e15 s = 6 µs per token) and a fixed per-step overhead a.
 * Decode tokens also read their KV, so the model underestimates them.
 */
export const fit = { a: 2, b: 0.006 };
