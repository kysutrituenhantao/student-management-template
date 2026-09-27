/**
 * Tiny sounds made with WebAudio, so there are no audio files to load. Off unless the teacher turns sound on;
 * the choice is remembered on this device.
 */
const KEY = "lhhp-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode: sound simply stays off next time.
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.12) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

export function play(kind: "plus" | "minus" | "levelup" | "tick" | "win") {
  if (!soundOn() || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (kind === "plus") {
      tone(880, 0, 0.12, "triangle");
      tone(1320, 0.08, 0.18, "triangle");
    } else if (kind === "minus") {
      tone(330, 0, 0.18, "sine", 0.1);
    } else if (kind === "tick") {
      tone(1200, 0, 0.03, "square", 0.04);
    } else {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.25, "triangle"));
    }
  } catch {
    // No audio on this device.
  }
}
