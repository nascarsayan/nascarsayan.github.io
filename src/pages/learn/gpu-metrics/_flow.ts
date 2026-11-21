/**
 * One GPU counter from hardware to a PromQL answer, with illustrative
 * (made-up but realistic) values for GPU 4 on the example node gpu-node-1.
 * Every derived number on the page is computed here.
 */
export { energy as smi, energyOut as smiOut, avgWatts } from '../amd-gpu-tools/_sample';
import { energy as smi } from '../amd-gpu-tools/_sample';

/** One exporter scrape through the API server at 10:00:04.000 UTC (labels trimmed). */
export const scrapeAt = '10:00:04.000';
export const scrapeMs = Date.parse('2026-01-01T10:00:04.000Z');
export const scrapeMicroJ = 1.2000168e14;
export const scrapeOut = `# HELP gpu_energy_consumed Accumulated energy consumed by the GPU in uJ
gpu_energy_consumed{gpu_id="4",hostname="gpu-node-1",pod="llm-prefill-5d8f7c9b6-abcde",serial_number="SN-EXAMPLE-0005",…} 1.2000168e+14
gpu_package_power{gpu_id="4",hostname="gpu-node-1",…} 430
gpu_health{gpu_id="4",hostname="gpu-node-1",…} 1`;
export const scrapeJ = scrapeMicroJ / 1e6;
const f0 = (v: number) => Math.round(v).toLocaleString('en-US');
const f1 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const scrapeText = `1.2000168e+14 µJ ÷ 1,000,000 = ${f1(scrapeJ)} J. amd-smi read ${f1(smi[0].joules)} J at ${smi[0].t} and ${f1(smi[1].joules)} J at ${smi[1].t}; the scrape at ${scrapeAt} sits between them`;
export const scrapeBetween = scrapeJ > smi[0].joules && scrapeJ < smi[1].joules && scrapeMs > smi[0].ms && scrapeMs < smi[1].ms;

/** Raw samples from thanos-query: gpu_energy_consumed{…}[5m] and gpu_package_power{…}[5m] at T. */
export const T = 1767261600; // 2026-01-01T10:00:00Z
export const rangeSec = 300;
const E: [number, string][] = [[1767261305, '119888790000000'], [1767261317, '119888790000000'], [1767261347, '119900190000000'], [1767261377, '119912490000000'], [1767261407, '119925990000000'], [1767261437, '119937090000000'], [1767261467, '119947890000000'], [1767261497, '119959140000000'], [1767261527, '119971140000000'], [1767261557, '119982990000000'], [1767261587, '119994540000000']];
const P = [370, 370, 400, 640, 380, 350, 360, 390, 560, 380, 390];
/** What Thanos answered at T for the same series. */
export const thanos = { rate: 375000000, increase: 112500000000, avgPower: 417.27272727272725 };

const hms = (t: number) => new Date(t * 1000).toISOString().slice(11, 19);
export const samples = E.map(([t, v], i) => {
  const uj = Number(v);
  const prev = i ? E[i - 1] : null;
  const dJ = prev ? (uj - Number(prev[1])) / 1e6 : null;
  const dt = prev ? t - prev[0] : null;
  return { t: hms(t), j: f0(uj / 1e6), dJ: dJ === null ? '' : f0(dJ), dt: dt === null ? '' : dt.toFixed(1), w: dJ === null || dJ === 0 ? '—' : Math.round(dJ / dt!).toString(), p: P[i] };
});
const first = E[0], last = E[E.length - 1];
const delta = Number(last[1]) - Number(first[1]);
const span = last[0] - first[0];
const startGap = first[0] - (T - rangeSec), endGap = T - last[0];
const increase = (delta * rangeSec) / span; // gaps < 1.1 × average interval: Prometheus extrapolates to both window edges
export const calc = {
  deltaJ: f0(delta / 1e6), span: span.toFixed(3), startGap: startGap.toFixed(1), endGap: endGap.toFixed(1),
  increaseUJ: f0(increase), increaseJ: f0(increase / 1e6), rateW: (increase / rangeSec / 1e6).toFixed(1),
  thanosRateW: (thanos.rate / 1e6).toFixed(1), thanosIncrease: f0(thanos.increase),
  match: Math.abs(increase - thanos.increase) / thanos.increase < 1e-9,
  avgPower: (P.reduce((a, b) => a + b, 0) / P.length).toFixed(1), thanosAvgPower: thanos.avgPower.toFixed(1),
  pmin: Math.min(...P), pmax: Math.max(...P),
  wmin: Math.min(...samples.filter((x) => x.w !== '—').map((x) => Number(x.w))),
  wmax: Math.max(...samples.filter((x) => x.w !== '—').map((x) => Number(x.w))),
};
