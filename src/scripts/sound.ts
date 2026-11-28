/**
 * Soft, synthesized UI sounds (Web Audio — no audio files).
 *
 * Every voice runs through a shared chain that keeps things gentle:
 *   voice → master gain (quiet) → low-pass (rounds off harsh highs) → compressor → speakers
 * Voices use sine/triangle waves with a short attack ramp (no clicks) and
 * exponential decay. Sound starts muted unless the reader enabled it in
 * /settings/; state is mirrored on <html data-sound>.
 */
export type SoundKind =
  | 'menuOpen' | 'menuClose'      // nav dropdowns, dialogs
  | 'popUpOn' | 'popUpOff'        // toggles, tabs, segmented controls, play/pause
  | 'popDown'                     // small taps: pills, links, reset
  | 'plunger'                     // pressing a solid button
  | 'flap'                        // search opening (soft whoosh)
  | 'switchOn' | 'switchOff'      // theme toggle
  | 'soundOn' | 'soundOff'        // sound toggle itself
  | 'rise'                        // like button (pass a step for rising pitch)
  | 'bubble'                      // soft hover blip
  | 'risingPops'                  // three rising pops on hover (Read more, post cards)
  // Diagram packet flows (diagram-player.ts):
  | 'syn' | 'ack'                 // the request / the reply leaving a box
  | 'ok2xx' | 'c4xx' | 'c5xx'     // the answer that came back
  | 'tick' | 'timeout'            // a hang: the clock ticking, then running out
  | 'lost';                       // the request dropped on the wire

const MASTER_VOLUME = 0.32; // overall loudness, 0–1
const LOWPASS_HZ = 2600;    // lower = mellower

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volumeNode: GainNode | null = null;

/** Reader volume, 0–100 (% of the browser's output). Default 50; /settings/ stores it as 'sound-volume'. */
export const DEFAULT_VOLUME = 50;
let volume = DEFAULT_VOLUME;
export const getVolume = () => volume;
export function setVolume(pct: number) {
  volume = Math.max(0, Math.min(100, Math.round(pct)));
  if (volumeNode && ctx) volumeNode.gain.setValueAtTime(volume / 100, ctx.currentTime);
}
const lastPlayed = new Map<string, number>();

let enabled = false;
export const isSoundEnabled = () => enabled;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  document.documentElement.dataset.sound = on ? 'on' : 'off';
  window.dispatchEvent(new CustomEvent('sound-change', { detail: on }));
}

function out(): { ctx: AudioContext; dest: AudioNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LOWPASS_HZ;
    lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 4;
    volumeNode = ctx.createGain();
    volumeNode.gain.value = volume / 100;
    volumeNode.connect(ctx.destination);
    master.connect(lp).connect(comp).connect(volumeNode);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return { ctx, dest: master! };
}

type Tone = {
  from: number;          // start frequency (Hz)
  to?: number;           // end frequency (Hz); defaults to `from`
  dur: number;           // seconds
  gain?: number;         // per-voice peak (0–1, before master)
  type?: OscillatorType; // 'sine' | 'triangle'
  delay?: number;        // seconds from now
  attack?: number;       // seconds
  dest?: AudioNode;      // defaults to the master chain
};

