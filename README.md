# nascarsayan.github.io

Sayan Naskar's personal site at <https://nascarsayan.github.io/>: notes, learning pages and diagrams.
Astro + MDX, one set of components, one light/dark theme, site-wide search. Fully static: `bun run build`
writes plain files to `dist/`, and GitHub Pages serves them.

Theme: auto (follows the OS, the default), light or dark; the toggle cycles them and an explicit choice is
remembered in the browser (`localStorage` `theme`).

## Develop

Needs [Bun](https://bun.sh), Node.js >= 22 (Astro runs on it) and, for graph layouts, Go >= 1.27.

```bash
bun install --frozen-lockfile
bun run dev        # http://localhost:4321
bun run build      # static site in dist/ (lints included)
bun run preview    # serve dist/ locally
```

`scripts/build-tala.mjs` compiles the TALA layout tool (`tools/tala-layout`, Go) into `.tools/` on the first
build and whenever its sources change. It uses `$GO`, else the first new-enough `go` on PATH. Without Go the
build still works, but graphs fall back to the columns layout.

The build also runs two lints: `scripts/lint-diagram-css.mjs` (diagram animation CSS) before Astro, and
`scripts/lint-rendered.mjs dist` (MDX expressions that leaked into the page as text) after it.

## Deploy

`.github/workflows/pages.yml` builds and deploys on every push to `main` (or by hand: Actions > Pages > Run
workflow). It installs Go (version from `tools/tala-layout/go.mod`), Node and Bun, runs
`bun install --frozen-lockfile` and `bun run build`, uploads `dist/` and deploys it with `actions/deploy-pages`.
Every action is pinned to a full commit SHA.

One-time repository setting: **Settings > Pages > Build and deployment > Source: GitHub Actions**.

This is a user site served from the domain root, so `astro.config.mjs` keeps `base: '/'`. Pages are built as
`<slug>/index.html` with `trailingSlash: 'always'`; GitHub Pages serves `/slug/` and redirects `/slug` to it.

## Add a page

See [docs/adding-pages.md](docs/adding-pages.md) for the page templates in `templates/` (article, diagram
page, simple page, Learn page, standalone app). Articles need nothing else: the home page and search pick them
up from frontmatter. Folders under `src/pages/` whose name starts with `_` are not built or listed.

Components (`src/components/content/`): `Diagram` + `Step`, `Explorer` + `Variant`, `Kpis`, `Callout`,
`Cards` + `Card`, `Timeline` + `TimelineItem`, `Columns` + `Column`, `Badge`, and more. Each file's header
documents its props.

## Diagrams

Specs are typed TypeScript (`src/diagrams/spec.ts`):

```ts
import { defineDiagram } from '@/diagrams/spec';
export default defineDiagram({
  kind: 'graph',                       // or 'sequence' (participants, messages, frames)
  layout: 'auto',                      // 'tala' | 'columns' | 'auto'
  groups: [{ id: 'cp', label: 'Control plane', tone: 'primary' }],
  nodes: [
    { id: 'client', label: 'Every client', tag: 'client' },
    { id: 'hap', label: 'HAProxy', detail: 'health checks every 2 s', parent: 'cp' },
    { id: 'db', label: 'CephFS', shape: 'store' },
  ],
  edges: [{ from: 'client', to: 'hap', label: 'pull' }, { from: 'hap', to: 'db' }],
});
```

- **Layout**: graphs are placed by [TALA](https://github.com/terrastruct/d2/tree/master/d2layouts/d2talalayout)
  through `tools/tala-layout` (positions and edge routes only); `columns` lays pipelines out as grouped columns;
  `auto` keeps whichever fits best. Sequences have their own layout. Box sizes come from the real font metrics
  (`src/diagrams/metrics.ts`).
- **Fit**: every diagram keeps its proportions and fits the column and the viewport height — no scrolling.
  Expand (or `f`) shows it full-window.
- **Steps**: prev / play / next / dots, arrow keys, Space. Focused shapes and edges light up and active edges
  carry a moving dot; `mode="build"` reveals elements step by step; `autoSteps` on a sequence = one step per message.
  Unknown focus ids fail the build.
- **Round trips**: a step's `path` plays a request and what comes back; it replays until the step changes. The
  dot moves at one constant speed (400 px/s at 1×, no easing) and pauses 0.2 s at each box between two hops. Arrows
  fill in behind it, red on the way out (sent, no answer yet). Senders show typing dots while they wait.
  | Path | What happens | Reply | Senders' badge |
  | --- | --- | --- | --- |
  | `a -> b -> c` (or `a -> b -> a`) | 2xx | green | green ✓ |
  | `a -> b -> c:404` / `c:4xx` | client error | amber | amber pill with the code |
  | `a -> b -> c:503` / `c:5xx` | server error | orange | orange pill with the code (shakes) |
  | `a -> b -> c:hang` | c never answers | none | dots turn red and slow; c gets a red clock |
  | `a -> b -x> c` | dropped on that hop | none | dots turn red and slow |
  | `a => b => c` | one-way flow (deploy steps, file writes) | none | none; each stage lights as reached |

  **Narration**: a subtitle line in the bar, right after the step dots, says what is happening: one line per
  hop; the far end's answer leads the first reply line. The packet never stops for text: each hop lasts at
  least as long as its line takes to read (0.6 s plus 17.5 ms per character, at most 1.6 s, at 1×), still at constant
  speed within the hop, with the 0.2 s pause at each box. Important outcomes (`200 OK`, `503`, `No answer`,
  `Request lost`) appear large over the blurred diagram at the end of every run, after what led to them. A step's
  `narration={{ nodeId: 'text' }}` replaces the line when the packet reaches that node. Screen readers get one
  summary per step (route and outcome) in a polite live region; the visual line and the overlay are
  aria-hidden. Autoplay moves on after the step's first full run.
  **Speed**: `− 1× +` in each bar (0.25× to 3×; click the value to reset). One speed for every diagram: it
  carries over while browsing in the tab and resets to 1× on reload. It scales the dot, pauses, reading
  times, outcomes, autoplay and the badge animations (the looping packets of sequence steps excepted).
  A step's `state` changes how boxes and edges look during that step (tone, detail, tag, label, dashed), e.g. the
  healthy start of a story drawn in its stalled state. A step that only focuses broken (`risk`) edges shows green
  packets flowing, a flicker, then red with no packets.
- **Hover**: boxes with `info` show a card (tag, name, detail, info); holding the pointer on a box for 2 s draws it
  above everything.
- **Theme**: semantic tones `neutral primary good warn risk note muted`, plus hues `violet teal sky pink peach lime`
  (Catppuccin-based) for telling parts apart; light and dark. Graph edges stay neutral at rest: green and red only
  show what happens in a step. Lit elements glow in their own colour.
- **Lint** (build fails, naming the diagram and the problem; `DIAGRAM_LINT=warn bun run build` lists every issue):
  - every straight run of an arrow must be ≥ 14px and the last run (with the arrowhead) ≥ 18px. Bypass only with
    `allowShort: '<why>'` on the edge, message or diagram;
  - no edge may run through a box that is not one of its ends;
  - no edge label may cover a box or another label. Labels slide along their edge to a clear spot, and gaps
    between columns, side strips and band boxes widen to fit the labels crossing them;
  - box `detail` must be ≤ 48 characters; longer text goes in `info` (the hover card);
  - an answered round trip must not cross a broken (`risk`) edge or pass through a broken box (only its ends may
    be broken): mark where it fails (`:hang`, `:5xx`, `-x>`), or give the step a `state`;
  - `scripts/lint-diagram-css.mjs`: keyframes on edge lines animate stroke only, on arrowheads fill only.

## Definitions

`src/config/glossary.ts`: the first use of each term in an article is underlined and shows its definition on
hover or focus; `/glossary/` lists them all. Add a term there (with `aliases` for other spellings); nothing to
change in the pages.

## Explorers

`<Explorer id options variants>` with `<Variant id>` children: option buttons choose the variant, synced with the
URL (`?path=proxy&version=fix#explore`). The build fails if a reachable selection has no variant. Usage: the
header of `src/components/content/Explorer.astro`; page templates to start from: `templates/` (see
[docs/adding-pages.md](docs/adding-pages.md)).
