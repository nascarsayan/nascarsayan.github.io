/** gpt-oss-120b, level by level, from existing page diagrams: every key in `inside` is a box id of the level above. */
import { defineDrill } from '@/diagrams/drilldown';
import pass from '../tokens-and-transformers/_layer.diagram';
import kernels from '../llm-kernels/_layer.diagram';
import step from '../attention-and-kv-cache/_step.diagram';
import blocks from '../kv-cache-management/_blocks.diagram';
import flash from '../flash-attention/_loop.diagram';
import route from '../mixture-of-experts/_route.diagram';
import tiles from '../gemm-tiling/_tiles.diagram';
import kloop from '../gemm-tiling/_kloop.diagram';

/** Shared levels: one panel each, opened by any of their boxes. */
export const gemmLevel = {
  title: 'One GEMM, tile by tile',
  spec: tiles,
  about: 'Every level of tiling exists for reuse: a tile read once from HBM feeds many multiply-adds from LDS and registers. Bigger tiles mean more reuse but fewer workgroups to keep all CUs busy.',
  inside: { wg: { title: 'One workgroup\'s K loop', spec: kloop, about: 'Two LDS buffers let the next tile load while the matrix cores work on the current one, so neither side waits.' } },
};
const flashLevel = { title: 'FlashAttention, one workgroup', spec: flash, about: 'The score matrix never goes to HBM: it is made one block at a time in registers, with a running max and sum that keep the softmax exact. Scores, softmax and the weighted sum are one kernel.' };
const layerLevel = {
  title: 'One layer as GPU kernels',
  spec: kernels,
  about: 'Most of the time goes to the GEMMs and attention; norms and RoPE are small kernels that mostly move memory. In decode every weight is read from HBM to make one token per sequence, so the GEMMs wait on memory, and batching more sequences is almost free.',
  inside: {
    qkv: gemmLevel,
    fa: {
      title: 'Attention for one new token',
      spec: step,
      about: 'Only the new token is projected; the keys and values of all earlier tokens are read from the cache. That read grows with the context, so long contexts make decode attention wait on HBM.',
      inside: {
        cache: { title: 'The KV cache in blocks', spec: blocks, about: 'Blocks let a sequence grow without reserving memory for the longest possible reply, and let requests with the same prefix share the same blocks.' },
        score: flashLevel,
        mix: flashLevel,
      },
    },
    o: gemmLevel,
    rt: { title: 'The router picks 4 of 128 experts', spec: route, about: 'One token reads only 4 experts\' weights. A batch is different: its tokens pick different experts, so most experts are read anyway.' },
    g1: gemmLevel,
    g2: gemmLevel,
  },
};

export default defineDrill({
  title: 'One forward pass of gpt-oss-120b',
  spec: pass,
  about: 'The 36 layers have the same shape and run one after another. Prefill runs the stack once over the whole prompt; decode runs it once per new token and reuses the KV cache each layer wrote.',
  caption: 'Tokens in, next-token probabilities out. Both halves of a layer open into the same view: the kernels a GPU runs for one layer.',
  inside: { attn: layerLevel, moe: layerLevel },
});
