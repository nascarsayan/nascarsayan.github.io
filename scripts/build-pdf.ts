// Build + lint for the one-page resume PDF. Source: resume/index.html (its print stylesheet is the
// one-page, ATS-friendly CV; keep its wording in sync with src/pages/index.mdx). Output:
// public/about/resume.pdf, committed and served as-is. CI runs --check; visitors just download the PDF.
//
//   bun scripts/build-pdf.ts          build public/about/resume.pdf, then lint
//   bun scripts/build-pdf.ts --check  lint only (fails on any rule)
//
// Metadata: every PDF Info entry except /Title is blanked after printing.
//
// Rules
//   pdf.pages      exactly one A4 page
//   pdf.fill       text reaches >= FILL_MIN of the printable height (no dead space)
//   pdf.margins    no glyph crosses the side/bottom margins
//   pdf.linefill   every line of a wrapped paragraph/bullet (and any one-line sentence) fills
//                  >= LINE_MIN of its width; rephrase or merge instead of leaving a stub line
//   pdf.scale      the auto-fit scale stays in [SCALE_MIN, SCALE_MAX]; below the floor the
//                  text gets too small to read, so trim content instead
//   web.overflow   nothing spills sideways at phone / tablet / desktop widths
//   pdf.meta       the committed PDF carries no Info metadata except Title
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dir, "..");
const PAGE = pathToFileURL(join(ROOT, "resume", "index.html")).href;
const OUT = join(ROOT, "public", "about", "resume.pdf");
const SCALE_FILE = join(ROOT, "resume", "pdf-scale.txt");

const SCALE_MIN = 0.9;   // ~8.3pt body text
const SCALE_MAX = 1.2;   // ~11pt body; beyond this the page looks shouty
const FILL_MIN = 0.97;
const LINE_MIN = 0.85;
const MM = 72 / 25.4;
const MARGIN = { y: 11 * MM, x: 13 * MM }; // keep in sync with @page in resume/index.html
const WIDTHS = [360, 768, 1280];

const CHROME = process.env.CHROME ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(existsSync) ?? Bun.which("chrome-headless-shell") ?? undefined;
if (!CHROME) die("Chrome not found; set CHROME=/path/to/chrome");

// Use poppler's pdftotext (sits next to pdfinfo); xpdf's lacks -bbox.
const PDFINFO = Bun.which("pdfinfo") ?? die("pdfinfo not found; install poppler-utils");
const PDFTOTEXT = [join(PDFINFO, "..", "pdftotext.exe"), join(PDFINFO, "..", "pdftotext")].find(existsSync) ?? "pdftotext";

const tmp = mkdtempSync(join(tmpdir(), "resume-"));
const run = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return p.stdout.toString();
};
const chrome = (...args: string[]) =>
  run([CHROME!, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=8000", ...args]);

function render(scale: number, file: string) {
  chrome("--no-pdf-header-footer", `--print-to-pdf=${file}`, `${PAGE}?pdfscale=${scale.toFixed(3)}`);
  if (!existsSync(file)) die("Chrome produced no PDF");
}
const pages = (file: string) => Number(/Pages:\s+(\d+)/.exec(run([PDFINFO, file]))?.[1] ?? 0);

function measure(file: string) {
  const info = run([PDFINFO, file]);
  const [, w, h] = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info)!.map(Number);
  const words = [...run([PDFTOTEXT, "-bbox", file, "-"]).matchAll(
    /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g,
  )].map(m => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: m[5] }));
  const bottom = Math.max(...words.map(w => w.y1));
  return {
    w, h, words,
    fill: (bottom - MARGIN.y) / (h - 2 * MARGIN.y),
    outside: words.filter(o => o.x0 < MARGIN.x - 1 || o.x1 > w - MARGIN.x + 1 || o.y1 > h - MARGIN.y + 1),
  };
}

// Largest scale that fits one page inside the margins (binary search; both are monotonic in scale).
function fit(): number {
  const probe = join(tmp, "probe.pdf");
  let lo = 0.7, hi = SCALE_MAX + 0.05;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    render(mid, probe);
    if (pages(probe) === 1 && measure(probe).outside.length === 0) lo = mid; else hi = mid;
    rmSync(probe, { force: true });
  }
  return Math.min(Math.floor(lo * 1000) / 1000, SCALE_MAX);
}

// Lines grouped by paragraph block, from poppler's -bbox-layout.
function lines(file: string, w: number) {
  const xml = run([PDFTOTEXT, "-bbox-layout", file, "-"]);
  const right = w - MARGIN.x;
  return [...xml.matchAll(/<block[^>]*>([\s\S]*?)<\/block>/g)].map(b =>
    [...b[1].matchAll(/<line xMin="([\d.]+)"[^>]*xMax="([\d.]+)"[^>]*>([\s\S]*?)<\/line>/g)].map(l => {
      const text = [...l[3].matchAll(/>([^<]*)<\/word>/g)].map(x => x[1]).join(" ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      return { text, fill: (+l[2] - +l[1]) / (right - +l[1]) };
    }));
}

function lintWeb(): string[] {
  const errs: string[] = [];
  for (const w of WIDTHS) {
    const dom = chrome("--dump-dom", "--allow-file-access-from-files", "--window-size=1400,900", `${PAGE}?lint=${w}`);
    const m = /<meta id="lint" content="([^"]*)"/.exec(dom);
    if (!m) { errs.push(`web.overflow @${w}px: lint hook did not run`); continue; }
    for (const e of JSON.parse(decodeURIComponent(m[1]))) errs.push(`web.overflow @${w}px: ${e}`);
  }
  return errs;
}

