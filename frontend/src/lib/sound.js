/**
 * Carbon & Whale Sound System
 * Pure Web Audio API procedural sound engine — zero network latency,
 * zero external audio files, works completely offline with pristine studio clarity.
 */

let audioCtx = null;
let soundEnabled = true;

// Load persisted preference if available
try {
  const saved = localStorage.getItem("cw_sound_enabled");
  if (saved !== null) {
    soundEnabled = saved === "true";
  }
} catch {}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock Web Audio context on the first user interaction (required by iOS Safari and modern browsers)
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
}

export const sound = {
  isEnabled() {
    return soundEnabled;
  },

  toggle() {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem("cw_sound_enabled", String(soundEnabled));
    } catch {}
    if (soundEnabled) sound.click();
    return soundEnabled;
  },

  setEnabled(val) {
    soundEnabled = !!val;
    try {
      localStorage.setItem("cw_sound_enabled", String(soundEnabled));
    } catch {}
  },

  /**
   * Tactile Micro-Click: Gentle, crisp micro-tap for buttons and navigation
   */
  click() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.035);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {}
  },

  /**
   * Success Chime: Warm, uplifting two-note bell chime (E5 -> A5)
   */
  success() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { f: 659.25, start: 0, dur: 0.28, vol: 0.08 }, // E5
        { f: 880.0, start: 0.09, dur: 0.38, vol: 0.1 },  // A5
      ];

      notes.forEach(({ f, start, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + start);

        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch {}
  },

  /**
   * Upload Sound: Ascending airy shimmer when file processing starts/completes
   */
  upload() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  },

  /**
   * Sign In / Sign Up Welcome: Rich, harmonic ambient chord (Eb4 -> Bb4 -> Eb5)
   */
  authSuccess() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [
        { f: 311.13, delay: 0.0, dur: 0.65, vol: 0.08 },  // Eb4
        { f: 466.16, delay: 0.07, dur: 0.75, vol: 0.09 }, // Bb4
        { f: 622.25, delay: 0.14, dur: 0.9, vol: 0.11 },  // Eb5
        { f: 932.33, delay: 0.22, dur: 1.0, vol: 0.07 },  // Bb5
      ];

      chords.forEach(({ f, delay, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + delay);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(vol, now + delay + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + dur);
      });
    } catch {}
  },

  /**
   * Notification Sound: Soft crystal glass ping (C6 chime)
   */
  notification() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now); // C6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  },

  /**
   * Refresh / Page Reload: Gentle aquatic ripple ping before window reload
   */
  refresh() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  },

  /**
   * Warning / Error Sound: Soft double-tone thud
   */
  warning() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [
        { f: 260, start: 0, dur: 0.09 },
        { f: 210, start: 0.1, dur: 0.12 },
      ].forEach(({ f, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + start);

        gain.gain.setValueAtTime(0.06, now + start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch {}
  },
};

export default sound;
