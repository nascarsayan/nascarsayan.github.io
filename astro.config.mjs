import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { readFileSync } from 'node:fs';
import { satteri } from '@astrojs/markdown-satteri';
import { mathPlugin } from './src/lib/math.ts';
import { CODE_THEMES } from './src/config/code-themes.mjs';

/** TextMate grammars for languages Shiki does not ship (src/shiki/*.tmLanguage.json). */
const grammar = (name) => JSON.parse(readFileSync(new URL(`./src/shiki/${name}.tmLanguage.json`, import.meta.url), 'utf8'));

export default defineConfig({
  // GitHub Pages user site: served from the domain root, so base stays '/'.
  site: 'https://nascarsayan.github.io',
  base: '/',
  // Pure static build into dist/ (the Pages workflow uploads it).
  output: 'static',
  outDir: 'dist',
  // Every page is <slug>/index.html; GitHub Pages serves /slug/ directly and redirects /slug to /slug/.
  trailingSlash: 'always',
  // About is the home page; keep old /about/ links working (static meta-refresh page).
  redirects: { '/about/': '/' },
  build: { format: 'directory' },
  // Fetch a page while its link is hovered (or focused), so the click opens it at once.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [mdx()],
  markdown: {
    // Math: $$…$$ only (inline inside a sentence, display on its own lines). A single $ is
    // text: Sätteri otherwise reads the $ of a JSX template literal (`${x}`) as the start of
    // inline math, and the following MDX expressions render as raw text (lint-rendered.mjs).
    processor: satteri({ features: { math: { singleDollarTextMath: false } }, mdastPlugins: [mathPlugin] }),
    shikiConfig: {
      // Light and dark themes are selected independently in Settings; code-themes.css shows the active pair.
      themes: CODE_THEMES,
      wrap: false,
      // Not bundled with Shiki: PromQL, NVIDIA PTX, AMD GPU assembly. CUDA and HIP read as C++.
      langs: ['promql', 'ptx', 'amdgcn'].map(grammar),
      langAlias: { cuda: 'cpp', hip: 'cpp', gcn: 'amdgcn' },
    },
  },
});
