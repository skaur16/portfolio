// Narration for the voice notes, from ElevenLabs, with captions timed to the audio it returns.
// Reads tools/voice-notes.json, writes public/assets/audio/{note-N,bonus}.mp3 and src/data/captions.ts.
// Lines may carry audio tags such as [laughs] or [softly]: the v3 model acts on them, the captions never show them.
// Timings: the with-timestamps endpoint when the model offers it, otherwise forced alignment of the finished audio.
// Needs ELEVENLABS_API_KEY in .env. Optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL, ELEVENLABS_SPEED, _STABILITY, _STYLE.
// `pnpm voice 3` redoes only note 3; `pnpm voice whisper` makes the closing button's whisper.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\n]*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Set ELEVENLABS_API_KEY in .env (see .env.example).");
  process.exit(1);
}
const VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";
const SPEED = process.env.ELEVENLABS_SPEED ? Number(process.env.ELEVENLABS_SPEED) : undefined; // 0.7 (slowest) to 1.2
const STABILITY = Number(process.env.ELEVENLABS_STABILITY ?? 0.5); // v3: 0 creative, 0.5 natural, 1 robust
const STYLE = process.env.ELEVENLABS_STYLE ? Number(process.env.ELEVENLABS_STYLE) : undefined;
const only = process.argv[2];

const { notes } = JSON.parse(readFileSync(new URL("./voice-notes.json", import.meta.url), "utf8"));
const outDir = fileURLToPath(new URL("../public/assets/audio/", import.meta.url));
const captionsFile = new URL("../src/data/captions.ts", import.meta.url);
mkdirSync(outDir, { recursive: true });

const API = "https://api.elevenlabs.io/v1";
const clean = (line) => line.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();

async function tts(text, withTimestamps, settings) {
  const url = `${API}/text-to-speech/${VOICE}${withTimestamps ? "/with-timestamps" : ""}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 400)}`);
  if (withTimestamps) {
    const j = await res.json();
    return { audio: Buffer.from(j.audio_base64, "base64"), alignment: j.alignment ?? null };
  }
  return { audio: Buffer.from(await res.arrayBuffer()), alignment: null };
}

// the finished audio lined up against the words, character by character
async function forcedAlignment(audio, text) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "note.mp3");
  form.append("text", text);
  const res = await fetch(`${API}/forced-alignment`, { method: "POST", headers: { "xi-api-key": KEY }, body: form });
  if (!res.ok) throw new Error(`forced-alignment ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { characters: j.characters.map((c) => c.text), character_start_times_seconds: j.characters.map((c) => c.start) };
}

async function speak(text) {
  const settings = { stability: STABILITY, similarity_boost: 0.85, use_speaker_boost: true };
  if (STYLE !== undefined) settings.style = STYLE;
  if (SPEED !== undefined) settings.speed = SPEED;
  const attempts = [
    () => tts(text, true, settings),
    () => tts(text, true, { ...settings, speed: undefined }), // some models take no speed
    () => tts(text, false, settings),
    () => tts(text, false, { ...settings, speed: undefined }),
  ];
  let last;
  for (const go of attempts) {
    try { return await go(); } catch (err) { last = err; if (!/^4/.test(err.message)) throw err; }
  }
  throw last;
}

// [start, line, word offsets] for each line: `text` is what the alignment describes, with the lines inside it in order
function timings(text, lines, alignment) {
  const chars = alignment.characters, starts = alignment.character_start_times_seconds;
  const joined = chars.join("");
  if (joined !== text) throw new Error(`alignment covers different text (${joined.length} vs ${text.length} chars)`);
  let at = 0;
  return lines.map((line) => {
    const from = text.indexOf(line, at);
    if (from < 0) throw new Error(`line not found in text: ${line.slice(0, 40)}`);
    at = from + line.length;
    const words = clean(line).split(" ");
    let k = 0;
    const times = words.map((w) => {
      const i = line.indexOf(w, k);
      k = i + w.length;
      return starts[from + i];
    });
    const lineStart = times[0];
    return [Number(lineStart.toFixed(2)), clean(line), times.map((t) => Number(Math.max(0, t - lineStart).toFixed(2)))];
  });
}

const existing = existsSync(captionsFile) ? readFileSync(captionsFile, "utf8") : "";
const previous = existing.match(/= (\[[\s\S]*\]);/) ? eval(existing.match(/= (\[[\s\S]*\]);/)[1]) : [];
const captions = [];

if (only === "whisper") {
  const { audio } = await speak(process.env.WHISPER_TEXT || "[cheerfully] Hire me. Please. [laughs]");
  writeFileSync(`${outDir}talk-to-me.mp3`, audio);
  console.log('talk-to-me.mp3 written. Set site.whisper to "/assets/audio/talk-to-me.mp3".');
  process.exit(0);
}

for (let n = 0; n < notes.length; n++) {
  const name = n === notes.length - 1 ? "bonus" : `note-${n + 1}`;
  if (only && String(n + 1) !== only) {
    captions.push(previous[n] ?? []);
    continue;
  }
  const lines = notes[n];
  const text = lines.join("\n\n"); // a paragraph break between lines: room to breathe
  process.stdout.write(`${name}.mp3 (${MODEL}${SPEED !== undefined ? `, speed ${SPEED}` : ""}) ... `);
  let { audio, alignment } = await speak(text);
  writeFileSync(`${outDir}${name}.mp3`, audio);
  let timed;
  try {
    if (!alignment) throw new Error("no alignment returned");
    timed = timings(text, lines, alignment);
  } catch (err) {
    process.stdout.write(`aligning the audio (${err.message.split("(")[0].trim()}) ... `);
    const cleanLines = lines.map(clean), cleanText = cleanLines.join("\n\n");
    timed = timings(cleanText, cleanLines, await forcedAlignment(audio, cleanText));
  }
  captions.push(timed);
  console.log(`${timed.at(-1)[0] + (timed.at(-1)[2].at(-1) ?? 0) + 1 | 0}s, ${lines.length} lines`);
}

const body = captions.map((tape) => "  " + JSON.stringify(tape)).join(",\n");
writeFileSync(captionsFile, `// What is said in each voice note, as [start in seconds, line, when each word starts within the line].
// Generated by tools/gen-voice.mjs from tools/voice-notes.json; the timings come from ElevenLabs' alignment.
export const CAPTIONS: [number, string, number[]][][] = [
${body},
];
`);
console.log("wrote src/data/captions.ts");
