# Diagram layout guidelines (graph specs)

For people and agents writing `src/pages/**/_*.diagram.ts`. Goal: about 2:1, inside 1080×540 at scale 1, no lint failures.
Evidence: 116 site specs measured, and the 38 real aspect-lint fixes of Nov 2026 studied (sizes quoted below are before → after).

## 1. Start with the defaults

```ts
defineDiagram({ kind: 'graph', groups: [...], nodes: [...], edges: [...] }); // layout: 'auto', direction: 'auto'
```

- Leave `layout` and `direction` out. With `auto`, the engine scores TALA (both directions, with and without a default group direction) and column variants (including hub nodes as bands or sides, and groups as rows or stacks) by one cost: lint failures, then fit to 1080×540 together with closeness to 2:1. A forced value removes candidates. Of the 40 aspect failures before the fix round, 36 had a forced `layout` or `direction`; 10 of the 40 real fixes only removed or changed that setting.
- Force `layout: 'columns'` only for a real pipeline (steps in order, one column per stage). Force `layout: 'tala'` only for a mesh with no clear stages.
- Never force `direction` unless the reading order requires it. TALA `down` puts a chain in one tall column, and `right` puts it in one long strip.

## 2. Pick a structure that matches the story

| Story | Structure | Notes |
|---|---|---|
| Stages / phases / time order | One top-level group per stage (columns) | 3–5 columns of 2–4 boxes each give about 2:1. Fixed: incident runbook 1290×1309 → 1284×645, operating track 446×1167 → 732×371. |
| One actor talks to every group (client, switch, API server, shared store) | `band: -1` (source above) / `band: 1` (sink below), or `side: -1/1` | Do not make it a loose node that TALA has to place. Fixed: three verdicts 1343×307 → 731×258 (pills as `band: 1`). |
| Endpoints of a left-to-right flow | `side: -1` (start) and `side: 1` (end) | Fixed: prefill idea 1116×304 → 882×224. |
| A few peers inside one group | `direction: 'right'` on that group | Cheapest fix of all. Architecture 783×714 → 1050×526, ISA pipeline 417×511 → 970×370, blast-radius 461×494 → 1038×354. |
| Fan-out (1 → many) | Put the many in one group with `direction: 'right'` (a row) and the source above it | Fixed: MoE layer 1091×790 → 961×494, operator rollout 869×914 → 1424×620. |
| Long chain (> 5 boxes) | Split it into 2–3 groups (rows or columns) | Fixed: GEMM K loop 1395×294 → 1083×351 (a new stacked subgroup). |

## 3. Things that make layouts tall, wide or crowded

- **Wrapper groups**: a group that holds everything (Host, Package, Cluster) adds a frame and blocks the arrangement of the groups inside it. Put the context in a node `info` or in the caption. Fixed: what-is-a-gpu 1141×1103 → 985×470, cdi 593×686 → 1069×399.
- **Deep nesting** (more than 2 levels): the columns layout flattens it, and TALA grows a frame for each level. Keep groups 1 level deep, 2 at most.
- **Hub nodes** (degree ≥ 5, or linked to 3 or more groups): TALA puts them in the middle and wraps everything around them. Use a band or a side for them.
- **Back edges and cycles** (repair loop, retry): TALA lays the cycle out as a ring and gets tall. Use `style: 'dashed'` for the return edge, and keep the main path in columns. If the meaning allows it, reverse the edge (interconnect links 904×946 → 1032×615).
- **Groups of very different sizes**: one 8-box column next to 1-box columns gives a tall, mostly empty shape. Split the big group, or give it `direction: 'right'`.
- **Long labels**: an edge label wider than about 150 px wraps and widens the gap between columns. Keep edge labels to 1–3 words, box labels to a few words, and `detail` to about 40 characters. Put the rest in `info`. Fixed: LLM phases 559×459 → 823×324 by shortening one edge label.
- **Node order** in the columns layout is the spec order. A bad order makes edges cross boxes (one dependency graph took several reorderings). List nodes in flow order, and put the nodes that link to the next column last.
- **Ids differing only in case** within one group are rejected by the TALA wrapper (D2 keys children case-insensitively). Mixed-case ids are fine otherwise.

## 4. Box size and flow direction

- Boxes are drawn at the size their text needs, centred in their column, row, band or strip. The **box-fit lint** fails a box more than 1.5× wider (and 60 px wider) or 1.6× taller (and 30 px taller) than its content. Exception: a **bus**, a node linked to 3 or more boxes (a switch, a shared store), may span its band or side strip on purpose.
- Keep one reading direction. A chain should run left to right within each row (`direction: 'right'` on the groups), with a single dog-leg arrow down to the next row. Don't run one group down and the next across. Example: gpu-execution-model "From one launch to one lane", from columns (one group down, the next group restarting at the top) to two right-flowing rows, 1060×338.
- A small diagram does not need reshaping to 2:1. The aspect lint only applies above 420 px tall or 1080 px wide.

