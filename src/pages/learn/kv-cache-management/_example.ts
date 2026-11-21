/**
 * A tiny paged-KV allocator, run at build time, so every block number, reference
 * count and hash on the page comes from code. Toy sizes: 8 physical blocks of
 * 4 tokens (a real server uses blocks of 16–128 tokens and tens of thousands of them). Rules follow vLLM's
 * prefix caching design: only full blocks are hashed; a block's hash covers its
 * tokens and its parent's hash; ref-count-0 hashed blocks stay cached and are
 * evicted least-recently-freed first; at least the last prompt token is computed.
 */
import { createHash } from 'node:crypto';

export const BS = 4;
export const NB = 8;
type Id = string;
interface Block { id: number; tokens: string[]; ref: number; hash: string | null; freedAt: number }
interface Req { id: Id; blocks: number[]; tokens: string[] }

const blocks: Block[] = Array.from({ length: NB }, (_, id) => ({ id, tokens: [], ref: 0, hash: null, freedAt: -1 }));
const free: number[] = [3, 6, 1, 7, 0, 4, 2, 5]; // free-list order: physical blocks need not be adjacent
const cache = new Map<string, number>();          // hash → block id
const reqs = new Map<Id, Req>();
let clock = 0;

const h = (parent: string | null, toks: string[]) => createHash('sha256').update(`${parent ?? 'root'}|${toks.join('\u0001')}`).digest('hex').slice(0, 6);
const chainHashes = (toks: string[]) => {
  const out: string[] = [];
  for (let i = 0; i + BS <= toks.length; i += BS) out.push(h(out[out.length - 1] ?? null, toks.slice(i, i + BS)));
  return out;
};

function take(): { id: number; evicted?: string } {
  if (free.length) return { id: free.shift()! };
  // evict the least recently freed cached block
  const victim = blocks.filter((b) => b.ref === 0 && b.hash).sort((a, b) => a.freedAt - b.freedAt)[0];
  if (!victim) throw new Error('pool exhausted');
  const evicted = victim.hash!;
  cache.delete(evicted);
  Object.assign(victim, { tokens: [], hash: null });
  return { id: victim.id, evicted };
}

const seal = (b: Block, parent: string | null) => { if (b.tokens.length === BS && !b.hash) { b.hash = h(parent, b.tokens); cache.set(b.hash, b.id); } };
const parentOf = (r: Req, i: number) => (i === 0 ? null : blocks[r.blocks[i - 1]].hash);

/** A new request: walk the hash chain for hits, allocate the rest. */
function arrive(id: Id, toks: string[]) {
  const r: Req = { id, blocks: [], tokens: [...toks] };
  const hashes = chainHashes(toks);
  const maxHit = Math.floor((toks.length - 1) / BS); // last token is always computed
  let hits = 0;
  const evicted: string[] = [];
  for (let i = 0; i < hashes.length && i < maxHit; i++) {
    const b = cache.get(hashes[i]);
    if (b === undefined) break;
    blocks[b].ref++;
    const fi = free.indexOf(b);
    if (fi >= 0) free.splice(fi, 1);
    r.blocks.push(b);
    hits++;
  }
  for (let i = hits * BS; i < toks.length; i += BS) {
    const t = take();
    if (t.evicted) evicted.push(t.evicted);
    const b = blocks[t.id];
    b.tokens = toks.slice(i, i + BS);
    b.ref = 1;
    r.blocks.push(t.id);
    seal(b, parentOf(r, r.blocks.length - 1));
  }
  reqs.set(id, r);
  return { cached: hits * BS, computed: toks.length - hits * BS, hitBlocks: r.blocks.slice(0, hits), evicted, hashes };
}

/** Decode: append tokens, sealing full blocks and allocating new ones. */
function grow(id: Id, toks: string[]) {
  const r = reqs.get(id)!;
  const added: number[] = [];
  for (const t of toks) {
    let last = blocks[r.blocks[r.blocks.length - 1]];
    if (last.tokens.length === BS) {
      const nb = take();
      last = blocks[nb.id];
      last.tokens = [];
      last.ref = 1;
      r.blocks.push(nb.id);
      added.push(nb.id);
    }
    last.tokens.push(t);
    r.tokens.push(t);
    seal(last, parentOf(r, r.blocks.length - 1));
  }
  return { added };
}

