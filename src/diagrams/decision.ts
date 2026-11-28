/**
 * Decision trees: every road through a set of choices, taken or not, with what happened on each road.
 * Rendered by <DecisionTree> (components/content/DecisionTree.astro, scripts/decision.ts).
 *
 *   // _roads.decision.ts
 *   import { defineDecision } from '@/diagrams/decision';
 *   export default defineDecision({
 *     title: 'Chart version, API, labels, gates',
 *     levels: [{ key: 'version', title: 'Chart version' }, { key: 'api', title: 'Operator API' }],
 *     lenses: [{ id: 'spark', label: 'DGX Spark' }, { id: 'sim', label: 'pb002 sim' }],
 *     root: { id: 'app', label: 'NVIDIA GPU app', children: [
 *       { id: 'v1', label: 'v26.3.3', children: [
 *         { id: 'v1-gc', label: 'GPUCluster', blocked: 'needs v26.7.2' },
 *         { id: 'v1-cp', label: 'ClusterPolicy', runs: [{ id: 's0', lens: 'spark', outcome: 'works', title: '...' }] },
 *       ] },
 *     ] },
 *   });
 *
 * Depth d of the tree is level d-1 (the root is level-less). A node's outcome on a lens is its runs' outcome
 * (the best run on that lens); a branch shows how many roads below it end in each outcome. A road with no run
 * is "untested": a road not taken, shown, not hidden. `blocked` marks a road a dependency rules out.
 */

/** What happened on a road, best first. */
export const OUTCOMES = ['works', 'limited', 'sim-limited', 'expected', 'fails', 'untested', 'blocked'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  works: 'Works',
  limited: 'Works, a feature missing',
  'sim-limited': 'Works; the sim cannot show all',
  expected: 'Fails, as expected',
  fails: 'Fails',
  untested: 'Not run',
  blocked: 'Not possible',
};

/** A place the roads ran (a cluster, an environment). */
export interface Lens { id: string; label: string; note?: string }

/**
 * One choice: depth d+1 of the tree picks a value of level d. `about` and `options` (Markdown) fill the drawer
 * that the column head's info button opens: what the choice is, and what each option means and costs.
 */
export interface Level { key: string; title: string; about?: string; options?: { label: string; about: string }[] }

/** A finding a run's failed check points to. scope: real (holds on real hardware), sim, expected. */
export interface Finding { id: string; title: string; scope: 'real' | 'sim' | 'expected'; detail: string; fix?: string }

/** One run of one road on one lens. */
export interface Run {
  id: string;
  lens: string;
  outcome: Outcome;
  /** What this run did (one line). */
  title: string;
  /** Check id -> passed. */
  checks?: Record<string, boolean>;
  /** Failed check id -> finding id that explains it. */
  explained?: Record<string, string>;
  /** Extra settings of this run beyond the road (helm --set ...). */
  extra?: string[];
  /** Timestamped lines of a follow-up test (fault injection ...). */
  log?: { title: string; lines: string[] };
  at?: string;
}

export interface DNode {
  id: string;
  label: string;
  /** One short line under the label. */
  note?: string;
  /** Markdown shown in the detail pane. */
  about?: string;
  /** The road is ruled out; the reason (a dependency). Children are not allowed. */
  blocked?: string;
  runs?: Run[];
  children?: DNode[];
}

/**
 * A road to point out (the recommended one): its links from the root to the leaf are drawn a little thicker, in their
 * own colours, and a small tag follows the leaf.
 */
export interface Mark { id: string; leaf: string; label: string; note?: string }

export interface Decision {
  title: string;
  caption?: string;
  levels: Level[];
  lenses: Lens[];
  checks?: { id: string; title: string }[];
  findings?: Finding[];
  /** Usually one: the recommended road. */
  marks?: Mark[];
  /** Branch ids that start folded (a reader can still unfold them; a selected road inside is revealed). */
  folded?: string[];
  root: DNode;
}

export const defineDecision = (d: Decision): Decision => d;

const RANK = Object.fromEntries(OUTCOMES.map((o, i) => [o, i])) as Record<Outcome, number>;
export const best = (os: Outcome[]): Outcome | undefined => os.sort((a, b) => RANK[a] - RANK[b])[0];

/** A leaf's outcome on a lens. */
export const leafOutcome = (n: DNode, lens: string): Outcome =>
  n.blocked ? 'blocked' : best((n.runs ?? []).filter((r) => r.lens === lens).map((r) => r.outcome)) ?? 'untested';

/** Every leaf below (or at) n. */
export const leaves = (n: DNode): DNode[] => (n.children?.length ? n.children.flatMap(leaves) : [n]);

/** Build-time checks: unique ids, known lenses / checks / findings, depth = levels, blocked leaves. */
export function checkDecision(d: Decision): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const lenses = new Set(d.lenses.map((l) => l.id));
  const checks = new Set((d.checks ?? []).map((c) => c.id));
  const findings = new Set((d.findings ?? []).map((f) => f.id));
  const walk = (n: DNode, depth: number, path: string) => {
    const here = `${path}/${n.id}`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(n.id)) errs.push(`${here}: id must be lowercase letters, digits, dashes`);
    if (ids.has(n.id)) errs.push(`${here}: duplicate id`);
    ids.add(n.id);
    if (n.blocked && (n.children?.length || n.runs?.length)) errs.push(`${here}: a blocked road has no children or runs`);
    if (n.children?.length) {
      if (depth >= d.levels.length) errs.push(`${here}: deeper than the ${d.levels.length} levels`);
      if (n.runs?.length) errs.push(`${here}: runs belong on leaves`);
      n.children.forEach((c) => walk(c, depth + 1, here));
    } else if (depth !== d.levels.length && !n.blocked) {
      errs.push(`${here}: leaf at depth ${depth}, the levels need ${d.levels.length}`);
    }
    for (const r of n.runs ?? []) {
      if (!lenses.has(r.lens)) errs.push(`${here} run ${r.id}: unknown lens "${r.lens}"`);
      if (!(OUTCOMES as readonly string[]).includes(r.outcome)) errs.push(`${here} run ${r.id}: unknown outcome "${r.outcome}"`);
      for (const c of Object.keys(r.checks ?? {})) if (checks.size && !checks.has(c)) errs.push(`${here} run ${r.id}: unknown check "${c}"`);
      for (const [c, f] of Object.entries(r.explained ?? {})) {
        if (r.checks && r.checks[c] !== false) errs.push(`${here} run ${r.id}: explains "${c}", which did not fail`);
        if (!findings.has(f)) errs.push(`${here} run ${r.id}: unknown finding "${f}"`);
      }
    }
  };
  walk(d.root, 0, '');
  const nodes = new Map<string, DNode>();
  const index = (n: DNode) => { nodes.set(n.id, n); n.children?.forEach(index); };
  index(d.root);
  for (const m of d.marks ?? []) {
    const n = nodes.get(m.leaf);
    if (!n) errs.push(`mark ${m.id}: unknown leaf "${m.leaf}"`);
    else if (n.children?.length) errs.push(`mark ${m.id}: "${m.leaf}" is a branch, not a road`);
    else if (n.blocked) errs.push(`mark ${m.id}: "${m.leaf}" is not possible`);
  }
  return errs;
}
