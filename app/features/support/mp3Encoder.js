import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Turns the microphone's raw sound into an MP3 while it is being recorded. Voice notes are MP3 on every device because
 * it is the one format every phone can play, old iPhones included (they cannot play the WebM that Chrome and Android
 * record with MediaRecorder). 16kHz mono at 32kbps is clear for speech and about 240KB a minute.
 */

export const VOICE_SAMPLE_RATE = 16000;
const KBPS = 32;
const FRAME = 1152; // samples in one MP3 frame

export function createMp3Encoder(inputRate) {
  // Only ever downsample: a (rare) microphone slower than 16kHz is encoded at its own rate.
  const outRate = inputRate < VOICE_SAMPLE_RATE ? inputRate : VOICE_SAMPLE_RATE;
  const encoder = new Mp3Encoder(1, outRate, KBPS);
  const chunks = [];
  const pending = new Int16Array(FRAME);
  let filled = 0;
  let samples = 0;
  // Averaging decimator: every output sample is the mean of the input samples it covers (a simple low-pass, enough for voice).
  let phase = 0;
  let sum = 0;
  let count = 0;

  function emit(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    pending[filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    samples += 1;
    if (filled === FRAME) {
      const out = encoder.encodeBuffer(pending);
      if (out.length) chunks.push(new Uint8Array(out));
      filled = 0;
    }
  }

  return {
    /** Feeds one block of samples (Float32, -1..1) at `inputRate`. */
    push(block) {
      for (let i = 0; i < block.length; i += 1) {
        sum += block[i];
        count += 1;
        phase += outRate;
        if (phase >= inputRate) {
          phase -= inputRate;
          emit(sum / count);
          sum = 0;
          count = 0;
        }
      }
    },
    /** Milliseconds of sound fed so far. */
    durationMs: () => Math.round((samples / outRate) * 1000),
    /** Ends the file and returns its bytes. */
    finish() {
      if (filled) {
        const out = encoder.encodeBuffer(pending.subarray(0, filled));
        if (out.length) chunks.push(new Uint8Array(out));
        filled = 0;
      }
      const tail = encoder.flush();
      if (tail.length) chunks.push(new Uint8Array(tail));
      return chunks;
    }
  };
}
