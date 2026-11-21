import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { readFileSync } from 'node:fs';
import { satteri } from '@astrojs/markdown-satteri';
import { mathPlugin } from './src/lib/math.ts';

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
      // Light code in light mode, dark in dark mode: Shiki writes both (the dark one as --shiki-dark*), and
      // src/styles/global.css switches on html[data-color-mode]. The same pair is in components using <Code>.
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      wrap: false,
      // Not bundled with Shiki: PromQL, NVIDIA PTX, AMD GPU assembly. CUDA and HIP read as C++.
      langs: ['promql', 'ptx', 'amdgcn'].map(grammar),
      langAlias: { cuda: 'cpp', hip: 'cpp', gcn: 'amdgcn' },
    },
  },
});
