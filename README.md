# skaur.dev

Sharn's portfolio: a cassette you wind with a pencil, a reel of film that runs the length of the page, eight voice notes and a bonus track, a deck that clicks and whirs. Built with [Astro](https://astro.build) and [Three.js](https://threejs.org), served as static files from Cloudflare.

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # writes dist/
pnpm preview    # serves dist/
pnpm deploy     # astro build && wrangler deploy  (needs `wrangler login` once)
```

## Where everything lives

| What | Where |
| --- | --- |
| Name, status, location, email, links, cassette label, video id | `src/data/site.ts` |
| The nine tapes: titles, one-liners, covers, audio file names | `src/data/stories.ts` |
| What each voice note says | `tools/voice-notes.json` (the words), `src/data/captions.ts` (the words with timings; generated) |
| The project deck | `src/data/posts.ts` |
| Hero, featured, about, closer and footer copy | `src/components/*.astro` |
| Styles, one file, as the original | `src/styles/global.css` |
| The player, the reel of film, the scroll, the sounds | `src/scripts/site.js` |
| The 3D cassette and pencil | `src/scripts/cassette3d.js` |
| Pictures and sounds | `public/assets/` |

## The voice notes

The notes are narrated by ElevenLabs from `tools/voice-notes.json`, and the captions on the back of each card are timed from the alignment it returns, so words light up as they are spoken.

```sh
cp .env.example .env     # put ELEVENLABS_API_KEY in it (and a cloned ELEVENLABS_VOICE_ID, ideally)
pnpm voice               # all nine notes -> public/assets/audio/*.mp3 + src/data/captions.ts
pnpm voice 3             # only note 3
pnpm voice whisper       # the closing button's line ("Hire me. Please." with a laugh); WHISPER_TEXT="..." changes the words
```

The pace is set in `.env`: `ELEVENLABS_SPEED` (0.7 slowest to 1.2; 0.86 now), `ELEVENLABS_STABILITY` (0.62) and `ELEVENLABS_STYLE` (0.12). Lower speed and higher stability read calmer; rerun `pnpm voice` after changing them. A cloned voice in `ELEVENLABS_VOICE_ID` is what the notes use now.

To record them yourself instead: keep the file names from `stories.ts`, keep the lines in `voice-notes.json` in step with what you say, and adjust the timings in `captions.ts` by ear. Until the audio exists, "Hear it" falls back to opening the words.

## The pictures

Everything under `public/assets` was drawn by `tools/gen-assets.py` (`pnpm assets`, needs Pillow) so that nothing here is anyone's photo. Replace any file with a real one and keep its size:

- `cover/*.jpg` 1400×875 (the plates; `waterloo.jpg` is 1400×1050), `cut/*.webp` transparent cut-outs that stand on the covers
- `reel/strip.webp` 3780×1260: a contact sheet of 67 frames, 10 across, 378×180 each; this is the film
- `posts/*.jpg` 720×1280, one per project; `cut/github.webp` and `cut/linkedin.webp` 300×300 for the chips
- `img/stamp.webp` 729×800 (the small stamped photo), `p/polaroid.webp` 1500×1000 (the polaroid), `img/demo.jpg` 1280×720 (the still under the play button)
- `share.jpg` 1200×630 for link previews, `icon.png` 180×180 for the home screen

## Cloudflare

`wrangler.jsonc` serves `dist/` as static assets, with `public/_headers` setting cache headers. `pnpm deploy` is all it takes once `wrangler login` has run. For Cloudflare Pages instead: build command `pnpm build`, output directory `dist`. Point `skaur.dev` at it from the dashboard, or uncomment the `routes` in `wrangler.jsonc` once the zone is on the account.

## Credit

The design, motion and sound of this site are a port of Naveen Meena's portfolio, rebuilt as a static Astro project with Sharn's content.