## 5. Sizing to land near 2:1

- Typical box: about 150–200 × 50–70 px. For a 1080×540 box, aim for at most about 5 columns and at most about 4 rows of boxes.
- Too tall: add columns (split groups), set `direction: 'right'` on small groups, move hubs to `side`.
- Too wide (ratio > 3.5, or wider than about 1400 px, which shrinks the text below 0.77): move endpoints to `band` instead of `side`, stack one group (`direction: 'down'`), or wrap the columns into two rows by adding a group.
- Small diagrams (≤ 420 px tall) pass the lint at any ratio. Do not add boxes just to fix the ratio.
- Check the scale as well as the ratio. 1812×592 passes the lint (3.06:1) but draws text at 60 %.

## 6. Check it

```sh
DIAGRAM_LINT=warn bun run build 2>&1 | grep -E 'shape [0-9]|runs through|covers'
```

Then look at the diagram (headless Firefox). The lint does not catch every fault yet: it misses edges that run through their own end box, and diagrams so wide they render below about 0.8 scale. Edges that leave the scene, and edges that lie on top of each other, are caught.

## 7. Escape hatches

- `allowShort: '<reason>'` (edge or diagram): only for runs that are short by design, such as several parallel lookups between narrow columns. Put it on the edge, not on the whole diagram.
- `allowBoxFit: '<reason>'`: only when a large box is the point (a floor plan, a container drawn to scale).
- `allowAspect: '<reason>'`: last resort, after you have tried auto, per-stage columns, bands/sides, `direction: 'right'` on groups, and shorter text. It is justified when the shape is the content: a physical stack or floor plan, a tall tree that the page then explains level by level, or a strip that must line up with a table. In the fix round, 0 of 38 fixes needed it (1 diagram kept a prior one).
- Split the diagram in two when it tells two stories (setup vs run, normal vs failure). That usually beats any layout trick.

## 8. Known limits

TALA has no notion of target shape, ignores the root direction inside groups, and shifts with id renames. Our own layout engine is planned; keep a note of every layout you have to fix by hand, as a test corpus for it.

## 9. Drill-down diagrams (`<Drilldown>`)

For a structure too deep for one diagram (a computer down to a transistor), draw one diagram per level and join them in a tree (`_x.drill.ts`, format in `drilldown.ts`). A box listed in its level's `inside` gets a magnifier badge; clicking it opens that box's inside diagram below, with a dotted lens from the box to the panel. Example: `src/pages/learn/inside-a-computer/`.

- One idea per level, 4–10 boxes. Every level is an ordinary `<Diagram>`, so every lint above applies to each one.
- `inside` keys must be box ids of that level (build error otherwise). A level can be reused under several boxes (the same transistor under the gate, the SRAM bit and the DRAM bit).
- Keep level titles short: they form the breadcrumb and the map.
- Reuse, never copy: a level's `spec` should be the page diagram that already shows it (import `../other-page/_x.diagram`), and shared levels are exported and imported (`bankLevel` in `_computer.drill.ts`). The same level object under several boxes of one level (two "4 XCDs" boxes) renders one shared panel.
- `about` (optional, Markdown as in `md.ts`): a short note above the level's diagram with what the picture cannot say: why it is built this way, the number that matters, what goes wrong. Do not repeat the box labels.

## 10. Many crossing wires

- **Overlap lint** (build error): two wires on top of each other (they read as one), and an edge label covering another wire, a bend of another wire, or any arrowhead (its own too). Wires that leave or reach the same port may share a trunk. The router avoids running a wire on top of an earlier one; gaps that carry a labelled edge are the label plus 36 px, so the label sits on a free stretch of its own line.
- **Wire spacing lint** (build error): a wire must not slide along a box border (closer than 5 px, parallel), its own end boxes included; two parallel wires must be 8 px apart or exactly on one line (allowed only when they share a port: a trunk, with a junction dot); an edge with no length fails. The router tries shifted inner runs and ports slid along the box side to meet these. `allowClose: '<reason>'` waives the first two when no layout can.
- **Drawn for every graph**: a hop (small half circle) where a horizontal wire crosses a vertical one (not connected), and a junction dot where wires from one port split (connected).
- **Tracing** (every graph): hovering or focusing a box lights its wires and the boxes at their other ends; hovering a wire lights it and its two ends. Nothing else fades or moves.
- **`wires: 'nets'`**: colour each wire by its source box, like the nets of a circuit (e.g. the full adder in inside-a-computer). Use it when several sources fan out into the same boxes; edges with their own `tone` keep it.
