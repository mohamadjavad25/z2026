// Usage: node scripts/brand/avalai-image.mjs <out.png> <prompt.txt> [model] [ref1.png ...]
// Sends the prompt (+ reference images) to AvalAI's native Gemini endpoint and saves the first image.
// How the brand character is made: docs/brand/CHARACTER.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env.avalai.local');
const key = (fs.readFileSync(envFile, 'utf8').match(/^AVALAI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('No key in', envFile); process.exit(1); }

const [out, promptFile, model = 'gemini-3.1-flash-image-preview', ...refs] = process.argv.slice(2);
const prompt = fs.readFileSync(promptFile, 'utf8').trim();
const mime = (f) => (/\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/png');

const parts = [
  ...refs.map((f) => ({ inlineData: { mimeType: mime(f), data: fs.readFileSync(f).toString('base64') } })),
  { text: prompt },
];

const res = await fetch(`https://api.avalai.ir/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '1K' } },
  }),
});
const json = await res.json();
if (!res.ok) { console.error(res.status, JSON.stringify(json).slice(0, 800)); process.exit(1); }

const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
if (!img) { console.error('No image:', JSON.stringify(json).slice(0, 800)); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(img.inlineData.data, 'base64'));
console.log('saved', out, 'usage', JSON.stringify(json.usageMetadata || {}), 'cost', JSON.stringify(json.estimated_cost || ''));