let proseCache: any;
function lintPdf(scale: number, file = OUT, quiet = false): string[] {
  const errs: string[] = [];
  const n = pages(file);
  if (n !== 1) errs.push(`pdf.pages: ${n} pages, want 1`);
  const meta = [...run([PDFINFO, file]).matchAll(/^(Creator|Producer|CreationDate|ModDate|Author|Subject|Keywords):/gm)].map(x => x[1]);
  if (meta.length && file === OUT) errs.push(`pdf.meta: ${meta.join(', ')} present; only Title may stay`);
  if (scale < SCALE_MIN) errs.push(`pdf.scale: needs ${scale} to fit (< ${SCALE_MIN}); too much content, trim something`);
  const m = measure(file);
  if (m.fill < FILL_MIN) errs.push(`pdf.fill: ${(m.fill * 100).toFixed(1)}% of page used, want >= ${FILL_MIN * 100}%; add content or raise SCALE_MAX`);
  for (const o of m.outside.slice(0, 5)) errs.push(`pdf.margins: "${o.t}" at (${o.x1.toFixed(0)}, ${o.y1.toFixed(0)})`);
  const prose = proseCache ??= JSON.parse(decodeURIComponent(
    /<meta id="prose" content="([^"]*)"/.exec(chrome("--dump-dom", `${PAGE}?prose=1`))?.[1] ?? "%7B%7D"));
  // Attribute each PDF line to the page element whose text contains it.
  const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  const els = [...(prose.all ?? []).map((t: string) => ({ t: norm(t), wrapOnly: false })),
               ...(prose.wrapped ?? []).map((t: string) => ({ t: norm(t), wrapOnly: true }))];
  const owned = new Map<number, { text: string; fill: number }[]>();
  const labels = new Set((prose.labels ?? []).map(norm));
  for (const l of lines(file, m.w).flat()) {
    if (labels.has(norm(l.text))) continue;
    const i = els.findIndex(e => norm(l.text).length > 2 && e.t.includes(norm(l.text)));
    if (i >= 0) owned.set(i, [...(owned.get(i) ?? []), l]);
  }
  for (const [i, ls] of owned) {
    if (els[i].wrapOnly && ls.length < 2) continue;
    for (const l of ls)
      if (l.fill < LINE_MIN) errs.push(`pdf.linefill: ${(l.fill * 100).toFixed(0)}% "${l.text.slice(0, 60)}"`);
  }
  if (!quiet) console.log(`pdf: ${n} page, scale ${scale}, fill ${(m.fill * 100).toFixed(1)}%`);
  return quiet ? errs.concat(m.fill < FILL_MIN ? ["stop"] : []) : errs;
}

// Blank every Info-dict entry except /Title, in place (same byte length, so the xref table stays valid).
function stripMetadata(file: string) {
  const b = Buffer.from(readFileSync(file).toString("latin1")
    .replace(/\/(Creator|Producer|CreationDate|ModDate|Author|Subject|Keywords)\s*\((?:\\.|[^\\)])*\)/g, (m) => " ".repeat(m.length)), "latin1");
  if (b.includes("/Metadata")) die("PDF has an XMP metadata stream; cannot strip it in place");
  writeFileSync(file, b);
}

function die(msg: string): never { console.error(msg); process.exit(1); }

const checkOnly = process.argv.includes("--check");
let scale: number;
if (checkOnly) {
  scale = Number(readFileSync(SCALE_FILE, "utf8"));
} else {
  // Largest one-page scale, then step down until every line-fill rule passes too
  // (re-wrapping at a slightly smaller size usually fixes stub lines without rewording).
  const top = fit();
  const probe = join(tmp, "step.pdf");
  scale = top;
  for (let s = top; s >= SCALE_MIN; s = Math.round((s - 0.004) * 1000) / 1000) {
    render(s, probe);
    const e = lintPdf(s, probe, true);
    if (e.length === 0) { scale = s; break; }
    if (e.includes("stop")) break; // page no longer full enough; smaller only gets worse
  }
  render(scale, OUT);
  stripMetadata(OUT);
  writeFileSync(SCALE_FILE, `${scale}\n`);
}
const errs = [...lintPdf(scale), ...lintWeb()];
rmSync(tmp, { recursive: true, force: true });
if (errs.length) die("lint failed:\n  " + errs.join("\n  "));
console.log("lint ok");
