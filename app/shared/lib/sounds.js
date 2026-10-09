// App sounds, synthesised with Web Audio (no audio files to ship or cache).
// Use playSound(name); the on/off switch is a per-device preference (see useSoundPreference).

const STORAGE_KEY = "frfro_sound_enabled";
const CHANGE_EVENT = "frfro:sound-pref";

let ctx = null;
let master = null;
let lastPlayedAt = 0;

export function isSoundEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // preference just doesn't persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSoundPreference(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function audioContext() {
  const AudioCtor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtor) return null;
  if (!ctx) {
    ctx = new AudioCtor();
    const compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Browsers only allow audio after a tap: unlock the context on the first one. */
export function unlockSounds() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    audioContext();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function tone(freq, t, dur, { type = "sine", gain = 0.3, attack = 0.006, slideTo = null } = {}) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Inharmonic partials give a glassy bell ring.
function bell(freq, t, dur, gain = 0.28) {
  [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.93, 0.08]].forEach(([ratio, level], i) => {
    tone(freq * ratio, t, dur / (1 + i * 0.7), { gain: gain * level, attack: 0.003 });
  });
}

function mallet(freq, t, dur, gain = 0.34) {
  tone(freq, t, dur, { gain, attack: 0.002 });
  tone(freq * 4, t, dur * 0.18, { gain: gain * 0.35, attack: 0.002 });
}

function noise(t, dur, { freq = 3000, gain = 0.3, q = 1.2, type = "bandpass" } = {}) {
  const frames = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  source.buffer = buffer;
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  g.gain.value = gain;
  source.connect(filter);
  filter.connect(g);
  g.connect(master);
  source.start(t);
}

const N = { E4: 329.63, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, B5: 987.77, C6: 1046.5, G6: 1568, B6: 1975.5, E6: 1318.5 };

const SOUNDS = {
  // general notification
  notify: (t) => { mallet(N.G5, t, 0.35); mallet(N.C6, t + 0.11, 0.5); },
  // a new booking request (salon / artist)
  request: (t) => {
    [N.C5, N.E5, N.G5].forEach((f, i) => bell(f, t + i * 0.11, 0.8, 0.24));
    bell(N.C6, t + 0.36, 1.2, 0.22);
  },
  // booking confirmed (client)
  confirmed: (t) => { bell(N.E6, t, 0.8, 0.2); bell(N.G6, t + 0.12, 0.8, 0.2); bell(N.B6, t + 0.24, 1.4, 0.22); },
  cancelled: (t) => { mallet(N.G5, t, 0.4, 0.3); mallet(N.E5, t + 0.15, 0.55, 0.3); },
  expired: (t) => {
    noise(t, 0.05, { freq: 2600, gain: 0.5 });
    noise(t + 0.22, 0.05, { freq: 1800, gain: 0.5 });
    tone(330, t + 0.5, 0.5, { gain: 0.2, slideTo: 247 });
  },
  // upcoming-appointment alarm: three pulses
  alarm: (t) => {
    for (let i = 0; i < 3; i += 1) {
      bell(N.C6, t + i * 0.75, 0.6, 0.3);
      bell(N.E6, t + i * 0.75 + 0.18, 0.6, 0.26);
    }
  },
  saved: (t) => { mallet(N.C6, t, 0.18, 0.26); mallet(N.G6, t + 0.08, 0.3, 0.26); },
  error: (t) => {
    tone(311, t, 0.18, { gain: 0.3, type: "triangle" });
    tone(233, t + 0.17, 0.3, { gain: 0.3, type: "triangle" });
  },
  // team invite / collaboration offer
  invite: (t) => {
    [N.C5, N.E5, N.G5].forEach((f) => mallet(f, t, 0.6, 0.2));
    [N.D5, N.G5, N.B5].forEach((f) => mallet(f, t + 0.25, 0.9, 0.2));
  },
  // client just sent a booking request
  submit: (t) => { mallet(N.E5, t, 0.2, 0.3); mallet(N.B5, t + 0.1, 0.4, 0.3); }
};

/**
 * Plays one of the sounds above. Silent when the user turned sounds off, when the browser
 * has not unlocked audio yet, and when another sound just played (a toast right after a
 * dedicated sound would otherwise double up).
 */
export function playSound(name) {
  const make = SOUNDS[name];
  if (!make || typeof window === "undefined" || !isSoundEnabled()) return;
  const now = Date.now();
  if (name !== "alarm" && now - lastPlayedAt < 700) return;
  const context = audioContext();
  if (!context) return;
  const start = () => {
    lastPlayedAt = Date.now();
    try {
      make(context.currentTime + 0.03);
    } catch {
      // a failed beep must never break the app
    }
  };
  if (context.state === "running") {
    start();
  } else if (context.state === "suspended") {
    // Resumes only after a user gesture; before that the promise stays pending and nothing plays.
    const requestedAt = now;
    context.resume().then(() => {
      // A beep from long ago would be confusing when the first tap finally unlocks audio.
      if (context.state === "running" && Date.now() - requestedAt < 2000) start();
    }).catch(() => {});
  }
}