function tone({ from, to = from, dur, gain = 0.5, type = 'sine', delay = 0, attack = 0.006, dest: target }: Tone) {
  const { ctx, dest: master } = out();
  const dest = target ?? master;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Direct pitch sweep straight to the speakers (the original theme-toggle sound). */
function rawSweep(from: number, to: number, dur: number, gain: number) {
  const { ctx } = out();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(volumeNode!);
  osc.start(t);
  osc.stop(t + dur);
}

/** Damped bubble: a sine whose pitch glides up fast, plus a faint second blip. */
function bubble() {
  const { ctx, dest } = out();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  lp.Q.value = 0.7;
  lp.connect(dest);
  const blip = (from: number, to: number, dur: number, gain: number, delay: number) => {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(lp);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  blip(210, 460, 0.11, 0.2, 0);
  blip(340, 640, 0.07, 0.06, 0.05);
}

/** Voices that can be cut short (e.g. hover sounds when the pointer leaves). */
const stoppable = new Map<SoundKind, GainNode>();

/** Fade out a stoppable sound that is still ringing. */
export function stopSound(kind: SoundKind) {
  const bus = stoppable.get(kind);
  if (!bus || !ctx) return;
  stoppable.delete(kind);
  const t = ctx.currentTime;
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  setTimeout(() => bus.disconnect(), 60);
}

/** Three quick pops, stopped early if the pointer leaves. */
function risingPops() {
  const { ctx, dest } = out();
  stopSound('risingPops');
  const bus = ctx.createGain();
  bus.connect(dest);
  stoppable.set('risingPops', bus);
  const pops: [number, number, number][] = [[620, 900, 0.22], [820, 1200, 0.38], [980, 1400, 0.42]];
  pops.forEach(([from, to, gain], i) =>
    tone({ from, to, dur: 0.075, gain, delay: i * 0.12, attack: 0.003, dest: bus }));
  setTimeout(() => stoppable.get('risingPops') === bus && stoppable.delete('risingPops'), 400);
}

/** Band-passed noise burst — the soft "flap" whoosh (rising), or falling for a lost packet. */
function whoosh(dur = 0.22, gain = 0.18, from = 500, to = 1400) {
  const { ctx, dest } = out();
  const t = ctx.currentTime;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(env).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/**
 * Play a UI sound. `step` (0–9) raises the pitch for `rise`.
 * `force` plays even when sounds are disabled (used to confirm toggling on).
 */
export function playSound(kind: SoundKind, opts: { step?: number; force?: boolean } | boolean = {}) {
  const { step = 0, force = false } = typeof opts === 'boolean' ? { force: opts } : opts;
  if (!force && !isSoundEnabled()) return;
  if (document.hidden) return;
  // Debounce identical sounds fired in rapid succession (e.g. hover jitter).
  const now = performance.now();
  if (now - (lastPlayed.get(kind) ?? 0) < 45) return;
  lastPlayed.set(kind, now);


  switch (kind) {
    case 'menuOpen':
      tone({ from: 392, to: 523, dur: 0.16, gain: 0.35 });
      return tone({ from: 784, dur: 0.12, gain: 0.08, delay: 0.03 });
    case 'menuClose':
      return tone({ from: 523, to: 392, dur: 0.14, gain: 0.22 });
    case 'popUpOn':
      return tone({ from: 520, to: 880, dur: 0.09, gain: 0.35 });
    case 'popUpOff':
      return tone({ from: 760, to: 440, dur: 0.1, gain: 0.32 });
    case 'popDown':
      return tone({ from: 620, to: 380, dur: 0.08, gain: 0.3 });
    case 'plunger':
      tone({ from: 220, to: 110, dur: 0.14, gain: 0.55, type: 'triangle', attack: 0.004 });
      return tone({ from: 660, to: 520, dur: 0.06, gain: 0.08, delay: 0.01 });
    case 'flap':
      return whoosh();
    // Theme toggle: the original sweep sounds, kept as-is (bypasses the softening chain).
    case 'switchOn':
      return rawSweep(500, 1000, 0.12, 0.1);
    case 'switchOff':
      return rawSweep(1000, 400, 0.12, 0.1);
    case 'soundOn':
      tone({ from: 523, dur: 0.1, gain: 0.3 });
      tone({ from: 659, dur: 0.1, gain: 0.28, delay: 0.07 });
      return tone({ from: 784, dur: 0.16, gain: 0.26, delay: 0.14 });
    case 'soundOff':
      tone({ from: 659, dur: 0.1, gain: 0.25 });
      return tone({ from: 440, dur: 0.16, gain: 0.25, delay: 0.07 });
    case 'bubble':
      return bubble();
    case 'risingPops':
      return risingPops();
    // Packet flows: quiet per-hop blips, clearer outcomes.
    case 'syn':
      return tone({ from: 700, to: 940, dur: 0.07, gain: 0.13 });
    case 'ack':
      return tone({ from: 620, to: 470, dur: 0.08, gain: 0.13, type: 'triangle' });
    case 'ok2xx':
      tone({ from: 659, dur: 0.09, gain: 0.24 });
      tone({ from: 831, dur: 0.09, gain: 0.22, delay: 0.07 });
      return tone({ from: 988, dur: 0.18, gain: 0.22, delay: 0.14 });
    case 'c4xx':
      tone({ from: 494, dur: 0.11, gain: 0.24, type: 'triangle' });
      return tone({ from: 440, dur: 0.16, gain: 0.24, type: 'triangle', delay: 0.13 });
    case 'c5xx':
      tone({ from: 392, to: 330, dur: 0.14, gain: 0.3, type: 'triangle' });
      tone({ from: 311, to: 247, dur: 0.22, gain: 0.3, type: 'triangle', delay: 0.14 });
      return tone({ from: 155, to: 124, dur: 0.3, gain: 0.12, type: 'triangle', delay: 0.14 });
    case 'tick':
      return tone({ from: 1500, dur: 0.025, gain: 0.07, attack: 0.002 });
    case 'timeout':
      tone({ from: 196, to: 110, dur: 0.32, gain: 0.45, type: 'triangle', attack: 0.004 });
      return tone({ from: 392, to: 220, dur: 0.12, gain: 0.08, delay: 0.01 });
    case 'lost':
      return whoosh(0.34, 0.16, 1500, 320);
    case 'rise': {
      const base = 420 * Math.pow(1.0595, Math.min(9, step) * 2); // whole-tone steps
      return tone({ from: base, to: base * 1.6, dur: 0.1, gain: 0.32 });
    }
  }
}

/** Any element can opt into a click sound with data-sound-click="popDown" etc. */
let wired = false;
export function initSoundClicks() {
  if (wired) return;
  wired = true;
  // Off unless the reader turned it on in /settings/ (localStorage 'sound' = 'on').
  let on = false;
  try { on = localStorage.getItem('sound') === 'on'; } catch { /* storage off */ }
  setSoundEnabled(on);
  let stored: string | null = null;
  try { stored = localStorage.getItem('sound-volume'); } catch { /* storage off */ }
  const n = stored === null ? NaN : Number(stored);
  setVolume(Number.isFinite(n) ? n : DEFAULT_VOLUME);
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-sound-click]') : null;
    if (el) playSound(el.dataset.soundClick as SoundKind);
  });
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-sound-hover]') : null;
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
    playSound(el.dataset.soundHover as SoundKind);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-sound-hover]') : null;
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
    stopSound(el.dataset.soundHover as SoundKind);
  });
}
