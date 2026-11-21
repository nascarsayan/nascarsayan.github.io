/**
 * Three RAS events traced through _event.diagram.ts: what each step lights up
 * and what each signal shows. Facts from the kernel RAS docs, amd-smi and the
 * amdgpu driver source.
 */
type Look = { tone?: string; detail?: string };
export interface EvStep { title: string; path?: string; focus?: string; state?: Record<string, Look>; text: string }
export interface Ev { id: string; label: string; steps: EvStep[]; signals: [string, string, 'good' | 'warn' | 'risk' | 'neutral'][] }
const future = { npd: { tone: 'muted', detail: 'only if you deploy rules' }, taint: { tone: 'muted', detail: 'only if configured' } };

export const EVENTS: Ev[] = [
  {
    id: 'ce', label: 'Correctable HBM error',
    steps: [
      { title: 'A bit flips; ECC fixes it', path: 'hbm => umc => aca => drv', state: { umc: { tone: 'good', detail: 'corrected: data is right' } }, text: 'A cosmic ray or a weak cell flips one bit. The UMC\'s ECC detects and fixes it on the read, and records the event in an ACA bank. The driver harvests the bank.' },
      { title: 'A counter moves', path: 'drv => cnt => exp', state: { cnt: { tone: 'good', detail: 'ce: 0 → 1' }, exp: { tone: 'good', detail: 'gpu_ecc_correct_umc +1' } }, text: 'The per-block correctable count goes up by one, and the exporter publishes it on the next scrape. Nothing else needs to happen: the program got the right data.' },
      { title: 'Nobody is paged', focus: 'npd, taint', state: { ...future, npd: { tone: 'muted', detail: 'correctable rule disabled' } }, text: 'A low background rate is normal. A rising rate is an early warning, worth a ticket and a trend graph, not a taint. A correctable-error rule, if any, should only report.' },
    ],
    signals: [['Program', 'unaffected', 'good'], ['gpu_ecc_correct_umc', '+1', 'neutral'], ['gpu_health', '1', 'good'], ['Bad pages', 'none', 'good'], ['Node', 'Ready, schedulable', 'good']],
  },
  {
    id: 'ue', label: 'Uncorrectable HBM error',
    steps: [
      { title: 'ECC cannot fix it', path: 'hbm => umc => aca => drv', state: { umc: { tone: 'warn', detail: 'uncorrectable: data is wrong' } }, text: 'Two or more bits in one word flipped. ECC detects it but cannot repair it. With poison on (POISON_SCHEMA: ENABLED on MI355X), the data is marked poisoned: nothing fails until something reads it.' },
      { title: 'Record it, retire the row', path: 'drv => eeprom', state: { eeprom: { tone: 'warn', detail: '+16 pages retired' } }, text: 'The driver retires the bad HBM row (16 pages) and writes the addresses to the board EEPROM, so the memory is never handed out again, even after a reboot.' },
      { title: 'Counters, CPER, kernel log', path: 'drv => cper', focus: 'drv -> cnt, cnt, drv -> klog, klog', state: { cnt: { tone: 'warn', detail: 'ue: 0 → 1' }, cper: { tone: 'warn', detail: 'record for AMD support' }, klog: { tone: 'warn', detail: 'bad page / poison lines' } }, text: 'The uncorrectable count moves, a CPER record is built from the bank data (amd-smi ras --cper, then --afid for AMD), and the kernel log reports the page and poison handling.' },
      { title: 'The process that read it dies', path: 'cnt => exp => npd', state: { exp: { tone: 'warn', detail: 'gpu_ecc_uncorrect_umc +1' }, npd: { tone: 'muted', detail: 'report, do not taint' }, taint: { tone: 'muted', detail: 'no taint until page 129' } }, text: 'If a kernel consumes the poisoned data, its process is killed. The GPU keeps working with 16 pages less memory. A sensible policy reports HBM errors without tainting, and tainting only when the bad-page budget is spent.' },
    ],
    signals: [['Program', 'killed if it reads the bad data', 'warn'], ['gpu_ecc_uncorrect_umc', '+1', 'warn'], ['Bad pages', '+16 (one row)', 'warn'], ['CPER / AFID', 'yes', 'neutral'], ['Node', 'Ready; taint only past 128 pages', 'neutral']],
  },
  {
    id: 'fatal', label: 'Fatal ATHUB event',
    steps: [
      { title: 'One status bit, no triage', path: 'fed => drv', state: { fed: { tone: 'risk', detail: 'latched' }, drv: { tone: 'risk', detail: 'marks FATAL, no block id' } }, text: 'On MI300/MI350 the fatal interrupt never arrives as a normal interrupt. After every interrupt the driver polls one status bit. If it is set, the error is FATAL. No bank is harvested, so nobody learns which block failed.' },
      { title: 'MODE1: the whole hive resets', path: 'drv => hive', state: { hive: { tone: 'risk', detail: 'all 8 reset, VRAM lost' } }, text: 'The driver sets Fatal-Error-Detected on every GPU in the hive and resets all eight within about a second. Every process on every GPU dies. If the PSP does not come back, the GPUs stay dead (-62) until power is removed.' },
      { title: 'Only the kernel log knows', path: 'drv => klog => npd => taint', state: { klog: { tone: 'risk', detail: 'RAS Intr triggered, repeating' }, npd: { tone: 'muted', detail: 'kernel-log rule: seconds' }, taint: { tone: 'muted', detail: 'taint, if configured' } }, text: 'The kernel log shows RAS Intr triggered thousands of times. A kernel-log rule catches it within seconds of onset. That rule is the only detector that works for this event.' },
      { title: 'Everything else stays green', focus: 'cnt, cper, exp, eeprom', state: { cnt: { tone: 'muted', detail: 'no counter moves' }, cper: { tone: 'muted', detail: 'no record, no AFID' }, exp: { tone: 'warn', detail: 'gpu_health = 1' }, eeprom: { tone: 'muted', detail: 'no page retired' } }, text: 'No ECC counter moves (there is no ATHUB counter), no CPER is written, no page is retired, and gpu_health stays 1. A dashboard built on counters shows a healthy node with eight dead GPUs.' },
    ],
    signals: [['Program', 'every process on all 8 GPUs dies', 'risk'], ['Kernel log', 'RAS Intr triggered, GPU reset begin', 'risk'], ['ECC counters', 'unchanged', 'warn'], ['CPER / AFID', 'none', 'warn'], ['gpu_health', '1 (wrong)', 'warn'], ['Node', 'Ready, untainted unless a kernel-log rule exists', 'risk']],
  },
];
