/**
 * Prepared PromQL queries with illustrative (made-up but realistic) results for the
 * example cluster: 4 nodes × 8 MI355X = 32 GPUs.
 */
const H = ['gpu-node-1', 'gpu-node-2', 'gpu-node-3', 'gpu-node-4'];
const byHost = (vals: Record<string, number>) => H.map((h) => ({ label: h, value: vals[h] }));
export interface Query { id: string; label: string; q: string; rows: { label: string; value: number }[]; unit?: string; digits?: number; max?: number; read: string }

export const QUERIES: Query[] = [
  { id: 'gpus', label: 'GPUs reporting', q: 'count(count by (hostname, gpu_id) (gpu_health))', rows: [{ label: '(all)', value: 32 }], max: 32,
    read: 'One series per GPU: 4 nodes × 8 = 32, so every GPU reports. The expected number comes from inventory, not from Prometheus.' },
  { id: 'per-node', label: 'GPUs per node', q: 'count by (hostname) (gpu_health)', rows: byHost(Object.fromEntries(H.map((h) => [h, 8]))), max: 8,
    read: 'Eight on every node. Alert on `< 8`. After a fatal event this can stay 8: a frozen exporter keeps serving all eight.' },
  { id: 'health', label: 'Worst health', q: 'min by (hostname) (gpu_health)', rows: byHost(Object.fromEntries(H.map((h) => [h, 1]))), max: 1,
    read: '1 everywhere. `gpu_health` is computed from ECC counters, so it cannot see a fatal ATHUB event. It stays 1 through such an event.' },
  { id: 'temp', label: 'Hottest GPU', q: 'max by (hostname) (gpu_junction_temperature)', unit: '°C', max: 100,
    rows: byHost({ 'gpu-node-1': 50, 'gpu-node-2': 48, 'gpu-node-3': 52, 'gpu-node-4': 49 }),
    read: 'Bars are scaled to the 100 °C slowdown point. 48–52 °C is far from it. A busy day might peak around 75 °C.' },
  { id: 'power', label: 'Node power', q: 'sum by (hostname) (max by (hostname, gpu_id) (rate(gpu_energy_consumed[5m]))) / 1e6', unit: 'W', max: 11200,
    rows: byHost({ 'gpu-node-1': 2250.0, 'gpu-node-2': 2310.5, 'gpu-node-3': 2480.2, 'gpu-node-4': 2205.8 }),
    read: 'True average power of all 8 GPUs, from the energy counter (µJ/s ÷ 10⁶ = W). Bars are scaled to 8 × 1400 W. About 2.2–2.5 kW per node: mostly idle draw (8 × ~260 W) plus 1–3 busy engines.' },
  { id: 'busy', label: 'Busy GPUs', q: 'count by (hostname) (max by (hostname, gpu_id) (gpu_used_vram) > 10000)', max: 8,
    rows: byHost({ 'gpu-node-1': 2, 'gpu-node-2': 2, 'gpu-node-3': 3, 'gpu-node-4': 1 }),
    read: 'GPUs holding more than 10,000 MiB: N of 32. VRAM is the reliable "someone owns it" signal; activity % drops to 0 between requests.' },
  { id: 'ppt', label: 'Power-capped', q: 'max by (hostname) (gpu_violation_ppt_residency_percentage)', unit: '%', max: 100,
    rows: byHost({ 'gpu-node-1': 9, 'gpu-node-2': 0, 'gpu-node-3': 7, 'gpu-node-4': 0 }),
    read: 'Share of time a GPU was held below full clock by the 1400 W cap. 9 % and 7 % on two nodes with busy engines: normal under load, not a fault. Thermal residency above 0 would be a cooling problem.' },
  { id: 'fresh', label: 'Freshness', q: 'min by (hostname) (changes(gpu_energy_consumed[15m]))', max: 30,
    rows: byHost({ 'gpu-node-1': 29, 'gpu-node-2': 30, 'gpu-node-3': 29, 'gpu-node-4': 30 }),
    read: 'How often the slowest GPU on each node changed its energy value in 15 minutes: 29–30 times, once per 30-s scrape. A frozen exporter gives 0. The alert form is `changes(gpu_energy_consumed[15m]) == 0`, which returned nothing (good).' },
  { id: 'ecc', label: 'ECC, 7 days', q: 'sum(increase(gpu_ecc_correct_total[7d]))   and   sum(increase(gpu_ecc_uncorrect_total[7d]))', max: 1,
    rows: [{ label: 'correctable', value: 0 }, { label: 'uncorrectable', value: 0 }],
    read: 'No memory error of any kind on 32 GPUs in a week. The fleet is new; a background correctable rate will appear with age.' },
  { id: 'samples', label: 'Sample count', q: 'max(scrape_samples_scraped{job=~".*metrics-exporter.*"})', max: 2512,
    rows: [{ label: 'largest scrape', value: 2512 }],
    read: 'Samples in one exporter scrape (one node). A direct scrape returned about 2,500. After a fatal GPU event, hundreds of series can vanish: a drop against this baseline is an early, vendor-neutral signal.' },
];
const busy = QUERIES.find((x) => x.id === 'busy')!;
busy.read = busy.read.replace('N of 32', `${busy.rows.reduce((a, r) => a + r.value, 0)} of 32`);
const pw = QUERIES.find((x) => x.id === 'power')!.rows.map((r) => r.value);
const pq = QUERIES.find((x) => x.id === 'power')!;
pq.read = pq.read.replace('About 2.2–2.5 kW', `${(Math.min(...pw) / 1000).toFixed(1)}–${(Math.max(...pw) / 1000).toFixed(1)} kW`);
export const Q: Record<string, Query> = Object.fromEntries(QUERIES.map((x) => [x.id, x]));
