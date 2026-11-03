// Voice for the «کنسلی» reel, made with AvalAI.
// Key: AVALAI_API_KEY from the environment, or from .env.avalai.local at the repo root. Never print it.
// Try voices on one line:  node voice/tts.mjs try
// Make every line:         node voice/tts.mjs all <clientVoice> <frfroVoice>   e.g. gemini:Leda gemini:Aoede  or  openai:nova
// Writes 48 kHz mono WAVs into voice/out/<line>.wav
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '../../../../../../.env.avalai.local');
const key = process.env.AVALAI_API_KEY || (fs.existsSync(envFile) && (fs.readFileSync(envFile, 'utf8').match(/^AVALAI_API_KEY=(.+)$/m) || [])[1]?.trim());
if (!key) { console.error('No AVALAI_API_KEY'); process.exit(1); }
const lines = JSON.parse(fs.readFileSync(path.join(here, 'lines.json'), 'utf8'));
const out = path.join(here, 'out'); fs.mkdirSync(out, { recursive: true });
const STYLE = {
  client: 'Speak in Persian (Farsi, Tehran accent). A young woman sending a casual voice note to her nail artist, a little embarrassed and apologetic, soft, natural, not acted.',
  frfro: 'Speak in Persian (Farsi, Tehran accent). A young woman, warm and sure, with a smile in the voice, like a caring colleague giving a friendly tip. Natural conversational pace, not an advert, not robotic.',
};
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-goog-api-key': key };
const toWav = (inFile, args, dst) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-i', inFile, '-ac', '1', '-ar', '48000', dst]);
async function say(spec, style, text, dst) {
  const [kind, voice] = spec.split(':'); const tmp = dst + '.raw';
  if (kind === 'openai') {
    const r = await fetch('https://api.avalai.ir/v1/audio/speech', { method: 'POST', headers: H,
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, instructions: STYLE[style], response_format: 'wav' }) });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 400)}`);
    fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer())); toWav(tmp, [], dst);
  } else {
    const model = 'gemini-2.5-pro-preview-tts';
    const r = await fetch(`https://api.avalai.ir/v1beta/models/${model}:generateContent`, { method: 'POST', headers: H,
      body: JSON.stringify({ contents: [{ parts: [{ text: `${STYLE[style]}\nSay exactly this, nothing else:\n${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }) });
    const j = await r.json(); if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 400)}`);
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData); if (!part) throw new Error('no audio ' + JSON.stringify(j).slice(0, 300));
    fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, 'base64')); toWav(tmp, ['-f', 's16le', '-ar', '24000', '-ac', '1'], dst);
  }
  fs.rmSync(tmp); console.log('saved', path.basename(dst));
}
const [mode, cv, fv] = process.argv.slice(2);
if (mode === 'try') {
  for (const v of ['gemini:Leda', 'gemini:Aoede', 'gemini:Kore', 'gemini:Zephyr', 'openai:nova', 'openai:shimmer', 'openai:coral'])
    await say(v, 'frfro', lines.charN.text, path.join(out, `try-${v.replace(':', '-')}.wav`)).catch((e) => console.error(v, e.message));
} else if (mode === 'all') {
  for (const [id, l] of Object.entries(lines)) await say(l.voice === 'client' ? cv : fv, l.voice, l.text, path.join(out, `${id}.wav`));
} else { console.error('usage: try | all <clientVoice> <frfroVoice>'); process.exit(1); }