/** Finish: drop refs; full hashed blocks stay cached, partial ones go back to the free list. */
function finish(id: Id) {
  const r = reqs.get(id)!;
  const kept: number[] = [], freed: number[] = [];
  for (const bi of r.blocks) {
    const b = blocks[bi];
    b.ref--;
    if (b.ref === 0) {
      b.freedAt = ++clock;
      if (b.hash) kept.push(bi);
      else { b.tokens = []; free.push(bi); freed.push(bi); }
    }
  }
  reqs.delete(id);
  return { kept, freed };
}

export interface Snap {
  title: string;
  text: string;
  blocks: { id: number; tokens: string[]; ref: number; hash: string | null; state: 'free' | 'used' | 'cached' }[];
  tables: { id: Id; blocks: number[]; tokens: number }[];
  changed: number[];
  free: number[];
}
const snap = (title: string, text: string, changed: number[] = []): Snap => ({
  title, text, changed,
  blocks: blocks.map((b) => ({ id: b.id, tokens: [...b.tokens], ref: b.ref, hash: b.hash, state: b.ref > 0 ? 'used' : b.hash ? 'cached' : 'free' })),
  tables: [...reqs.values()].map((r) => ({ id: r.id, blocks: [...r.blocks], tokens: r.tokens.length })),
  free: [...free],
});

const SYS = ['<sys>', 'You', ' are', ' helpful'];
const promptA = [...SYS, '<u>', 'What', ' is', ' a', ' GPU', '?'];
const promptB = [...SYS, '<u>', 'List', ' pods', '?'];
const promptC = ['<sys>', 'Translate', ' to', ' French', '<u>', 'The', ' node', ' is', ' down', ' since', ' noon', '.', ' Fix', ' it', ' now', '!'];
export const prompts = { A: promptA, B: promptB, C: promptC };
export const sysHash = h(null, SYS);

export const steps: Snap[] = [];
steps.push(snap('Empty pool', `${NB} physical blocks of ${BS} tokens each, all free. The free list hands them out in order ${free.join(', ')}: physical blocks need not be adjacent.`));

const a = arrive('A', promptA);
steps.push(snap('Request A arrives: 10 tokens → 3 blocks', `No hash matches, so all ${a.computed} tokens are computed. A's block table maps logical blocks 0, 1, 2 to physical ${reqs.get('A')!.blocks.join(', ')}. The two full blocks get chained hashes (block 0: ${a.hashes[0]}, block 1: ${a.hashes[1]}, computed from block 0's hash plus its own tokens). The third block holds 2 of 4 tokens and has no hash yet.`, reqs.get('A')!.blocks));

const g = grow('A', [' It', ' runs', ' kernels']);
steps.push(snap('A decodes 3 tokens', `" It" and " runs" fill block ${reqs.get('A')!.blocks[2]}, which is now full and gets a hash. " kernels" needs a new block: the allocator takes block ${g.added[0]} from the free list. Waste is at most one partly filled block per sequence.`, [reqs.get('A')!.blocks[2], ...g.added]));

const b = arrive('B', promptB);
steps.push(snap('Request B arrives with the same system prompt', `B's first block has the same tokens from position 0, so the same hash (${b.hashes[0]}): it maps to physical block ${b.hitBlocks[0]}, whose reference count goes to 2. Its second block differs, so the chain stops; block ${reqs.get('B')!.blocks[1]} is allocated. Result: cached_tokens=${b.cached}, computed ${b.computed}.`, reqs.get('B')!.blocks));

const fa = finish('A');
steps.push(snap('A finishes', `A drops its references. The shared block stays in use by B (ref 1). Blocks ${fa.kept.join(' and ')} are full and hashed, so they are not erased: they stay as cached, evictable blocks (amber) with ref 0. Block ${fa.freed.join(', ')} was only partly full, has no hash, and returns to the free list.`, [...fa.kept, ...fa.freed]));

const d = arrive('D', promptA);
steps.push(snap('Request D resends A\'s prompt', `D walks its hash chain: block 0 hits ${d.hitBlocks[0]} (ref 2), block 1 hits cached block ${d.hitBlocks[1]} (back to ref 1). Its third block has only 2 tokens, so it cannot be hashed and is computed: cached_tokens=${d.cached}, computed ${d.computed}. Hits always come in whole blocks.`, reqs.get('D')!.blocks));

const c = arrive('C', promptC);
steps.push(snap('Request C needs 4 blocks; only 3 are free', `C shares nothing (different system prompt). The allocator uses the ${c.evicted.length ? 'free blocks, then evicts the least recently freed cached block' : 'free blocks'}${c.evicted.length ? ` (hash ${c.evicted.join(', ')}): that prefix is gone and would be recomputed next time` : ''}. The pool is now full: the next request must wait, or a running one is preempted.`, reqs.get('C')!.blocks));
