"use client";

// Sound effects for trade execution — uses Web Audio API (no files needed)

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  return audioContext;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume: number = 0.15) {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const sounds = {
  // Success sound — ascending two-tone (trade opened profitably)
  success() {
    playTone(523.25, 0.15, "sine", 0.12); // C5
    setTimeout(() => playTone(659.25, 0.2, "sine", 0.12), 120); // E5
  },

  // Error sound — descending tone (trade rejected)
  error() {
    playTone(440, 0.15, "square", 0.08); // A4
    setTimeout(() => playTone(330, 0.2, "square", 0.08), 120); // E4
  },

  // Buy sound — rising pitch
  buy() {
    playTone(440, 0.1, "sine", 0.1);
    setTimeout(() => playTone(554.37, 0.1, "sine", 0.1), 80);
    setTimeout(() => playTone(659.25, 0.15, "sine", 0.1), 160);
  },

  // Sell sound — falling pitch
  sell() {
    playTone(659.25, 0.1, "sine", 0.1);
    setTimeout(() => playTone(554.37, 0.1, "sine", 0.1), 80);
    setTimeout(() => playTone(440, 0.15, "sine", 0.1), 160);
  },

  // Notification — short ping
  notification() {
    playTone(880, 0.1, "sine", 0.08);
  },

  // Alert — double ping
  alert() {
    playTone(880, 0.08, "sine", 0.08);
    setTimeout(() => playTone(880, 0.08, "sine", 0.08), 150);
  },
};