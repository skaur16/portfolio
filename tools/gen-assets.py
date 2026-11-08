#!/usr/bin/env python3
"""Placeholder artwork for skaur.dev: the covers, the film strip, the project posters, the avatars and the share card.

Everything here is drawn, so nothing is anyone's photo. Replace any file under public/assets with the real thing
and keep the size; the page does not care what is in the picture, only where it is.
Run with `pnpm assets` (needs Pillow: `pip3 install pillow`).
"""
import math
import os
import random
import re

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets")
FONTS = os.path.join(ROOT, "tools", "fonts")
random.seed(5219)

# ---------- fonts ----------
def font(name, size, wght=None, wdth=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if wght is not None or wdth is not None:
        values = []
        for a in f.get_variation_axes():
            tag = a["name"].decode() if isinstance(a["name"], bytes) else a["name"]
            if tag.lower().startswith("weight"):
                values.append(wght if wght is not None else a["default"])
            elif tag.lower().startswith("width"):
                values.append(wdth if wdth is not None else a["default"])
            else:
                values.append(a["default"])
        f.set_variation_by_axes(values)
    return f

MONO = "ShareTechMono-Regular.ttf"
GEIST = "Geist[wght].ttf"
PLAY_I = "PlayfairDisplay-Italic[wght].ttf"
PLAY = "PlayfairDisplay[wght].ttf"
MARKER = "PermanentMarker-Regular.ttf"
SANS = "InstrumentSans[wdth,wght].ttf"

# ---------- paint helpers ----------
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def gradient(w, h, c1, c2, angle=90):
    """c1 to c2 across the image; angle 90 is top to bottom, 0 is left to right."""
    S = int(max(w, h) * 2.4)
    g = Image.linear_gradient("L").resize((S, S)).rotate(angle - 90, resample=Image.BICUBIC)
    g = ImageOps.autocontrast(g.crop(((S - w) // 2, (S - h) // 2, (S - w) // 2 + w, (S - h) // 2 + h)))
    return Image.composite(Image.new("RGB", (w, h), hexc(c2)), Image.new("RGB", (w, h), hexc(c1)), g)

def radial(w, h, c1, c2, cx=0.5, cy=0.0, r=1.2):
    g = Image.radial_gradient("L").resize((int(w * r * 2), int(w * r * 2)))
    mask = Image.new("L", (w, h), 255)
    mask.paste(g, (int(cx * w - g.width / 2), int(cy * h - g.height / 2)))
    return Image.composite(Image.new("RGB", (w, h), hexc(c2)), Image.new("RGB", (w, h), hexc(c1)), mask)

def grain(img, amount=0.08, sigma=40):
    n = Image.effect_noise(img.size, sigma).convert("RGB")
    return Image.blend(img, ImageChops.soft_light(img, n), amount)

def vignette(img, strength=0.35):
    w, h = img.size
    m = Image.radial_gradient("L").resize((int(w * 1.6), int(h * 1.6)))
    mask = Image.new("L", (w, h), 255)
    mask.paste(m, (int(w / 2 - m.width / 2), int(h / 2 - m.height / 2)))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(dark, img, mask.point(lambda v: int(v * strength)))

def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def shadow(base, box, r, blur=18, alpha=90, dy=10):
    """a soft drop shadow under a rounded box, drawn into base (RGBA)."""
    w, h = base.size
    s = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(s)
    x0, y0, x1, y1 = box
    sd.rounded_rectangle((x0, y0 + dy, x1, y1 + dy), radius=r, fill=(0, 0, 0, alpha))
    s = s.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(s)

def with_shadow(img, box, r, **kw):
    base = img.convert("RGBA")
    shadow(base, box, r, **kw)
    return base.convert("RGB")

def save(img, rel, **kw):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ext = rel.rsplit(".", 1)[1].lower()
    if ext in ("jpg", "jpeg"):
        img.convert("RGB").save(path, "JPEG", quality=kw.get("q", 86), optimize=True, progressive=True)
    elif ext == "webp":
        img.save(path, "WEBP", quality=kw.get("q", 88), method=6)
    else:
        img.save(path, optimize=True)
    print(f"{rel:28} {img.size[0]}x{img.size[1]}")

# ---------- code, drawn as code ----------
SNIPPETS = [
    'export const site = { name: "Sharn" };',
    'const tape = await load("/assets/reel");',
    "function unwind(y: number) { return y * 0.012; }",
    "if (!armed) return scrollTo(0, 0);",
    "// the pencil has to go in first",
    "const [hub, setHub] = useState(0);",
    'for (const card of cards) card.classList.add("in");',
    "await db.query(`select * from notes`);",
    "export default defineConfig({ site });",
    ".card { aspect-ratio: 16 / 10; }",
    'git commit -m "fix: the pencil wiggles"',
    "pnpm build && wrangler deploy",
    "SELECT id, title FROM tapes ORDER BY id;",
    "const reel = new Float32Array(count);",
    "type Story = { title: string; meta: string };",
    'return fetch("/api/notes").then((r) => r.json());',
    "const dt = Math.min(0.05, (now - last) / 1000);",
    "cassette.rotation.set(-0.3, 0.14, -0.36);",
    "@media (max-width: 760px) { .nav nav { display: none; } }",
    "const flag = flags.isOn('new-checkout', user);",
    "try { await migrate(); } catch (e) { rollback(e); }",
    "export async function GET({ params }) {",
    "  return new Response(JSON.stringify(data));",
    "}",
    "const tokens = { amber: '#ffc145', ink: '#35326f' };",
    "ctx.drawImage(tile, at, 0, run, height, -0.7, -h / 2);",
    "scene.add(sun, sun.target, floor);",
    "const press = () => audio.play().catch(() => {});",
    'label.font = \'150px "Permanent Marker"\';',
    "while (span < 8 && front[i + span] === front[i]) span++;",
    "test('rewinds to the cassette', async () => {",
    "  expect(scrollY).toBe(0);",
    "});",
    "docker compose up -d postgres redis",
    "$ pnpm test  ✓ 48 passed (2.1s)",
    "interface Props { title: string; meta?: string }",
    "const slot = window.cassette3d?.mouth;",
    "CREATE INDEX CONCURRENTLY ON notes (track);",
    "resp.headers.set('cache-control', 'immutable');",
    "let yVel = 0, angle = 0, reelSpeed = 0;",
]
KW = {"const", "let", "var", "function", "return", "if", "else", "for", "of", "await", "async", "export", "default",
      "import", "from", "type", "new", "class", "extends", "interface", "try", "catch", "while", "SELECT", "FROM",
      "ORDER", "BY", "WHERE", "CREATE", "INDEX", "ON", "CONCURRENTLY"}
TOKEN = re.compile(r"(//.*$|\"[^\"]*\"|'[^']*'|`[^`]*`|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[^\sA-Za-z0-9_$]+|\s+)")
SYNTAX = {
    "dark": {"kw": "#c678dd", "str": "#98c379", "fn": "#61afef", "num": "#d19a66", "cm": "#6b7280", "pl": "#abb2bf", "pun": "#8f98a8"},
    "light": {"kw": "#a626a4", "str": "#50a14f", "fn": "#4078f2", "num": "#986801", "cm": "#a0a1a7", "pl": "#383a42", "pun": "#6b6f78"},
}

def code_line(d, x, y, text, f, theme):
    pal = SYNTAX[theme]
    tokens = TOKEN.findall(text)
    for i, t in enumerate(tokens):
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        if t.isspace():
            col = pal["pl"]
        elif t.startswith("//"):
            col = pal["cm"]
        elif t[0] in "\"'`":
            col = pal["str"]
        elif t[0].isdigit():
            col = pal["num"]
        elif t in KW:
            col = pal["kw"]
        elif re.match(r"[A-Za-z_$][\w$]*$", t):
            col = pal["fn"] if nxt.startswith("(") else pal["pl"]
        else:
            col = pal["pun"]
        d.text((x, y), t, font=f, fill=hexc(col))
        x += f.getlength(t)
    return x

# ---------- the frames of the film ----------
PALETTES = [
    ("#1e1e2e", "#cdd6f4", "#f9e2af", "dark"),
    ("#0d1117", "#c9d1d9", "#58a6ff", "dark"),
    ("#1d1712", "#f0e6d6", "#e9a94b", "dark"),
    ("#fbf4e4", "#302d28", "#cd2b6f", "light"),
    ("#35326f", "#fbf4e4", "#ffc145", "dark"),
    ("#113a2c", "#d6f2df", "#ffc145", "dark"),
    ("#0f3b3f", "#d8f3f1", "#ff8a3d", "dark"),
    ("#f4f1ea", "#1b1b1b", "#35326f", "light"),
    ("#24224f", "#fbf4e4", "#f4476b", "dark"),
    ("#2b1d2e", "#f3e8ff", "#c084fc", "dark"),
]

def mix(a, b, t):
    return tuple(int(x * (1 - t) + y * t) for x, y in zip(hexc(a), hexc(b)))

def window_chrome(d, w, h, bg, fg, title=""):
    rrect(d, (0, 0, w, h), 10, fill=hexc(bg))
    bar = mix(bg, fg, 0.12)
    d.rounded_rectangle((0, 0, w, 24), radius=10, fill=bar)
    d.rectangle((0, 14, w, 24), fill=bar)
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        d.ellipse((10 + i * 16, 7, 20 + i * 16, 17), fill=hexc(c))
    if title:
        d.text((w / 2, 12), title, font=font(SANS, 10, wght=500), fill=hexc(fg), anchor="mm")

def frame_code(w, h, pal, k):
    bg, fg, ac, theme = pal
    img = Image.new("RGB", (w, h), hexc(bg))
    d = ImageDraw.Draw(img)
    window_chrome(d, w, h, bg, fg, ["site.js", "cassette3d.js", "index.astro", "schema.sql", "deploy.yml", "global.css"][k % 6])
    f = font(MONO, 12)
    y = 32
    for i in range(9):
        line = SNIPPETS[(k * 3 + i) % len(SNIPPETS)]
        d.text((8, y), f"{k * 3 + i + 1:>3}", font=f, fill=hexc(SYNTAX[theme]["cm"]))
        code_line(d, 36, y, line[:46], f, theme)
        y += 16
    return img

def frame_terminal(w, h, pal, k):
    bg, fg, ac, theme = pal
    bg = "#0b0b10" if theme == "dark" else bg
    img = Image.new("RGB", (w, h), hexc(bg))
    d = ImageDraw.Draw(img)
    window_chrome(d, w, h, bg, fg, "zsh")
    f = font(MONO, 12)
    runs = [
        ["$ pnpm build", "✓ Completed in 1.2s", "  dist/index.html  38.1 kB", "$ wrangler deploy", "Uploaded skaur-dev (1.9 sec)", "Deployed to https://skaur.dev"],
        ["$ git log --oneline | head", "a1f9c2e fix: the pencil wiggles", "7be03d1 feat: rewind key", "c92a0ff chore: film strip tiles", "e4d118a feat: the deck lights up", "$ git push origin main"],
        ["$ pnpm test", " ✓ tape/path.test.ts (12)", " ✓ deck/keys.test.ts (9)", " ✓ notes/captions.test.ts (27)", "Tests  48 passed (2.1s)", "$ "],
        ["$ psql skaur", "skaur=# \\d notes", " id      | integer", " title   | text", " spoken  | timestamptz", "skaur=# select count(*) from notes;  9"],
        ["$ curl -s https://skaur.dev/api/health", '{"ok":true,"region":"yyz","ms":41}', "$ dig +short skaur.dev", "104.21.0.1", "172.67.0.1", "$ "],
        ["$ docker compose up -d", " ✔ Network skaur_default  Created", " ✔ Container postgres     Started", " ✔ Container redis        Started", " ✔ Container api          Started", "$ "],
    ][k % 6]
    y = 32
    for line in runs:
        col = ac if line.startswith("$") else ("#5fd068" if ("✓" in line or "✔" in line or "Deployed" in line) else fg)
        d.text((10, y), line[:50], font=f, fill=hexc(col))
        y += 17
    if k % 2:
        x = 10 + f.getlength(runs[-1][:50])
        d.rectangle((x, y - 17, x + 7, y - 5), fill=hexc(ac))
    return img

def frame_browser(w, h, pal, k):
    bg, fg, ac, theme = pal
    page = "#ffffff" if theme == "light" else "#15151c"
    img = Image.new("RGB", (w, h), hexc(page))
    d = ImageDraw.Draw(img)
    window_chrome(d, w, h, page, fg, "")
    rrect(d, (70, 5, w - 70, 19), 7, fill=hexc(bg))
    d.text((w / 2, 12), ["skaur.dev", "localhost:4321", "app.example.com/dashboard", "skaur.dev/story"][k % 4], font=font(MONO, 9), fill=hexc(fg), anchor="mm")
    muted = mix(page, fg, 0.5)
    soft = mix(page, fg, 0.12)
    layout = (k // 2) % 4
    if layout == 0:  # sidebar + cards
        d.rectangle((0, 24, 90, h), fill=soft)
        for i in range(6):
            rrect(d, (10, 36 + i * 20, 70 + (i % 3) * 5, 44 + i * 20), 3, fill=muted if i else hexc(ac))
        for r in range(2):
            for c in range(3):
                rrect(d, (102 + c * 90, 38 + r * 66, 182 + c * 90, 94 + r * 66), 6, fill=soft)
                rrect(d, (110 + c * 90, 46 + r * 66, 150 + c * 90, 52 + r * 66), 2, fill=muted)
                rrect(d, (110 + c * 90, 74 + r * 66, 170 + c * 90, 86 + r * 66), 3, fill=hexc(ac) if (r + c) % 3 == 0 else muted)
    elif layout == 1:  # hero
        rrect(d, (24, 42, 180, 56), 3, fill=hexc(fg))
        rrect(d, (24, 62, 230, 70), 3, fill=muted)
        rrect(d, (24, 76, 200, 84), 3, fill=muted)
        rrect(d, (24, 98, 94, 118), 6, fill=hexc(ac))
        rrect(d, (104, 98, 170, 118), 6, fill=soft)
        rrect(d, (250, 36, w - 14, h - 14), 8, fill=soft)
        d.ellipse((296, 68, 332, 104), fill=hexc(ac))
    elif layout == 2:  # table
        for i in range(7):
            y = 36 + i * 19
            d.line((14, y + 17, w - 14, y + 17), fill=soft, width=1)
            rrect(d, (16, y + 4, 60 + (i * 13) % 50, y + 12), 2, fill=hexc(fg) if i == 0 else muted)
            rrect(d, (150, y + 4, 230, y + 12), 2, fill=muted)
            rrect(d, (280, y + 3, 330, y + 13), 5, fill=hexc(ac) if i % 3 == 1 else soft)
    else:  # chart
        d.line((30, h - 30, w - 20, h - 30), fill=muted, width=1)
        pts = [(30 + i * ((w - 50) / 12), h - 34 - (18 + (math.sin(i * 0.9 + k) + 1) * 40 + i * 2)) for i in range(13)]
        d.line(pts, fill=hexc(ac), width=3, joint="curve")
        for p in pts[::3]:
            d.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), fill=hexc(page), outline=hexc(ac), width=2)
        rrect(d, (30, 34, 120, 44), 3, fill=hexc(fg))
    return img

def frame_stat(w, h, pal, k):
    bg, fg, ac, theme = pal
    img = Image.new("RGB", (w, h), hexc(bg))
    d = ImageDraw.Draw(img)
    big, small = [("99.9%", "uptime, last 90 days"), ("1.2s", "build, cold"), ("8,000", "lines, with tests"), ("41ms", "p95, Toronto"),
                  ("0", "typing, some shouting"), ("48", "tests, all green"), ("C60", "both sides"), ("v3.2.0", "shipped on a Friday")][k % 8]
    d.text((22, 40), big, font=font(GEIST, 58, wght=800), fill=hexc(ac))
    d.text((24, 118), small, font=font(SANS, 15, wght=500), fill=hexc(fg))
    for i in range(14):
        v = (math.sin(i * 1.3 + k) + 1) * 14 + 6
        rrect(d, (240 + i * 9, 150 - v, 246 + i * 9, 150), 2, fill=hexc(ac) if i % 4 == 0 else hexc(fg))
    return img

def frame_graph(w, h, pal, k):
    bg, fg, ac, theme = pal
    img = Image.new("RGB", (w, h), hexc(bg))
    d = ImageDraw.Draw(img)
    lanes = [hexc(ac), hexc(fg), hexc("#5fd068"), hexc("#f4476b")]
    for i in range(3):
        x = 40 + i * 22
        d.line((x, 10, x, h - 10), fill=lanes[i], width=3)
    for j in range(8):
        y = 18 + j * 20
        lane = (j * 7 + k) % 3
        x = 40 + lane * 22
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=hexc(bg), outline=lanes[lane], width=3)
        msg = ["feat: the pencil goes in", "fix: safari flips the card", "chore: tiles for the film", "feat: rewind key", "docs: how to record a note",
               "perf: paint the film once", "feat: the deck lights up", "fix: iPhone volume"][(j + k) % 8]
        d.text((120, y - 7), msg, font=font(MONO, 12), fill=hexc(fg))
        d.text((w - 12, y - 7), f"{(k * 31 + j * 7) % 24:02d}:{(k * 13 + j * 11) % 60:02d}", font=font(MONO, 11), fill=lanes[lane], anchor="ra")
    return img

def frame_tokens(w, h, pal, k):
    bg, fg, ac, theme = pal
    img = Image.new("RGB", (w, h), hexc(bg))
    d = ImageDraw.Draw(img)
    sw = ["#ffc145", "#ff8a3d", "#f4476b", "#b5338a", "#35326f", "#24224f", "#fbf4e4", "#e9a94b", "#113a2c", "#5fd068", "#58a6ff", "#cd2b6f"]
    for i in range(12):
        x = 16 + (i % 6) * 58
        y = 20 + (i // 6) * 70
        rrect(d, (x, y, x + 48, y + 40), 6, fill=hexc(sw[(i + k) % 12]))
        d.text((x, y + 46), sw[(i + k) % 12], font=font(MONO, 10), fill=hexc(fg))
    return img

def frame_badge(w, h, pal, k):
    bg, fg, ac, theme = pal
    img = radial(w, h, ac, bg, 0.2, 0.0, 0.9)
    d = ImageDraw.Draw(img)
    name = ["TypeScript", "Astro", "React", "Node.js", "Postgres", "Cloudflare", "Three.js", "Vite", "Docker", "Tailwind", "GraphQL", "Redis"][k % 12]
    d.text((w / 2, h / 2 - 8), name, font=font(GEIST, 40, wght=800), fill=hexc(fg), anchor="mm")
    sub = ["since 2019", "daily driver", "on a dare", "in production", "with migrations", "for the edge", "for the cassette", "for the speed", "for the parity", "sometimes", "once", "for the queue"][k % 12]
    d.text((w / 2, h / 2 + 30), sub, font=font(MONO, 13), fill=hexc(fg), anchor="mm")
    return img

def frame_sticky(w, h, pal, k):
    img = Image.new("RGB", (w, h), hexc(["#2b2a33", "#1d1712", "#f4f1ea"][k % 3]))
    notes = ["ship it", "write the test first", "ask the intern", "rollback plan?", "talk to the user", "it's the cache", "pencil first", "read the logs", "name things"]
    cols = ["#ffe066", "#ffb3c6", "#b5e5cf", "#cdb4ff", "#ffd6a5"]
    for i in range(3):
        x = 22 + i * 118 + (k % 3) * 4
        y = 30 + (i * 17 + k * 13) % 30
        img = with_shadow(img, (x, y, x + 100, y + 100), 2, blur=8, alpha=70, dy=6)
        d = ImageDraw.Draw(img)
        d.rectangle((x, y, x + 100, y + 100), fill=hexc(cols[(i + k) % 5]))
        d.text((x + 10, y + 34), notes[(i + k * 3) % 9], font=font(MARKER, 15), fill=hexc("#2b2a33"))
    return img

FRAME_KINDS = [frame_code, frame_terminal, frame_browser, frame_stat, frame_graph, frame_badge, frame_tokens, frame_sticky]

def reel_strip():
    cols, rows, cw, ch = 10, 7, 378, 180
    sheet = Image.new("RGB", (cols * cw, rows * ch), (20, 16, 12))
    for i in range(67):
        kind = FRAME_KINDS[i % len(FRAME_KINDS)]
        pal = PALETTES[(i * 3 + i // 8) % len(PALETTES)]
        fr = grain(kind(cw, ch, pal, i // len(FRAME_KINDS)), 0.1, 30)  # each kind sees a fresh index, so its frames differ
        sheet.paste(fr, ((i % cols) * cw, (i // cols) * ch))
    save(sheet, "reel/strip.webp", q=82)

# ---------- illustrations ----------
def draw_cassette(d, x, y, w, body="#35326f", label="#fbf4e4"):
    """a flat cassette, w wide and 0.63w tall, at x,y."""
    h = w * 0.63
    rrect(d, (x, y, x + w, y + h), w * 0.03, fill=hexc(body))
    lx0, ly0, lx1, ly1 = x + w * 0.045, y + h * 0.1, x + w * 0.955, y + h * 0.72
    rrect(d, (lx0, ly0, lx1, ly1), w * 0.015, fill=hexc(label))
    bh = (ly1 - ly0) * 0.1
    for i, c in enumerate(["#ffc145", "#ff8a3d", "#f4476b", "#b5338a"]):
        d.rectangle((lx0, ly0 + (ly1 - ly0) * 0.42 + i * bh, lx1, ly0 + (ly1 - ly0) * 0.42 + (i + 1) * bh), fill=hexc(c))
    d.rectangle((lx0, ly0 + (ly1 - ly0) * 0.82, lx1, ly1), fill=hexc(body))
    rrect(d, (x + w * 0.17, y + h * 0.33, x + w * 0.83, y + h * 0.66), w * 0.03, fill=hexc("#dfd3b8"))
    for hx in (x + w * 0.29, x + w * 0.71):
        r = w * 0.075
        d.ellipse((hx - r, y + h * 0.495 - r, hx + r, y + h * 0.495 + r), fill=hexc("#f4f1ea"), outline=hexc("#bfb396"), width=max(1, int(w * 0.006)))
        r2 = r * 0.5
        d.ellipse((hx - r2, y + h * 0.495 - r2, hx + r2, y + h * 0.495 + r2), fill=hexc(body))
    rrect(d, (x + w * 0.4, y + h * 0.43, x + w * 0.6, y + h * 0.56), w * 0.01, fill=hexc("#1a1424"))
    rrect(d, (x + w * 0.42, y + h * 0.47, x + w * 0.58, y + h * 0.52), 2, fill=hexc("#3a2a20"))
    d.polygon([(x + w * 0.13, y + h), (x + w * 0.87, y + h), (x + w * 0.815, y + h * 0.78), (x + w * 0.185, y + h * 0.78)], fill=hexc("#dfd3b8"))
    for sx in (0.26, 0.74):
        d.ellipse((x + w * sx - w * 0.015, y + h * 0.89 - w * 0.015, x + w * sx + w * 0.015, y + h * 0.89 + w * 0.015), fill=hexc("#26252a"))
    for sx in (0.4, 0.6):
        d.rectangle((x + w * sx - w * 0.015, y + h * 0.89 - w * 0.015, x + w * sx + w * 0.015, y + h * 0.89 + w * 0.015), fill=hexc("#26252a"))
    for sx, sy in ((0.03, 0.06), (0.97, 0.06), (0.03, 0.94), (0.97, 0.94)):
        d.ellipse((x + w * sx - w * 0.012, y + h * sy - w * 0.012, x + w * sx + w * 0.012, y + h * sy + w * 0.012), fill=hexc("#e7c063"))

def cover_waterloo():
    """where it all began: a beige CRT on a desk, showing a first homepage, with a snowy Waterloo evening in the window."""
    w, h = 1400, 1050
    img = Image.new("RGB", (w, h), hexc("#e9dcc6"))
    d = ImageDraw.Draw(img)
    # the window, and the snow coming down outside it
    rrect(d, (760, 70, 1330, 560), 10, fill=hexc("#f6efe2"))
    d.rectangle((790, 100, 1300, 530), fill=hexc("#1e2a4a"))
    d.rectangle((790, 100, 1300, 530), fill=hexc("#243356"))
    d.ellipse((1150, 150, 1230, 230), fill=hexc("#fbf4e4"))
    rnd = random.Random(7)
    for i in range(3):
        x = 800 + i * 170
        d.polygon([(x, 530), (x + 150, 530), (x + 150, 390 - i * 25), (x + 75, 330 - i * 25), (x, 390 - i * 25)], fill=hexc("#2f3f66"))
        d.rectangle((x + 55, 440, x + 95, 480), fill=hexc("#f6d98a"))
    d.rectangle((790, 500, 1300, 530), fill=hexc("#f2f4f8"))
    for _ in range(140):
        x, y, r = rnd.randint(790, 1300), rnd.randint(100, 500), rnd.choice([2, 3, 3, 4])
        d.ellipse((x - r, y - r, x + r, y + r), fill=hexc("#ffffff"))
    d.rectangle((1040, 100, 1050, 530), fill=hexc("#f6efe2"))
    d.rectangle((790, 310, 1300, 320), fill=hexc("#f6efe2"))
    # the desk
    d.rectangle((0, 760, w, h), fill=hexc("#a8784f"))
    d.rectangle((0, 760, w, 782), fill=hexc("#c08f5f"))
    img = with_shadow(img, (240, 220, 900, 760), 30, blur=50, alpha=120, dy=20)
    d = ImageDraw.Draw(img)
    # the monitor: a beige box, a dark bezel, and a slightly curved screen
    rrect(d, (240, 220, 900, 740), 28, fill=hexc("#d9cdb3"))
    rrect(d, (262, 242, 878, 690), 18, fill=hexc("#c9bc9f"))
    rrect(d, (292, 268, 848, 660), 14, fill=hexc("#2a2622"))
    rrect(d, (306, 282, 834, 646), 10, fill=hexc("#c0c0c0"))
    d.rectangle((306, 282, 834, 300), fill=hexc("#000080"))
    d.text((314, 284), "Sharn's Homepage - Netscape", font=font(SANS, 13, wght=600), fill=hexc("#ffffff"))
    d.rectangle((306, 300, 834, 330), fill=hexc("#d4d0c8"))
    d.rectangle((420, 306, 820, 324), fill=hexc("#ffffff"))
    d.text((426, 308), "http://geocities.com/~sharn", font=font(MONO, 13), fill=hexc("#1b1b1b"))
    page = (306, 330, 834, 646)
    d.rectangle(page, fill=hexc("#fdfdf5"))
    d.text((570, 360), "Welcome to my homepage!!", font=font(SANS, 26, wght=700), fill=hexc("#000080"), anchor="mm")
    d.rectangle((320, 384, 820, 410), fill=hexc("#ffff99"))
    d.text((330, 388), "<marquee> hi, I made this. please sign the guestbook </marquee>", font=font(MONO, 13), fill=hexc("#aa0000"))
    y = 428
    for line in ["* about me", "* my cat", "* cool links", "* guestbook"]:
        d.text((330, y), line, font=font(SANS, 16, wght=500), fill=hexc("#0000ee"))
        d.line((348, y + 19, 348 + font(SANS, 16, wght=500).getlength(line[2:]), y + 19), fill=hexc("#0000ee"), width=1)
        y += 26
    # the visitor counter and the under-construction stripes
    d.text((560, 540), "You are visitor number", font=font(SANS, 15, wght=500), fill=hexc("#1b1b1b"), anchor="mm")
    for i, ch in enumerate("00011"):
        rrect(d, (490 + i * 30, 558, 514 + i * 30, 592), 3, fill=hexc("#111111"))
        d.text((502 + i * 30, 575), ch, font=font(MONO, 26), fill=hexc("#33d93f"), anchor="mm")
    for x in range(320, 820, 40):
        d.polygon([(x, 606), (x + 20, 606), (x + 40, 630), (x + 20, 630)], fill=hexc("#f5c400"))
        d.polygon([(x + 20, 606), (x + 40, 606), (x + 40, 630), (x + 40, 630)], fill=hexc("#1b1b1b"))
    d.rectangle((320, 606, 820, 630), outline=hexc("#1b1b1b"), width=2)
    rrect(d, (460, 600, 680, 636), 3, fill=hexc("#f5c400"), outline=hexc("#1b1b1b"), width=2)
    d.text((570, 618), "UNDER CONSTRUCTION", font=font(SANS, 14, wght=700), fill=hexc("#1b1b1b"), anchor="mm")
    # the bezel's power light, the stand, the keyboard, the mouse
    d.ellipse((840, 700, 852, 712), fill=hexc("#5fd068"))
    d.rectangle((500, 740, 640, 770), fill=hexc("#bfb396"))
    rrect(d, (470, 764, 670, 782), 6, fill=hexc("#a89c80"))
    rrect(d, (330, 800, 890, 880), 10, fill=hexc("#d9cdb3"))
    for r in range(3):
        for c in range(18):
            rrect(d, (348 + c * 30, 812 + r * 22, 370 + c * 30, 830 + r * 22), 3, fill=hexc("#efe6d2"))
    rrect(d, (520, 858, 700, 872), 3, fill=hexc("#efe6d2"))
    d.ellipse((960, 810, 1040, 900), fill=hexc("#d9cdb3"))
    d.line((1000, 810, 1040, 760), fill=hexc("#8a8070"), width=3)
    # the mug and the sticky note
    rrect(d, (1120, 700, 1220, 790), 10, fill=hexc("#35326f"))
    d.ellipse((1128, 690, 1212, 716), fill=hexc("#4a2e1e"))
    d.arc((1206, 712, 1256, 770), 270, 90, fill=hexc("#35326f"), width=12)
    img = with_shadow(img, (100, 560, 240, 700), 2, blur=10, alpha=70, dy=6)
    d = ImageDraw.Draw(img)
    d.polygon([(100, 560), (240, 572), (228, 712), (88, 700)], fill=hexc("#ffe066"))
    d.text((164, 636), "my first\nwebsite!!", font=font(MARKER, 24), fill=hexc("#2b2a33"), anchor="mm", align="center")
    save(grain(img, 0.1, 24), "cover/waterloo.jpg")

def plate_base(w, h, c1, c2, angle=100, g=0.1):
    return grain(gradient(w, h, c1, c2, angle), g, 26)

def cover_lines():
    """cream paper, and a dark editor with a very long file in it."""
    w, h = 1400, 875
    img = plate_base(w, h, "#fbf4e4", "#efe2c4", 100, 0.08)
    box = (170, 330, 1230, 1000)
    img = with_shadow(img, box, 22, blur=40, alpha=120, dy=26)
    d = ImageDraw.Draw(img)
    rrect(d, box, 22, fill=hexc("#1e1e2e"))
    d.rounded_rectangle((box[0], box[1], box[2], box[1] + 56), radius=22, fill=hexc("#2a2a3d"))
    d.rectangle((box[0], box[1] + 30, box[2], box[1] + 56), fill=hexc("#2a2a3d"))
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        d.ellipse((box[0] + 26 + i * 30, box[1] + 18, box[0] + 46 + i * 30, box[1] + 38), fill=hexc(c))
    d.text((box[0] + 140, box[1] + 18), "the-whole-thing.ts", font=font(SANS, 20, wght=500), fill=hexc("#cdd6f4"))
    f = font(MONO, 23)
    y = box[1] + 80
    for i in range(22):
        d.text((box[0] + 30, y), f"{7978 + i}", font=f, fill=hexc("#6b7280"))
        code_line(d, box[0] + 110, y, SNIPPETS[(i * 7 + 3) % len(SNIPPETS)][:64], f, "dark")
        y += 30
    d.rectangle((box[2] - 16, box[1] + 60, box[2] - 8, box[3] - 10), fill=hexc("#2a2a3d"))
    d.rounded_rectangle((box[2] - 16, box[3] - 120, box[2] - 8, box[3] - 10), radius=4, fill=hexc("#6b7280"))
    save(img, "cover/lines.jpg")

def cover_junior():
    """a support desk: a monitor full of tickets, a mug, a headset."""
    w, h = 1400, 875
    img = plate_base(w, h, "#0f3b3f", "#082528", 110)
    img = with_shadow(img, (330, 300, 1070, 760), 26, blur=44, alpha=140, dy=30)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 760, w, h), fill=hexc("#1a3a3c"))
    d.rectangle((0, 760, w, 776), fill=hexc("#2b5658"))
    rrect(d, (330, 300, 1070, 760), 26, fill=hexc("#1d1d24"))
    d.rectangle((650, 760, 750, 810), fill=hexc("#1d1d24"))
    rrect(d, (560, 800, 840, 826), 10, fill=hexc("#1d1d24"))
    rrect(d, (356, 326, 1044, 734), 14, fill=hexc("#f6f7fb"))
    d.rectangle((356, 326, 1044, 374), fill=hexc("#ffffff"))
    d.text((380, 338), "Support queue", font=font(SANS, 24, wght=600), fill=hexc("#1b1b1b"))
    rrect(d, (900, 334, 1030, 366), 16, fill=hexc("#ffb648"))
    d.text((965, 350), "23 open", font=font(SANS, 15, wght=600), fill=hexc("#302d28"), anchor="mm")
    tickets = ["Can't log in since the update", "The export is empty again", "Where did the banner go?", "Invoice shows the wrong year",
               "Dark mode flashes white", "Everyone is logged in as Sharn?!", "Loves the new release notes"]
    for i, t in enumerate(tickets):
        y = 392 + i * 48
        rrect(d, (372, y, 1028, y + 40), 8, fill=hexc("#ffffff"), outline=hexc("#e6e8ee"))
        d.ellipse((386, y + 12, 402, y + 28), fill=hexc(["#f4476b", "#ffb648", "#5fd068"][i % 3]))
        d.text((416, y + 11), t, font=font(SANS, 17, wght=500), fill=hexc("#1b1b1b"))
        d.text((1012, y + 12), f"#{4120 + i * 7}", font=font(MONO, 15), fill=hexc("#8a8d96"), anchor="ra")
    d.ellipse((1130, 700, 1250, 740), fill=hexc("#0b2325"))
    rrect(d, (1130, 640, 1250, 770), 12, fill=hexc("#fbf4e4"))
    d.ellipse((1140, 630, 1240, 662), fill=hexc("#4a2e1e"))
    d.arc((1236, 666, 1296, 736), 270, 90, fill=hexc("#fbf4e4"), width=14)
    d.arc((120, 560, 300, 740), 180, 360, fill=hexc("#26252a"), width=22)
    rrect(d, (104, 640, 156, 720), 14, fill=hexc("#26252a"))
    rrect(d, (264, 640, 316, 720), 14, fill=hexc("#26252a"))
    save(img, "cover/junior.jpg")

def cover_standup():
    """a wall clock at 9:03, and a calendar with most of the meetings crossed out."""
    w, h = 1400, 875
    img = plate_base(w, h, "#e9a53b", "#c97a1c", 100)
    img = with_shadow(img, (220, 300, 580, 660), 180, blur=40, alpha=120, dy=26)
    img = with_shadow(img, (700, 280, 1230, 800), 20, blur=40, alpha=120, dy=26)
    d = ImageDraw.Draw(img)
    cx, cy, r = 400, 480, 180
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=hexc("#fbf4e4"), outline=hexc("#35326f"), width=16)
    for i in range(12):
        a = i / 12 * math.pi * 2
        l = 22 if i % 3 == 0 else 12
        d.line((cx + math.cos(a) * (r - 30), cy + math.sin(a) * (r - 30), cx + math.cos(a) * (r - 30 - l), cy + math.sin(a) * (r - 30 - l)), fill=hexc("#35326f"), width=6)
    d.line((cx, cy, cx + math.cos(math.radians(183)) * 95, cy + math.sin(math.radians(183)) * 95), fill=hexc("#35326f"), width=14)
    d.line((cx, cy, cx + math.cos(math.radians(-72)) * 135, cy + math.sin(math.radians(-72)) * 135), fill=hexc("#35326f"), width=10)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=hexc("#cd2b6f"))
    rrect(d, (700, 280, 1230, 800), 20, fill=hexc("#fbf4e4"))
    d.rounded_rectangle((700, 280, 1230, 350), radius=20, fill=hexc("#35326f"))
    d.rectangle((700, 320, 1230, 350), fill=hexc("#35326f"))
    d.text((965, 315), "This week", font=font(GEIST, 30, wght=800), fill=hexc("#ffc145"), anchor="mm")
    for i, day in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"]):
        y = 372 + i * 82
        d.text((728, y + 20), day, font=font(SANS, 20, wght=600), fill=hexc("#302d28"))
        for j in range(3):
            x = 820 + j * 130
            on = (i, j) in ((0, 0), (2, 1), (4, 2))
            rrect(d, (x, y + 6, x + 116, y + 60), 8, fill=hexc("#5fd068") if on else hexc("#dcd6f7"))
            d.text((x + 10, y + 16), ["standup", "sync", "planning", "retro", "1:1", "all hands"][(i + j) % 6], font=font(SANS, 15, wght=500), fill=hexc("#302d28"))
            if not on:
                d.line((x + 8, y + 54, x + 108, y + 12), fill=hexc("#d3262f"), width=5)
    save(img, "cover/standup.jpg")

def cover_prod():
    """a rack of servers in the dark, and one big red button on the wall."""
    w, h = 1400, 875
    img = grain(radial(w, h, "#2a2340", "#0b0a14", 0.5, 0.1, 1.0), 0.1, 26)
    d = ImageDraw.Draw(img)
    rnd = random.Random(2)
    for rx in (150, 560):
        rrect(d, (rx, 120, rx + 360, h), 14, fill=hexc("#171522"))
        for i in range(9):
            y = 150 + i * 80
            rrect(d, (rx + 18, y, rx + 342, y + 62), 6, fill=hexc("#232033"))
            for j in range(8):
                d.rectangle((rx + 34 + j * 14, y + 24, rx + 42 + j * 14, y + 38), fill=hexc("#2e2b40"))
            for j in range(3):
                d.ellipse((rx + 300 + j * 14, y + 26, rx + 308 + j * 14, y + 34), fill=hexc("#5fd068" if rnd.random() > 0.2 else "#f4476b"))
            d.text((rx + 160, y + 48), f"node-{i + 1:02d}", font=font(MONO, 12), fill=hexc("#6b6f8a"))
    img = with_shadow(img, (1000, 330, 1300, 630), 150, blur=50, alpha=160, dy=30)
    d = ImageDraw.Draw(img)
    d.ellipse((980, 310, 1320, 650), fill=hexc("#2b2a33"))
    d.ellipse((1010, 340, 1290, 620), fill=hexc("#d3262f"))
    d.ellipse((1050, 365, 1250, 500), fill=hexc("#e9484f"))
    d.text((1150, 480), "DEPLOY", font=font(GEIST, 44, wght=800), fill=hexc("#fbf4e4"), anchor="mm")
    d.text((1150, 700), "friday, 17:58", font=font(MONO, 26), fill=hexc("#ffc145"), anchor="mm")
    save(img, "cover/prod.jpg")

def cover_mentor():
    """two laptops facing each other, with a pull request between them."""
    w, h = 1400, 875
    img = plate_base(w, h, "#4a4690", "#24224f", 110)
    img = with_shadow(img, (400, 330, 1000, 700), 20, blur=44, alpha=140, dy=30)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 700, w, h), fill=hexc("#1d1b40"))
    for lx, sx in ((120, 1), (1280, -1)):
        d.polygon([(lx, 700), (lx + sx * 420, 700), (lx + sx * 380, 420), (lx + sx * 40, 420)], fill=hexc("#26252a"))
        d.polygon([(lx + sx * 70, 440), (lx + sx * 350, 440), (lx + sx * 328, 680), (lx + sx * 92, 680)], fill=hexc("#1e1e2e"))
        d.rectangle((min(lx, lx + sx * 460), 700, max(lx, lx + sx * 460), 724), fill=hexc("#3a3942"))
    rrect(d, (400, 330, 1000, 700), 20, fill=hexc("#fbf4e4"))
    d.text((430, 356), "Pull request #1", font=font(GEIST, 30, wght=800), fill=hexc("#1b1b1b"))
    rrect(d, (820, 352, 970, 390), 19, fill=hexc("#5fd068"))
    d.text((895, 371), "Approved", font=font(SANS, 17, wght=600), fill=hexc("#0b2b14"), anchor="mm")
    y = 414
    for sign, text in [("+", "const user = await findUser(id);"), ("+", "if (!user) return notFound();"), ("-", "return users[0]; // TODO"), (" ", "return user;")]:
        d.rectangle((430, y, 970, y + 42), fill=hexc({"+": "#dcfce7", "-": "#fee2e2", " ": "#f4f1ea"}[sign]))
        d.text((444, y + 10), sign, font=font(MONO, 22), fill=hexc("#1b1b1b"))
        code_line(d, 470, y + 10, text, font(MONO, 22), "light")
        y += 46
    d.ellipse((430, 616, 474, 660), fill=hexc("#ffc145"))
    d.text((490, 622), "nice. one more: what if two users share an email?", font=font(SANS, 18, wght=500), fill=hexc("#302d28"))
    save(img, "cover/mentor.jpg")

def cover_bonus():
    """sunset bands and a cassette: the bonus track."""
    w, h = 1400, 875
    img = Image.new("RGB", (w, h), hexc("#24224f"))
    d = ImageDraw.Draw(img)
    for i, c in enumerate(["#ffc145", "#ff8a3d", "#f4476b", "#b5338a"]):
        d.rectangle((0, 380 + i * 90, w, 470 + i * 90), fill=hexc(c))
    img = grain(img, 0.1, 26)
    img = with_shadow(img, (560, 300, 1240, 730), 20, blur=50, alpha=150, dy=36)
    d = ImageDraw.Draw(img)
    draw_cassette(d, 560, 300, 680)
    d.text((900, 395), "bonus", font=font(MARKER, 70), fill=hexc("#35326f"), anchor="mm")
    save(img, "cover/bonus.jpg")

def cutout_laptop():
    """an open laptop, seen from the front, with an error on the screen. Transparent, bottom-anchored."""
    w, h = 1109, 1300
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow(img, (160, 560, 950, 1260), 30, blur=40, alpha=90, dy=20)
    d = ImageDraw.Draw(img)
    rrect(d, (200, 420, 910, 1150), 36, fill=hexc("#2b2a33") + (255,))
    rrect(d, (236, 456, 874, 1090), 16, fill=hexc("#fbf8ee") + (255,))
    d.text((555, 700), ":(", font=font(GEIST, 190, wght=800), fill=hexc("#d3262f") + (255,), anchor="mm")
    d.text((555, 880), "error TS2322: Type 'Java'", font=font(MONO, 32), fill=hexc("#1b1b1b") + (255,), anchor="mm")
    d.text((555, 930), "is not assignable to type 'Browser'", font=font(MONO, 32), fill=hexc("#1b1b1b") + (255,), anchor="mm")
    d.ellipse((545, 428, 565, 448), fill=hexc("#111114") + (255,))
    d.polygon([(130, 1150), (980, 1150), (1060, 1260), (50, 1260)], fill=hexc("#3a3942") + (255,))
    d.polygon([(260, 1168), (850, 1168), (880, 1215), (230, 1215)], fill=hexc("#26252a") + (255,))
    d.rounded_rectangle((470, 1222, 640, 1248), radius=8, fill=hexc("#26252a") + (255,))
    save(img, "cut/laptop.webp")

def cutout_desk():
    """a tidy desk: a monitor with a dashboard, a plant, a lamp. Transparent, bottom-anchored."""
    w, h = 1000, 749
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow(img, (120, 560, 880, 740), 10, blur=36, alpha=90, dy=16)
    d = ImageDraw.Draw(img)
    rrect(d, (90, 600, 910, 640), 10, fill=hexc("#a8784f") + (255,))
    d.rectangle((140, 640, 170, 749), fill=hexc("#8a6140") + (255,))
    d.rectangle((830, 640, 860, 749), fill=hexc("#8a6140") + (255,))
    rrect(d, (300, 180, 740, 480), 18, fill=hexc("#26252a") + (255,))
    rrect(d, (318, 198, 722, 462), 10, fill=hexc("#f6f7fb") + (255,))
    d.rectangle((318, 198, 400, 462), fill=hexc("#eef0f5") + (255,))
    for i in range(5):
        rrect(d, (330, 216 + i * 30, 388, 236 + i * 30), 4, fill=hexc("#ffc145" if i == 0 else "#d4d7df") + (255,))
    for i in range(3):
        x = 416 + i * 100
        rrect(d, (x, 216, x + 86, 290), 8, fill=hexc("#ffffff") + (255,), outline=hexc("#e2e4ea") + (255,))
        d.text((x + 10, 226), ["99.9%", "1.2s", "0 bugs"][i], font=font(GEIST, 22, wght=800), fill=hexc("#35326f") + (255,))
        d.text((x + 10, 258), ["uptime", "build", "today"][i], font=font(SANS, 13, wght=500), fill=hexc("#6b6f78") + (255,))
    pts = [(420 + i * 24, 440 - (math.sin(i * 0.8) + 1) * 40 - i * 4) for i in range(12)]
    d.line(pts, fill=hexc("#5fd068") + (255,), width=5, joint="curve")
    d.rectangle((500, 480, 540, 560), fill=hexc("#26252a") + (255,))
    rrect(d, (430, 556, 610, 604), 14, fill=hexc("#26252a") + (255,))
    d.ellipse((760, 520, 860, 560), fill=hexc("#c56b3e") + (255,))
    d.rectangle((766, 540, 854, 606), fill=hexc("#c56b3e") + (255,))
    for a in (-60, -20, 20, 60):
        x = 810 + math.sin(math.radians(a)) * 70
        y = 440 - math.cos(math.radians(a)) * 60
        d.ellipse((x - 26, y - 44, x + 26, y + 44), fill=hexc("#3f8f5e") + (255,))
    d.rectangle((806, 470, 814, 540), fill=hexc("#2f6d46") + (255,))
    d.rectangle((200, 300, 212, 600), fill=hexc("#26252a") + (255,))
    d.polygon([(150, 300), (262, 300), (236, 240), (176, 240)], fill=hexc("#ffc145") + (255,))
    d.ellipse((140, 580, 272, 612), fill=hexc("#26252a") + (255,))
    rrect(d, (640, 540, 700, 606), 8, fill=hexc("#fbf4e4") + (255,))
    d.arc((694, 552, 728, 592), 270, 90, fill=hexc("#fbf4e4") + (255,), width=8)
    save(img, "cut/desk.webp")

# the real repositories, as the GitHub API reports them (name, title line, languages with GitHub's colours, stars, forks)
LANG_COLOURS = {"Kotlin": "#A97BFF", "Java": "#b07219", "JavaScript": "#f1e05a", "CSS": "#663399", "HTML": "#e34c26", "Swift": "#F05138", "C#": "#178600", "PHP": "#4F5D95"}
LANG_SNIPPETS = {
    "Kotlin": ["@Composable", "fun ReviewCard(review: Review) {", "    Card(modifier = Modifier.fillMaxWidth()) {", "        Text(review.title, style = typography.titleMedium)",
               "        RatingBar(review.stars)", "    }", "}", "val reviews by viewModel.reviews.collectAsState()", "LazyColumn { items(reviews) { ReviewCard(it) } }", "// swipe to refresh, pull to delete"],
    "Swift": ["struct TripDetailView: View {", "    @State private var expenses: [Expense] = []", "    var body: some View {", "        List(expenses) { Text($0.title) }",
              "            .task { expenses = try await api.load() }", "    }", "}", "let url = URL(string: \"https://api.weather.dev\")!", "let (data, _) = try await URLSession.shared.data(from: url)", "// persisted with Core Data"],
    "Java": ["public class MoodEntry {", "    private final LocalDate day;", "    private final Mood mood;", "    public MoodEntry(LocalDate day, Mood mood) {", "        this.day = day; this.mood = mood;", "    }", "}",
             "List<MoodEntry> week = repo.lastDays(7);", "chart.render(week);", "// sync at midnight"],
    "JavaScript": ["const [friends, setFriends] = useState(initial);", "function splitBill(total, share) {", "  return (total - share).toFixed(2);", "}", "export default function App() {", "  return <FriendsList friends={friends} />;", "}",
                   ".bill { display: grid; gap: 1rem; }", "<button className=\"button\">Split bill</button>", "// who owes whom, settled"],
}

def poster(slug, title, line, langs, stars, forks, i):
    """one 9:16 card per repository, in the manner of a repo page."""
    w, h = 720, 1280
    pal = [("#1e1e2e", "#f9e2af"), ("#0d1117", "#58a6ff"), ("#35326f", "#ffc145"), ("#113a2c", "#5fd068"), ("#2b1d2e", "#f4476b"), ("#1d1712", "#e9a94b")][i % 6]
    img = radial(w, h, pal[1], pal[0], 0.9, 0.0, 0.75)
    img = grain(Image.blend(img, Image.new("RGB", (w, h), hexc(pal[0])), 0.55), 0.1, 24)
    d = ImageDraw.Draw(img)
    d.text((56, 90), "skaur16 /", font=font(MONO, 30), fill=hexc(pal[1]))
    d.text((56, 130), title, font=font(GEIST, 64 if len(title) <= 11 else 52, wght=800), fill=hexc("#fbf4e4"))
    y = 230
    rrect(d, (56, y, 220, y + 40), 20, outline=hexc(pal[1]), width=2)
    d.text((138, y + 20), "Public", font=font(SANS, 18, wght=600), fill=hexc(pal[1]), anchor="mm")
    y += 80
    import textwrap
    for part in re.split(r"<br\s*/?>", line):
        for row in textwrap.wrap(part, 38):
            d.text((56, y), row, font=font(SANS, 26, wght=500), fill=hexc("#e8e4d8"))
            y += 40
    y += 40
    rrect(d, (56, y, w - 56, y + 330), 18, fill=hexc("#0b0b10"))
    f = font(MONO, 21)
    for k, code in enumerate(LANG_SNIPPETS[langs[0][0]][:10]):
        code_line(d, 80, y + 24 + k * 29, code[:40], f, "dark")
    y += 370
    x = 56
    for lang, frac in langs:
        d.rectangle((x, y, x + (w - 112) * frac, y + 12), fill=hexc(LANG_COLOURS.get(lang, "#8a8d96")))
        x += (w - 112) * frac
    y += 30
    x = 56
    for lang, frac in langs:
        d.ellipse((x, y + 4, x + 14, y + 18), fill=hexc(LANG_COLOURS.get(lang, "#8a8d96")))
        d.text((x + 22, y), f"{lang} {frac * 100:.0f}%", font=font(SANS, 18, wght=500), fill=hexc("#e8e4d8"))
        x += 200
    star = [(66 + 10 * math.cos(math.radians(-90 + k * 36)) * (1 if k % 2 == 0 else 0.45), h - 108 + 10 * math.sin(math.radians(-90 + k * 36)) * (1 if k % 2 == 0 else 0.45)) for k in range(10)]
    d.polygon(star, fill=hexc(pal[1]))
    d.text((84, h - 122), f"{stars} star{'' if stars == 1 else 's'}", font=font(SANS, 22, wght=500), fill=hexc(pal[1]))
    d.ellipse((230, h - 114, 242, h - 102), fill=hexc(pal[1]))
    d.text((252, h - 122), f"{forks} fork{'' if forks == 1 else 's'}", font=font(SANS, 22, wght=500), fill=hexc(pal[1]))
    d.text((392, h - 122), "main", font=font(MONO, 22), fill=hexc(pal[1]))
    d.text((56, h - 76), f"github.com/skaur16/{title}", font=font(MONO, 20), fill=hexc("#9a978f"))
    save(img, f"posts/{slug}.jpg")

REPOS = [
    ("reviewspot", "ReviewSpot", "Kotlin, all the way down.<br>Pushed April 2026.", [("Kotlin", 1.0)], 1, 0),
    ("travelbuddy", "TravelBuddy", "Swift. Trips, their details and expenses, over a REST API with data persistence.", [("Swift", 1.0)], 0, 0),
    ("weatherapp", "WeatherApp", "Swift. One page: your location, and the weather there, from a REST API.", [("Swift", 1.0)], 0, 0),
    ("eat-n-split", "eat-n-split", "JavaScript, CSS and HTML.<br>Pushed October 2026.", [("JavaScript", 0.57), ("CSS", 0.26), ("HTML", 0.17)], 0, 0),
    ("moodsync", "MoodSync", "Java.<br>Pushed April 2026.", [("Java", 1.0)], 0, 0),
    ("chitchatapp", "ChitChatApp", "Kotlin.<br>Pushed June 2025.", [("Kotlin", 1.0)], 0, 0),
]

def photo_chip(src, rel):
    """a square crop of a photo for the small chips."""
    im = Image.open(src).convert("RGB")
    side = min(im.size)
    im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width - side) // 2 + side, (im.height - side) // 2 + side)).resize((300, 300), Image.LANCZOS)
    save(im, rel)

def avatar(bg, fg, rel):
    img = Image.new("RGB", (300, 300), hexc(bg))
    d = ImageDraw.Draw(img)
    d.text((150, 158), "SK", font=font(PLAY_I, 150, wght=900), fill=hexc(fg), anchor="mm")
    save(img, rel)

def placeholder_photo(rel, size, c1, c2, note):
    w, h = size
    img = vignette(grain(gradient(w, h, c1, c2, 120), 0.14, 30), 0.25)
    d = ImageDraw.Draw(img)
    d.text((w / 2, h / 2), note, font=font(MARKER, int(min(w, h) * 0.07)), fill=(255, 255, 255), anchor="mm")
    save(img, rel)

def demo_poster():
    w, h = 1280, 720
    img = grain(radial(w, h, "#4a4690", "#1d1b40", 0.5, 0.0, 1.0), 0.1, 24)
    img = with_shadow(img, (140, 90, 1140, 690), 16, blur=50, alpha=160, dy=30)
    d = ImageDraw.Draw(img)
    rrect(d, (140, 90, 1140, 690), 16, fill=hexc("#ffffff"))
    d.rounded_rectangle((140, 90, 1140, 134), radius=16, fill=hexc("#f0f0f4"))
    d.rectangle((140, 120, 1140, 134), fill=hexc("#f0f0f4"))
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        d.ellipse((162 + i * 24, 104, 178 + i * 24, 120), fill=hexc(c))
    rrect(d, (400, 100, 880, 124), 12, fill=hexc("#ffffff"))
    d.text((640, 112), "app.skaur.dev", font=font(MONO, 14), fill=hexc("#6b6f78"), anchor="mm")
    d.rectangle((140, 134, 360, 690), fill=hexc("#f7f7fa"))
    for i in range(7):
        rrect(d, (164, 160 + i * 44, 300 + (i % 3) * 12, 184 + i * 44), 6, fill=hexc("#ffc145") if i == 1 else hexc("#dcdde3"))
    d.text((392, 164), "Release notes", font=font(GEIST, 34, wght=800), fill=hexc("#1b1b1b"))
    d.text((392, 212), "v3.2.0 · shipped on a Friday", font=font(SANS, 18, wght=500), fill=hexc("#6b6f78"))
    for r in range(2):
        for c in range(3):
            x, y = 392 + c * 248, 260 + r * 190
            rrect(d, (x, y, x + 228, y + 170), 12, fill=hexc("#ffffff"), outline=hexc("#e6e8ee"), width=2)
            rrect(d, (x + 16, y + 16, x + 120, y + 26), 3, fill=hexc("#35326f"))
            rrect(d, (x + 16, y + 40, x + 200, y + 48), 3, fill=hexc("#dcdde3"))
            rrect(d, (x + 16, y + 58, x + 170, y + 66), 3, fill=hexc("#dcdde3"))
            rrect(d, (x + 16, y + 120, x + 100, y + 150), 8, fill=hexc(["#ffc145", "#5fd068", "#58a6ff"][(r + c) % 3]))
    save(img, "img/demo.jpg")

def share_card():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), hexc("#ffffff"))
    d = ImageDraw.Draw(img)
    d.text((70, 62), "SHARN", font=font(PLAY, 40, wght=900), fill=hexc("#000000"))
    d.text((70, 200), "Sharn's story,", font=font(PLAY_I, 74, wght=600), fill=hexc("#1b1b1b"))
    d.text((70, 290), "in Sharn's words.", font=font(PLAY_I, 74, wght=600), fill=hexc("#1b1b1b"))
    d.text((70, 420), "A developer's story in eight voice notes.", font=font(SANS, 28, wght=500), fill=hexc("#5d5d5d"))
    d.text((70, 540), "skaur.dev", font=font(MONO, 30), fill=hexc("#35326f"))
    img = with_shadow(img, (760, 170, 1140, 410), 12, blur=40, alpha=110, dy=30)
    d = ImageDraw.Draw(img)
    draw_cassette(d, 760, 170, 380)
    d.text((950, 222), "Sharn's Story", font=font(MARKER, 38), fill=hexc("#35326f"), anchor="mm")
    save(img, "share.jpg")

def icon():
    img = Image.new("RGB", (180, 180), hexc("#35326f"))
    d = ImageDraw.Draw(img)
    rrect(d, (18, 44, 162, 136), 14, fill=hexc("#fbf4e4"))
    for cx in (62, 118):
        d.ellipse((cx - 22, 68, cx + 22, 112), fill=hexc("#35326f"))
        d.ellipse((cx - 9, 81, cx + 9, 99), fill=hexc("#fbf4e4"))
    save(img, "icon.png")

if __name__ == "__main__":
    reel_strip()
    cover_waterloo()
    cover_lines()
    cover_junior()
    cover_standup()
    cover_prod()
    cover_mentor()
    cover_bonus()
    cutout_laptop()
    cutout_desk()
    for i, (slug, title, line, langs, stars, forks) in enumerate(REPOS):
        poster(slug, title, line, langs, stars, forks, i)
    photo = os.environ.get("AVATAR")
    if photo and os.path.exists(photo):
        photo_chip(photo, "cut/github.webp")
        photo_chip(photo, "cut/linkedin.webp")
    else:
        avatar("#24292f", "#ffffff", "cut/github.webp")
        avatar("#0a66c2", "#ffffff", "cut/linkedin.webp")
    placeholder_photo("img/stamp.webp", (729, 800), "#f4b84d", "#cd2b6f", "a small photo")
    placeholder_photo("p/polaroid.webp", (1500, 1000), "#4a4690", "#f4476b", "a photo of you")
    demo_poster()
    share_card()
    icon()
