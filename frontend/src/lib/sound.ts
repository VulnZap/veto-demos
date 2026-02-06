let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol: number = 0.1,
  freqEnd?: number,
) {
  if (muted) return;
  const c = getCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

const sounds = {
  allow: () => tone(600, 0.06, "sine", 0.07, 900),
  deny: () => tone(150, 0.18, "triangle", 0.12, 90),
  alert: () => {
    tone(660, 0.08, "sine", 0.08);
    setTimeout(() => tone(880, 0.12, "sine", 0.08), 120);
  },
  click: () => tone(800, 0.03, "square", 0.05),
  boot: () => tone(440, 0.1, "sine", 0.04, 660),
} as const;

export type SoundName = keyof typeof sounds;

export function playSound(name: SoundName) {
  try {
    sounds[name]();
  } catch {
    // non-critical
  }
}

export function setMuted(v: boolean) {
  muted = v;
}

export function isMuted() {
  return muted;
}
