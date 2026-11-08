// The page, moved by hand: the pencil, the scroll, the reel of film, the player and all of its sounds.
// Ported from the original as is; everything personal comes from src/data.
import { site } from "../data/site";
import { stories } from "../data/stories";
import { posts } from "../data/posts";
import { CAPTIONS } from "../data/captions";

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  history.scrollRestoration = "manual";
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutSoft = (t) => 1 - Math.pow(1 - t, 1.6);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- The tapes and the deck are already on the page; this script only drives them ----------
  const rail = $("rail");
  const lines = CAPTIONS;
  const N = stories.length;
  const cards = [...rail.children];
  const scripts = cards.map((c) => c.querySelector(".script"));

  // ---------- The reel: a 35mm film strip that runs behind the page, and in front of it once or twice ----------
  const tapeBack = $("tape"), tapeFront = $("tapeFront");
  const layers = [tapeBack.getContext("2d"), tapeFront.getContext("2d")];
  const STEP = 4;
  let px = new Float32Array(0), py = px, nx = px, ny = px, front = new Uint8Array(0), count = 0, stripH = 76;
  let filmSteps = [], filmAt = new Float32Array(0), filmW = 1, pitch = 118, textMasks = [];

  // every frame of the reel lives in one contact sheet: 67 different photos, ordered so look-alikes sit far apart
  const FRAMES = 67, SHEET_COLS = 10, CELL_W = 378, CELL_H = 180;
  const sheet = new Image();
  sheet.src = "/assets/reel/strip.webp";

  // painted once at high resolution; every frame of scrolling only samples it
  function paintFilm() {
    const H = stripH, n = FRAMES;
    pitch = Math.round(H * 1.56);
    filmW = pitch * n;
    const extra = 64; // the thin end samples long slices, so a slice can run this far past the seam
    const S = 3;
    const film = document.createElement("canvas");
    film.width = Math.ceil((filmW + extra) * S);
    film.height = Math.round(H * S);
    const g = film.getContext("2d");
    g.roundRect ??= g.rect; // older Safari: square corners rather than a page that won't start
    g.scale(S, S);
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#1d1712"); base.addColorStop(0.5, "#120e0b"); base.addColorStop(1, "#1d1712");
    const paint = (ox, shown) => {
      g.save();
      g.translate(ox, 0);
      g.fillStyle = base;
      g.fillRect(0, 0, filmW, H);
      const m = H * 0.17, fh = H - m * 2;
      for (let i = 0; i < shown; i++) {
        const x = i * pitch + 7, w = pitch - 14;
        g.save();
        g.beginPath();
        g.roundRect(x, m, w, fh, 3);
        g.clip();
        if (sheet.naturalWidth) {
          g.filter = "saturate(.92) contrast(1.04) sepia(.1)";
          g.drawImage(sheet, (i % SHEET_COLS) * CELL_W, Math.floor(i / SHEET_COLS) * CELL_H, CELL_W, CELL_H, x, m, w, fh);
          g.filter = "none";
        } else {
          g.fillStyle = "#3a2c22";
          g.fillRect(x, m, w, fh);
        }
        g.fillStyle = "rgba(255,190,110,.07)";
        g.fillRect(x, m, w, fh);
        g.restore();
        // the printed edge markings between the holes
        g.fillStyle = "#e9a94b";
        g.font = `${Math.max(4, H * 0.075)}px "Share Tech Mono", monospace`;
        g.textBaseline = "middle";
        g.save();
        g.translate(i * pitch + 3.4, H / 2);
        g.rotate(-Math.PI / 2);
        g.textAlign = "center";
        g.fillText(`${site.filmCode} 5219  ${String(i + 1).padStart(2, "0")}A`, 0, 0);
        g.restore();
      }
      g.restore();
    };
    paint(0, n);
    paint(filmW, 1); // the seam repeats so a slice can run past the end
    // sprocket holes, punched right through
    g.globalCompositeOperation = "destination-out";
    const hole = Math.max(3.6, H * 0.075), hh = H * 0.085, gap = pitch / 8;
    for (let x = gap / 2; x < filmW + extra; x += gap) {
      for (const y of [H * 0.045, H - H * 0.045 - hh]) {
        g.beginPath();
        g.roundRect(x - hole / 2, y, hole, hh, 1.2);
        g.fill();
      }
    }
    g.globalCompositeOperation = "source-atop";
    // the gloss along the base, and the odd hairline scratch
    const gloss = g.createLinearGradient(0, 0, 0, H);
    gloss.addColorStop(0, "rgba(255,255,255,.2)"); gloss.addColorStop(0.1, "rgba(255,255,255,.03)");
    gloss.addColorStop(0.5, "rgba(255,255,255,0)"); gloss.addColorStop(0.9, "rgba(255,255,255,.03)"); gloss.addColorStop(1, "rgba(255,255,255,.14)");
    g.fillStyle = gloss;
    g.fillRect(0, 0, filmW + extra, H);
    g.strokeStyle = "rgba(255,240,220,.06)";
    g.lineWidth = 0.4;
    for (let i = 0; i < 22; i++) {
      const x = (i * 97) % filmW;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, H); g.stroke();
    }
    // the strip leaves the slot as a miniature of itself, so keep a ladder of half-size copies and sample
    // the one closest to the size on screen. Each is cut into tiles: one canvas this long is wider than a
    // graphics card can hold, and the browser would redraw it the slow way on every frame of scrolling
    filmSteps = [];
    for (let big = film, scale = S; ; scale /= 2) {
      filmSteps.push({ tiles: cutTiles(big), scale, height: big.height });
      if (big.height <= 10) break;
      const next = document.createElement("canvas");
      next.width = Math.ceil(big.width / 2);
      next.height = Math.ceil(big.height / 2);
      const n2 = next.getContext("2d");
      n2.imageSmoothingQuality = "high";
      n2.drawImage(big, 0, 0, next.width, next.height);
      big = next;
    }
  }
  const TILE = 4096, TILE_LAP = 256, TILE_STRIDE = TILE - TILE_LAP; // the overlap is longer than any one slice
  function cutTiles(big) {
    const tiles = [];
    for (let x = 0; x < big.width; x += TILE_STRIDE) {
      const t = document.createElement("canvas");
      t.width = Math.min(TILE, big.width - x);
      t.height = big.height;
      t.getContext("2d").drawImage(big, -x, 0);
      tiles.push(t);
    }
    return tiles;
  }
  sheet.addEventListener("load", () => { paintFilm(); wake(); });

  function buildTape(box, cardList, parts2) {
    const narrow = vw <= 760;
    // a phone resizes every time its address bar slides away, so only repaint when the strip really changes
    if (stripH !== (narrow ? 46 : 76) || !filmSteps.length) {
      stripH = narrow ? 46 : 76;
      paintFilm();
    }
    const shot = (c) => box(c.querySelector(".shot")), first = shot(cardList[0]), whole = box(cardList[0]);
    // the strip's home in the rail: a long, slow line under the captions
    const tallest = Math.max(...cardList.map((c) => box(c).h));
    const band = Math.min(whole.y + tallest + stripH * 0.95, parts2.worksEnd - stripH * 0.7);
    // it leaves the slot square to the cassette's edge, then bends away to the right
    const slot = window.cassette3d?.mouth, ready = slot && slot.y > 0;
    const start = ready ? [slot.x, slot.y - 8, 0] : [vw / 2, vh * 0.72, 0];
    const pts = [start, [start[0] - vw * 0.012, start[1] + vh * 0.09, 0], [start[0] + vw * 0.03, start[1] + vh * 0.2, 0]];
    const c0 = first.x + first.w * 0.86;
    pts.push([Math.max(c0, vw * 0.6), parts2.worksTop + 40, 0], [c0, first.y + first.h * 0.6, 0], [c0 + 6, band + 26, 0], [first.x + first.w + 30, band + 32, 0], [first.x + first.w * 1.3, band + 24, 0]);
    cardList.forEach((c, i) => {
      if (i === 0) return;
      const r = shot(c), wave = i % 2 ? 12 : -12;
      // the card after a loop already has the strip landing on its right, so it must not double back
      if (narrow || (i !== 3 && i !== 6)) pts.push([r.x + r.w * 0.5, band + wave, 0]);
      const n = cardList[i + 1] && shot(cardList[i + 1]);
      if (!narrow && n && (i === 2 || i === 5)) {
        // straight up behind this card, a wide arc over the gap, straight down across the next.
        // it always crosses a card's top and bottom edges square on, well clear of its sides
        const up = r.x + r.w * 0.88, down = n.x + n.w * 0.84;
        pts.push([r.x + r.w * 0.8, band + 8, 0], [up, band - 30, 0], [up, r.y + r.h * 0.5, 0], [up, r.y - 14, 0], [(up + down) / 2, r.y - 66, 1], [down, r.y - 14, 1],
          [down, r.y + r.h * 0.5, 1], [down, band - 30, 1], [n.x + n.w * 0.92, band + 30, 0], [n.x + n.w + 20, band + 36, 0], [n.x + n.w * 1.4, band + 26, 0]);
      }
    });
    const S = railRun, m = box(parts2.media), pol = box(parts2.polaroid), head = box(parts2.head), row = box(parts2.posts), words = box(parts2.words);
    // behind the video, a long sweep left, down past the heading, across behind the posts,
    // behind the polaroid, a long sweep back left, and away under the footer. The margins shrink with the screen, so a phone sees all of it too;
    // there the words run edge to edge, so the film slips off the side past them and comes back behind the polaroid
    const sweep = (Math.max(m.y + m.h, words.y + words.h) + head.y) / 2, k = Math.min(1, vw / 1280);
    pts.push([S + m.x + m.w * 0.86, parts2.worksEnd - 30, 0], [S + m.x + m.w * 0.72, m.y + m.h * 0.3, 0], [S + m.x + m.w * 0.46, m.y + m.h + 20, 0],
      [S + vw * 0.34, sweep, 0], [S + vw * 0.1, sweep + 20, 0], [S - 170 * k, head.y + 40, 0], [S - 210 * k, row.y + row.h * 0.4, 0], [S - 90 * k, row.y + row.h * 0.74, 0],
      [S + vw * 0.2, row.y + row.h * 0.8, 0], [S + vw * 0.5, row.y + row.h * 0.62, 0], [S + vw * 0.8, row.y + row.h * 0.72, 0], [S + vw + 60 * k, row.y + row.h * 0.92, 0],
      [S + (narrow ? vw + 40 : vw - 40 * k), row.y + row.h + 150 * k, 0], [S + (narrow ? vw + 40 : vw - 150 * k), pol.y + 40, 0], [S + vw - 210 * k, pol.y + pol.h * 0.7, 0], [S + vw * 0.72, parts2.closer + 52, 0],
      [S + vw * 0.42, parts2.closer + 66, 0], [S + vw * 0.09, parts2.closer + vh * 0.2, 0], [S + vw * 0.11, parts2.foot - 170, 0], [S + vw * 0.26, parts2.foot + 60, 0]);

    // Catmull-Rom through the anchors, resampled at even steps
    const xs = [pts[0][0]], ys = [pts[0][1]], fr = [0];
    let run = 0, qx = pts[0][0], qy = pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const steps = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const cx = 0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3);
        const cy = 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3);
        run += Math.hypot(cx - qx, cy - qy);
        qx = cx; qy = cy;
        if (run >= STEP) { xs.push(cx); ys.push(cy); fr.push(p1[2]); run = 0; }
      }
    }
    // round every corner: a wide running average, held still where the film leaves the slot
    const n = xs.length, R = narrow ? 18 : 34, hold0 = 60;
    let ax = Float64Array.from(xs), ay = Float64Array.from(ys);
    for (let pass = 0; pass < 5; pass++) {
      const cx = new Float64Array(n + 1), cy = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) { cx[i + 1] = cx[i] + ax[i]; cy[i + 1] = cy[i] + ay[i]; }
      const bx = new Float64Array(n), by = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const r = Math.min(R, Math.floor(Math.max(0, i - hold0 * 0.2) * 0.5), n - 1 - i);
        bx[i] = (cx[i + r + 1] - cx[i - r]) / (2 * r + 1);
        by[i] = (cy[i + r + 1] - cy[i - r]) / (2 * r + 1);
      }
      ax = bx; ay = by;
    }
    // back to even spacing, so the film runs at one speed along the curve
    const ex = [ax[0]], ey = [ay[0]], ef = [0];
    let gone = 0;
    for (let i = 1; i < n; i++) {
      const seg = Math.hypot(ax[i] - ax[i - 1], ay[i] - ay[i - 1]);
      gone += seg;
      while (gone >= STEP) {
        gone -= STEP;
        const t = seg ? 1 - gone / seg : 1;
        ex.push(ax[i - 1] + (ax[i] - ax[i - 1]) * t);
        ey.push(ay[i - 1] + (ay[i] - ay[i - 1]) * t);
        ef.push(fr[i]);
      }
    }
    count = ex.length;
    px = Float32Array.from(ex); py = Float32Array.from(ey); front = Uint8Array.from(ef);
    nx = new Float32Array(count); ny = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.max(0, i - 3), v = Math.min(count - 1, i + 3);
      const dx = px[v] - px[u], dy = py[v] - py[u], l = Math.hypot(dx, dy) || 1;
      nx[i] = dx / l; ny[i] = dy / l; // the direction of travel
    }
    // true perspective: where the strip is thin the frames are smaller too, so more film passes per pixel
    filmAt = new Float32Array(count);
    for (let i = 1; i < count; i++) filmAt[i] = filmAt[i - 1] + STEP / openAt(i);
  }
  const openRun = () => (vw > 760 ? 620 : 380) / STEP; // samples over which the film opens out to full size
  // how far the film has opened, 0.13 at the slot to 1 at full size
  function openAt(q) {
    const t = Math.min(1, q / openRun());
    return 0.13 + 0.87 * t * t * (3 - 2 * t);
  }

  function drawTape(top, x, reveal, mouth, creep, feeding) {
    layers[0].setTransform(dprNow, 0, 0, dprNow, 0, 0);
    layers[1].setTransform(dprNow, 0, 0, dprNow, 0, 0);
    layers[0].clearRect(0, 0, vw, vh);
    layers[1].clearRect(0, 0, vw, vh);
    if (!count || !filmSteps.length || reveal <= 0) return;
    const near = top < vh * 1.1;
    const ox = near ? mouth.x - px[0] : 0, oy = near ? mouth.y + top - py[0] : 0;
    const limit = Math.min(count - 2, Math.floor(reveal));
    const pad = stripH + 30;
    const grow = openRun();
    const pull = (q) => (q < 40 ? Math.pow(1 - q / 40, 2) : 0); // the first stretch bends to the slot
    // shadow first, as one soft line per layer
    for (const L of [0, 1]) {
      const c = layers[L];
      c.beginPath();
      let pen = false;
      for (let i = Math.round(grow * 0.75); i <= limit; i += 3) {
        const wx = px[i] - x, wy = py[i] - top;
        if (front[i] !== L || wx < -pad || wx > vw + pad || wy < -pad || wy > vh + pad) { pen = false; continue; }
        const k = pull(i);
        if (pen) c.lineTo(wx + ox * k + 5, wy + oy * k + 11); else { c.moveTo(wx + ox * k + 5, wy + oy * k + 11); pen = true; }
      }
      c.lineJoin = "round";
      c.strokeStyle = `rgba(25,18,12,${L ? 0.16 : 0.09})`;
      c.lineWidth = stripH * 0.96;
      c.stroke();
    }
    // narrow as it leaves the slot, opening out as if it is coming towards you
    const heightAt = (q) => {
      const h = stripH * openAt(q);
      return feeding ? h * Math.max(0.3, Math.min(1, (reveal - q) / 22)) : h; // the leader tapers while it is still feeding out
    };
    for (let i = 0; i <= limit;) {
      const wx = px[i] - x, wy = py[i] - top;
      if (wx < -pad || wx > vw + pad || wy < -pad || wy > vh + pad) { i++; continue; }
      const c = layers[front[i]];
      // one long slice where the strip runs straight, finer ones where it is thin or bending
      let span = 1;
      if (i >= grow) while (span < 8 && i + span < limit && front[i + span] === front[i] && nx[i] * nx[i + span] + ny[i] * ny[i + span] > 0.9999) span++;
      const j = Math.min(i + span, limit), parts = i < grow || nx[i] * nx[j] + ny[i] * ny[j] < 0.9995 ? 2 : 1;
      for (let s = 0; s < parts; s++) {
        const f = s / parts, q = i + f * span;
        const k = pull(q), h = heightAt(q);
        const ax = nx[i] + (nx[j] - nx[i]) * f, ay = ny[i] + (ny[j] - ny[i]) * f, al = Math.hypot(ax, ay) || 1;
        const sx = wx + (px[j] - px[i]) * f + ox * k, sy = wy + (py[j] - py[i]) * f + oy * k;
        const along = filmAt[i] + (filmAt[j] - filmAt[i]) * f;
        const u = (((along - creep) % filmW) + filmW) % filmW, len = STEP * span / parts + 1.4, run = len / openAt(q);
        let step = 0;
        while (step < filmSteps.length - 1 && filmSteps[step + 1].height >= h * dprNow) step++;
        const { tiles, scale, height } = filmSteps[step];
        const at = u * scale, t = Math.min(tiles.length - 1, Math.floor(at / TILE_STRIDE));
        c.setTransform(dprNow * ax / al, dprNow * ay / al, -dprNow * ay / al, dprNow * ax / al, dprNow * sx, dprNow * sy);
        if (tiles[t]) c.drawImage(tiles[t], at - t * TILE_STRIDE, 0, run * scale, height, -0.7, -h / 2, len, h); // a page opened at no size has no sane position yet, and one bad frame must not stop the site
      }
      i += span;
    }
    // the film slips under every line of text instead of crossing it
    for (const c of layers) {
      c.setTransform(dprNow, 0, 0, dprNow, 0, 0);
      c.globalCompositeOperation = "destination-out";
      for (const m of textMasks) {
        const mx = m.x - (m.inRail ? x : 0), my = m.y - top;
        if (mx < vw && my < vh && mx + m.soft.width > 0 && my + m.soft.height > 0) c.drawImage(m.soft, mx, my);
      }
      c.globalCompositeOperation = "source-over";
    }
  }

  // a soft-edged patch that hugs each line of words, measured from the text itself so it fits any screen
  const TEXT = ".lede, .hero h1, .card h3, .card > p, .lede2, .scrawl, .beyond h2, .proof header, .side em, .about h2, .about p, .closer h2";
  const PAD = 10, BLUR = 10, EDGE = PAD + BLUR; // clear for PAD past the words, gone by EDGE
  function maskFor(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect(), soft = document.createElement("canvas");
    soft.width = r.width + EDGE * 2;
    soft.height = r.height + EDGE * 2;
    const g = soft.getContext("2d");
    g.shadowColor = "#000";
    g.shadowBlur = BLUR;
    g.shadowOffsetX = soft.width; // only the blurred shadow lands on the canvas, never the hard shape
    g.beginPath();
    for (const line of range.getClientRects()) {
      g.rect(line.left - r.left + BLUR - soft.width, line.top - r.top + BLUR, line.width + PAD * 2, line.height + PAD * 2);
    }
    g.fill();
    const waiting = el.closest(".rv:not(.in)") ? 20 : 0; // still sitting above its spot until it is revealed
    return { soft, x: r.left - EDGE, y: r.top - EDGE + waiting, inRail: !!el.closest(".rail") };
  }

  // the Story heading gets a wider patch: the film melts away from its sides, right down to the cards
  function headingMask(head, cardTop) {
    const edge = 90, soft = document.createElement("canvas");
    soft.width = head.w + edge * 2;
    soft.height = cardTop - head.y + 34;
    const g = soft.getContext("2d"), fade = g.createLinearGradient(0, 0, soft.width, 0), e = edge / soft.width;
    fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(e, "#000"); fade.addColorStop(1 - e, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, soft.width, soft.height);
    return { soft, x: head.x - edge, y: head.y - 34, inRail: false };
  }

  // ---------- Layout: the page is moved by hand so the cards can pin ----------
  const page = $("page"), works = $("story");
  // the pencil has to go in before the tape moves: that click is also what lets the browser play sound
  let armed = true, arming = false, tries = 0, lastTry = 0;
  let dprNow = 1, sA = 0, socialTop = 0, vw = 0, vh = 0, hold = 1, railRun = 0, worksTop = 0, pageH = 1, cardX = [], cardW = 0, reveals = [];

  function layout() {
    vw = root.clientWidth;
    vh = innerHeight;
    hold = vh * 1.1; // the pencil winds the tape here before the page moves
    pageH = page.offsetHeight;
    const prev = page.style.transform;
    page.style.transform = "none";
    rail.style.transform = "none";
    worksTop = works.offsetTop;
    railRun = Math.max(0, rail.scrollWidth - vw);
    cardX = cards.map((c) => c.offsetLeft);
    cardW = cards[0].offsetWidth;
    socialTop = $("social").offsetTop;
    const top = (el) => el.getBoundingClientRect().top;
    reveals = [...document.querySelectorAll(".rv")].map((el) => ({ el, y: top(el) }));
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    dprNow = Math.min(devicePixelRatio || 1, 2);
    [tapeBack, tapeFront].forEach((cv, i) => {
      cv.width = vw * dprNow;
      cv.height = vh * dprNow;
      cv.style.height = `${vh}px`;
      layers[i].setTransform(dprNow, 0, 0, dprNow, 0, 0);
    });
    const button = box(talk);
    talkMiddle = button.y + button.h / 2;
    const video = box(yt);
    ytMiddle = video.y + video.h / 2;
    textMasks = [headingMask(box(works.querySelector("h2")), box(cards[0].querySelector(".shot")).y), ...[...document.querySelectorAll(TEXT)].map(maskFor)];
    buildTape(box, cards, {
      media: $("beyondMedia"), polaroid: $("polaroid"), worksTop, worksEnd: worksTop + works.offsetHeight,
      head: $("socialHead"), posts: $("posts"), words: $("beyondText"),
      closer: top(document.querySelector(".closer")), foot: top(document.querySelector(".foot")),
    });
    // sample where the tape leaves the first screen
    sA = 0;
    while (sA < count - 1 && py[sA] < vh * 0.98 && px[sA] < vw) sA++;
    page.style.transform = prev;
    rail.style.transform = "";
    document.body.style.height = `${hold + railRun + pageH}px`;
  }
  // scroll position to page position: hold, run, pin, run
  function place(s) {
    const t = Math.max(0, s - hold);
    // the page hands over to the rail on a soft curve, so the scroll turns the corner instead of hitting it
    const x = bend(t - worksTop) - bend(t - worksTop - railRun);
    return { top: t - x, x };
  }
  const CORNER = 80;
  const bend = (d) => (d <= -CORNER ? 0 : d >= CORNER ? d : (d + CORNER) ** 2 / (4 * CORNER));
  const scrollFor = (top) => hold + (top > worksTop ? top + railRun : top);

  // ---------- Sound: synthesised, tied to the machine ----------
  const soundBtn = $("sound");
  let ac = null, out = null, primed = false, noise = null, soundOn = true, whirGain = null, whirFilter = null, windGain = null, windOsc = null;
  const voice = new Audio();
  voice.preload = "none";
  function startAudio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (err) { ac = null; return; }
      ac.onstatechange = () => { if (ac.state === "suspended" && !document.hidden) ac.resume()?.catch?.(() => {}); };
      out = ac.createGain(); // everything synthesised runs through here, so mute and hidden tabs cut it at once
      out.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = noise; src.loop = true;
      whirFilter = ac.createBiquadFilter();
      whirFilter.type = "bandpass"; whirFilter.frequency.value = 500; whirFilter.Q.value = 0.8;
      whirGain = ac.createGain();
      whirGain.gain.value = 0;
      src.connect(whirFilter).connect(whirGain).connect(out);
      src.start();
      // the fast-rewind motor: a thin rising whine
      windOsc = ac.createOscillator();
      windOsc.type = "sawtooth";
      windOsc.frequency.value = 220;
      const soft = ac.createBiquadFilter();
      soft.type = "lowpass"; soft.frequency.value = 1400;
      windGain = ac.createGain();
      windGain.gain.value = 0;
      windOsc.connect(soft).connect(windGain).connect(out);
      windOsc.start();
    }
    if (ac.state !== "running") ac.resume()?.catch?.(() => {});
  }
  // a gesture is the only thing that unlocks sound: older iPhones also want something played inside it,
  // and the audio session keeps the cassette audible with the ringer switch off, as the voice notes already are
  function gesture() {
    startAudio();
    if (primed || !ac) return;
    primed = true;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (err) {}
    const blip = ac.createBufferSource();
    blip.buffer = ac.createBuffer(1, 1, 22050);
    blip.connect(ac.destination);
    blip.start(0);
  }
  function setOut() {
    if (out) out.gain.setTargetAtTime(soundOn && !document.hidden ? 1 : 0, ac.currentTime, 0.02);
  }
  const audible = () => ac && soundOn && ac.state === "running";
  function tick(level, pitch) {
    if (!audible()) return;
    const t = ac.currentTime, src = ac.createBufferSource(), bandp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    bandp.type = "bandpass"; bandp.frequency.value = pitch; bandp.Q.value = 6;
    g.gain.setValueAtTime(level * 8, t); // a narrow band of noise comes out quiet: this lifts a click to about -14 dB, audible on laptop speakers
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(bandp).connect(g).connect(out);
    src.start(t, Math.random(), 0.04);
  }
  function thunk(freq = 190, level = 0.4) {
    if (!audible()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.37, t + 0.09);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.15);
    tick(level * 0.5, 2400); // the edge of the hit; any louder and the two layers clip together
  }
  // Browsers keep audio locked until a click, tap or key; a scroll doesn't count. Ask on load, and again on every gesture.
  ["pointerdown", "pointerup", "click", "keydown", "touchstart", "touchend"].forEach((e) => addEventListener(e, gesture, { capture: true, passive: true }));
  ["pageshow", "focus"].forEach((e) => addEventListener(e, startAudio));
  document.addEventListener("visibilitychange", () => { setOut(); if (!document.hidden) startAudio(); });

  // every key on the machine makes the same recorded press
  const keyFile = fetch("/assets/audio/key.mp3").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  let keySound = null;
  function press() {
    if (!audible() || !keySound) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = keySound;
    g.gain.value = 0.7;
    src.connect(g).connect(out);
    src.start();
  }
  addEventListener("load", async () => {
    startAudio();
    const raw = await keyFile;
    if (raw && ac) keySound = await ac.decodeAudioData(raw).catch(() => null);
  });
  document.querySelectorAll(".key").forEach((k) => {
    let held = 0;
    // a quick tap is over before the eye sees it, so the key stays down a moment
    const down = () => {
      startAudio();
      press();
      k.classList.add("down");
      clearTimeout(held);
      held = setTimeout(() => k.classList.remove("down"), 150);
    };
    k.addEventListener("pointerdown", down);
    k.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) down(); });
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    voice.muted = !soundOn;
    setOut();
    syncVideo();
    root.classList.toggle("muted", !soundOn);
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.setAttribute("aria-label", soundOn ? "Turn sound off" : "Turn sound on");
  });

  // ---------- The player ----------
  const now = $("now"), nowText = $("nowText"), ready = nowText.innerHTML, clock = $("clock"), screen = $("screen"), keys = $("keys");
  let track = 0, playing = false;

  let reading = -1, shown = -1;
  function showState() {
    cards.forEach((c, i) => {
      const on = playing && i === track, open = on || reading === i;
      c.classList.toggle("flip", open);
      c.classList.toggle("reading", reading === i);
      c.querySelector(".front").inert = open;
      c.querySelector(".back").inert = !open;
      c.querySelector(".close span").textContent = on ? "Stop" : "Flip back";
      c.querySelector(".close path").setAttribute("d", on ? "M6 6h12v12H6z" : "M4 12l8-7v4h8v6h-8v4z");
      if (!on) {
        c.querySelector(".bar").style.transform = "scaleX(0)";
        c.querySelector(".clock").textContent = "";
      }
    });
    if (!playing) shown = -1;
    root.classList.toggle("playing", playing);
    root.classList.toggle("rewinding", rewinding);
    if (playing) nowText.textContent = stories[track].title;
    else if (rewinding) nowText.textContent = "Rewinding";
    else if (keys.classList.contains("ending")) nowText.innerHTML = "<span>End of tape &ndash;</span> Be kind, rewind";
    else nowText.innerHTML = ready;
    if (!playing) { clock.textContent = "00:00"; screen.style.setProperty("--p", 0); }
    // a title too long for the display runs along it
    const over = nowText.offsetWidth - now.clientWidth;
    now.classList.toggle("long", over > 0);
    now.style.setProperty("--run", `${-over}px`);
    wake();
  }
  // the bonus track bows out as the closing button comes up. iPhones ignore volume here, so there it simply stops when the fade would end
  let fadeStep = 0, fadeEnd = 0;
  function fadeOut() {
    endFade(); // scrolling past the button twice must not leave a second fade running
    fadeStep = setInterval(() => { voice.volume = Math.max(0, voice.volume - 0.05); }, 40);
    fadeEnd = setTimeout(stop, 800);
  }
  function endFade() {
    clearInterval(fadeStep);
    clearTimeout(fadeEnd);
    voice.volume = 1;
  }
  function play(i) {
    endFade();
    startAudio();
    rail.classList.add("heard");
    if (ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
    mountPlayer();
    track = i;
    reading = -1;
    scripts[i].querySelectorAll("span").forEach((l) => { l.className = ""; });
    scripts[i].style.transform = "translate3d(0, 0, 0)";
    retried = false;
    voice.src = `/assets/audio/${stories[i].audio}`;
    playing = true;
    startVoice();
    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: stories[i].title, artist: site.fullName });
    }
    showState();
  }
  function stop() {
    clearTimeout(watch);
    voice.pause();
    endFade();
    playing = false;
    showState();
  }
  // if a note won't start or stalls for good: try once more from the same spot, then open its words instead
  let retried = false, watch = 0;
  function startVoice() {
    clearTimeout(watch);
    watch = setTimeout(stuck, 9000);
    voice.play()?.catch?.((err) => { if (err.name !== "AbortError" && playing) retry(); });
  }
  function stuck() { if (playing && voice.readyState < 3) retry(); }
  function retry() {
    if (retried) {
      const words = track;
      stop();
      reading = words;
      showState();
      return;
    }
    retried = true;
    const at = voice.currentTime;
    voice.load();
    voice.currentTime = at;
    startVoice();
  }
  voice.addEventListener("ended", () => { thunk(240, 0.22); stop(); });
  voice.addEventListener("playing", () => clearTimeout(watch));
  voice.addEventListener("waiting", () => { clearTimeout(watch); watch = setTimeout(stuck, 12000); });
  voice.addEventListener("error", () => { if (playing) retry(); });
  // a phone call, headphones or a media key can pause the note from outside: the card follows
  voice.addEventListener("pause", () => { if (playing && voice.paused && !voice.ended) stop(); });
  addEventListener("pagehide", () => { if (playing) stop(); });
  // an embedded player can't be heard from here, so pressing play inside it counts as leaving the note
  addEventListener("blur", () => { if (playing && document.activeElement?.tagName === "IFRAME") stop(); });
  try {
    navigator.mediaSession?.setActionHandler("pause", stop);
    navigator.mediaSession?.setActionHandler("stop", stop);
  } catch (err) {}

  let gliding = 0, endGlide = null;
  function glide(to, dur, done) {
    endGlide?.(); // a glide already running must still report back, or Rewind never lets go
    const from = scrollY, began = performance.now(), id = ++gliding;
    const finish = (ok) => {
      removeEventListener("wheel", cancel);
      removeEventListener("touchstart", cancel);
      endGlide = null;
      if (done) done(ok);
    };
    const cancel = () => { gliding++; finish(false); };
    endGlide = cancel;
    addEventListener("wheel", cancel, { passive: true });
    addEventListener("touchstart", cancel, { passive: true });
    (function step(t0) {
      if (id !== gliding) return;
      const t = clamp((t0 - began) / dur, 0, 1);
      scrollTo(0, from + (to - from) * easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else finish(true);
    })(began);
  }
  // scroll position that brings a card to the middle of the rail
  const cardScroll = (i) => hold + worksTop + clamp(cardX[i] - (vw - cards[i].offsetWidth) / 2, 0, railRun);

  cards.forEach((c, i) => {
    c.querySelector(".front .key").addEventListener("click", () => play(i));
    c.querySelector(".read").addEventListener("click", () => {
      if (playing) stop();
      rail.classList.add("heard");
      reading = i;
      scripts[i].style.transform = "";
      scripts[i].querySelectorAll("span").forEach((l) => { l.className = ""; });
      showState();
      tick(0.2, 2200);
    });
    c.querySelector(".close").addEventListener("click", () => {
      reading = -1;
      stop();
    });
  });

  // the line being spoken rises to the middle of the card, the way lyrics follow a song
  function followVoice() {
    const list = lines[track], card = cards[track], t = voice.currentTime || 0;
    let at = 0;
    while (at < list.length - 1 && list[at + 1][0] - 0.12 <= t) at++; // a beat early: the eye needs a moment to catch a word
    if (voice.duration) {
      const done = (t / voice.duration).toFixed(4);
      card.querySelector(".bar").style.transform = `scaleX(${done})`;
      screen.style.setProperty("--p", done);
    }
    const sec = Math.floor(t), stamp = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    card.querySelector(".clock").textContent = stamp;
    clock.textContent = stamp.padStart(5, "0");
    if (at === shown) return;
    shown = at;
    const spans = scripts[track].children, box = scripts[track].parentElement;
    for (let i = 0; i < spans.length; i++) spans[i].className = i === at ? "cur" : i < at ? "past" : "";
    const line = spans[at];
    scripts[track].style.transform = `translate3d(0, ${(box.offsetHeight * 0.4 - line.offsetTop - line.offsetHeight / 2).toFixed(1)}px, 0)`;
  }
  $("kStop").addEventListener("click", stop);
  // Rewind: everything runs back and the tape winds into the cassette
  let rewinding = false;
  const kRew = $("kRew");
  kRew.addEventListener("click", () => {
    if (rewinding || scrollY < 2) return;
    stop();
    dropPlayer();
    rewinding = true;
    showState();
    kRew.classList.add("on");
    glide(0, clamp(scrollY / 3, 1800, 3400), (finished) => {
      rewinding = false;
      showState();
      kRew.classList.remove("on");
      if (windGain) windGain.gain.setTargetAtTime(0, ac.currentTime, 0.04);
      if (finished) {
        thunk(150, 0.5);
        window.cassette3d?.knock();
        if (window.cassette3d) { armed = false; tries = 0; noteSays(false); window.cassette3d.seat(false); }
      }
    });
  });

  document.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    armNow();
    if (a.dataset.go !== "top" && a.dataset.go !== "story") rail.classList.add("heard"); // asking for a section by name goes straight past Tape 1
    const el = $(a.dataset.go);
    const prev = page.style.transform;
    page.style.transform = "none";
    const top = el.getBoundingClientRect().top - 56;
    page.style.transform = prev;
    glide(a.dataset.go === "top" ? 0 : a.dataset.go === "story" ? hold + worksTop : scrollFor(Math.max(0, top)), 1200);
  }));

  // ---------- The project deck: only the top card holds a live player, if its host allows one ----------
  // an embedded player can't be paused from outside, so taking it off the page is what stops it
  const slides = $("slides"), slideCount = slides.children.length;
  let slide = 0, live = null, liveTimer = 0, socialOn = false;
  function dropPlayer() {
    clearTimeout(liveTimer);
    if (live) { live.remove(); live = null; }
  }
  function mountPlayer() {
    dropPlayer();
    if (!socialOn || !posts[slide].embed) return;
    const f = slides.children[slide];
    liveTimer = setTimeout(() => {
      live = document.createElement("iframe");
      live.title = posts[slide].title;
      live.allow = "encrypted-media; picture-in-picture";
      live.src = posts[slide].embed;
      live.addEventListener("load", () => live?.classList.add("ready"));
      f.querySelector(".reel").appendChild(live);
    }, 320);
  }
  // a stacked deck: the top post faces you, its neighbours fan out behind it
  function showSlide(n, quiet) {
    slide = (n + slideCount) % slideCount;
    [...slides.children].forEach((f, i) => {
      let d = i - slide;
      if (d > slideCount / 2) d -= slideCount;
      if (d < -slideCount / 2) d += slideCount;
      const a = Math.abs(d), near = a <= 2;
      f.style.transform = `translate(${d * 40}px, ${d * 40}px) rotate(${d * 8}deg) scale(${1 - a * 0.09})`;
      f.style.opacity = !near ? 0 : a === 0 ? 1 : 0.62 - (a - 1) * 0.14;
      f.style.zIndex = 10 - a;
      f.inert = a !== 0;
    });
    mountPlayer();
    if (!quiet) tick(0.2, 2200);
  }
  showSlide(0, true);
  $("prev").addEventListener("click", () => showSlide(slide - 1));
  $("next").addEventListener("click", () => showSlide(slide + 1));

  // ---------- The featured video: YouTube's player, with only our play and pause on show ----------
  const yt = $("beyondMedia"), ytToggle = $("ytToggle");
  let ytPlayer = null, ytWanted = false, ytMiddle = 0;
  function ytState(on) {
    yt.classList.toggle("playing", on);
    ytToggle.setAttribute("aria-label", on ? "Pause video" : "Play video");
    ytToggle.setAttribute("aria-pressed", String(on));
  }
  function syncVideo() {
    if (ytPlayer?.mute) { if (soundOn) ytPlayer.unMute(); else ytPlayer.mute(); }
  }
  function ytCreate() {
    ytPlayer = new YT.Player("ytFrame", {
      host: "https://www.youtube-nocookie.com",
      videoId: site.video.id,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, cc_load_policy: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: (e) => { syncVideo(); if (ytWanted) e.target.playVideo(); },
        onStateChange: (e) => {
          // captions stay off even for viewers whose YouTube account turns them on
          if (e.data === YT.PlayerState.PLAYING) {
            try { e.target.unloadModule("captions"); e.target.unloadModule("cc"); } catch (err) {}
          }
          ytState(e.data === YT.PlayerState.PLAYING);
          if (e.data === YT.PlayerState.ENDED) e.target.seekTo(0, true), e.target.pauseVideo();
        },
      },
    });
  }
  ytToggle.addEventListener("click", () => {
    stop();
    mountPlayer();
    if (!site.video.id) return; // no video yet: the still stays
    if (ytPlayer?.getPlayerState) {
      if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
      return;
    }
    ytWanted = true;
    if (ytPlayer || window.onYouTubeIframeAPIReady) return; // already on its way
    window.onYouTubeIframeAPIReady = ytCreate;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  // ---------- Motion ----------
  let y = scrollY, yVel = 0, angle = 0, reelSpeed = 0;
  let last = 0, running = false, seatedBefore = true, tickAt = 0, tickedAt = 0;

  function frame(t) {
    const dt = Math.min(0.05, Math.max(0.004, (t - last) / 1000)); // the first frame after a wake can read a tiny negative time
    last = t;

    // a critically damped spring: the page starts and stops softly, even from stepped mouse wheels
    const prev = y;
    if (reduceMotion) y = scrollY;
    else {
      const W = 12, sub = 2, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        yVel += (W * W * (scrollY - y) - 2 * W * yVel) * h;
        y += yVel * h;
      }
    }
    render(dt, (y - prev) / dt);

    const moving = Math.abs(scrollY - y) > 0.1 || Math.abs(yVel) > 0.5 || Math.abs(reelSpeed) > 1 || playing;
    if (moving) requestAnimationFrame(frame);
    else { running = false; if (whirGain) whirGain.gain.setTargetAtTime(0, ac.currentTime, 0.05); }
  }

  // ---------- The closing button whispers when you come close, if there is a recording for it ----------
  const talk = $("talk");
  const whisperFile = site.whisper ? fetch(site.whisper).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : Promise.resolve(null);
  let whisper = null, whisperAt = -9, talkMiddle = 0, talkCalling = false, talkNear = false;
  // a phone buzzing on a table: two short, low hums, timed with the button's first shake
  function buzz() {
    if (!talkCalling || playing || !audible()) return;
    [0, 0.54].forEach((at) => {
      const t = ac.currentTime + at, hum = ac.createOscillator(), soft = ac.createBiquadFilter(), g = ac.createGain();
      hum.type = "square";
      hum.frequency.value = 200;
      soft.type = "lowpass"; soft.frequency.value = 1800; // laptop speakers can't play a low hum, so the buzz lives in its overtones
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      g.gain.setValueAtTime(0.16, t + 0.33);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      hum.connect(soft).connect(g).connect(out);
      hum.start(t);
      hum.stop(t + 0.4);
    });
  }
  async function sayWispr(again = false) {
    if (playing || !audible() || (!again && ac.currentTime - whisperAt < 1.6)) return;
    whisperAt = ac.currentTime;
    if (!whisper) {
      const raw = await whisperFile;
      if (!raw) return;
      whisper = await ac.decodeAudioData(raw).catch(() => null);
      if (!whisper) return;
    }
    const src = ac.createBufferSource();
    src.buffer = whisper;
    src.connect(out);
    src.start();
  }
  ["pointerenter", "focus", "touchstart"].forEach((e) => talk.addEventListener(e, () => sayWispr(), { passive: true }));
  talk.addEventListener("click", () => sayWispr(true)); // asked outright, it says it every time

  const soundHint = $("soundNote");
  // the beat rolls through the hint one letter at a time, so each letter needs its own box
  const soundWords = $("soundWords");
  soundHint.setAttribute("aria-label", soundWords.textContent);
  soundWords.setAttribute("aria-hidden", "true");
  soundWords.innerHTML = [...soundWords.textContent].map((c, i) => `<span style="--i:${i}">${c === " " ? "&nbsp;" : c}</span>`).join("");
  let liveCassette = null; // drawn by a module that loads after this script
  function render(dt, speed) {
    const p = clamp(y / hold, 0, 1);
    const { top, x } = place(y);
    page.style.transform = `translate3d(0, ${(-top).toFixed(2)}px, 0)`;
    rail.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`;

    // the cassette sits in the middle of the first screen and leaves with it
    if (playing) { angle += 150 * dt; followVoice(); }
    // short phones need room for the pencil and its note above the headline
    const shortPhone = vw <= 760 && vh < 700;
    const cassetteW = Math.min(vw * (vw > 760 ? 0.38 : 0.84), vh * (shortPhone ? 0.38 : 0.64));
    const inView = top < vh * 0.5 + cassetteW * 0.45; // stop drawing it as soon as it has left the screen
    liveCassette ??= $("cassette3d");
    if (liveCassette) liveCassette.style.visibility = inView ? "visible" : "hidden";
    if (window.cassette3d && inView) {
      window.cassette3d.update({
        p,
        wind: y * 0.012,
        cx: vw / 2,
        cy: vh * 0.5 - top - (shortPhone ? cassetteW * 0.14 : 0),
        width: cassetteW,
        angle,
        locked: p > 0.2,
      });
    }

    // tape: out of the slot as the pencil winds, then always on past the edge of the screen
    const fed = easeOutSoft(p);
    drawTape(top, x, p < 1 ? sA * fed : count, window.cassette3d?.mouth ?? { x: vw / 2, y: vh * 0.7 }, sA * STEP * fed + Math.max(0, y - hold) * 0.22, p < 1);

    for (const r of reveals) if (!r.done && r.y - top < vh * 0.88) { r.done = true; r.el.classList.add("in"); }
    // the live reel exists only while its section is on screen; the keys wait until there is something to rewind
    const nearSocial = Math.abs(socialTop - top) < vh * 1.05;
    if (nearSocial !== socialOn) { socialOn = nearSocial; if (socialOn) mountPlayer(); else dropPlayer(); }
    // the video stops once its middle has left the screen, the same as walking out of the room
    if (yt.classList.contains("playing") && (ytMiddle - top < 64 || ytMiddle - top > vh)) ytPlayer.pauseVideo();
    // once the closing button comes up it starts ringing, with sound on the first ring of each visit
    const near = talkMiddle - top > 0 && talkMiddle - top < vh * 0.8, calling = near && !reduceMotion;
    if (near !== talkNear) {
      talkNear = near;
      if (near && playing) fadeOut();
    }
    if (calling !== talkCalling) {
      talkCalling = calling;
      talk.classList.toggle("call", calling);
      if (calling) setTimeout(buzz, 900);
    }
    // a note belongs to its tape: scroll that tape off screen and it stops. The bonus song plays on as you leave
    if (playing && track < N - 1 && (cardX[track] - x > vw || cardX[track] + cardW - x < 0 || Math.abs(top - worksTop) > vh * 0.6)) stop();
    keys.classList.toggle("up", p > 0.02);
    // the tape has run out: ask to be rewound
    const ending = !rewinding && y > hold + railRun + pageH - vh - 60;
    if (ending !== keys.classList.contains("ending")) { keys.classList.toggle("ending", ending); showState(); }
    soundHint.classList.toggle("gone", p > 0.02);
    if (p > 0.02 && armed) note.classList.add("swap");

    // sound
    if (armed && !seatedBefore) thunk();
    seatedBefore = armed;
    // the reel is the scrollbar: it clicks and whirs the whole way down, voice note or not
    const clock = performance.now();
    if (armed && !rewinding && Math.abs(y - tickAt) > 34 && clock - tickedAt > 45) { tickAt = y; tickedAt = clock; tick(0.21, 1700 + Math.random() * 500); }
    const drive = armed || rewinding ? speed : 0;
    reelSpeed += (drive - reelSpeed) * (1 - Math.exp(-dt * 9));
    angle += reelSpeed * dt * 0.09;
    if (whirGain && audible()) {
      if (rewinding) {
        windGain.gain.setTargetAtTime(0.04, ac.currentTime, 0.08);
        windOsc.frequency.setTargetAtTime(190 + Math.min(620, Math.abs(speed) * 0.16), ac.currentTime, 0.06);
      }
      const loud = rewinding ? 0.8 : clamp(Math.abs(reelSpeed) / 2600, 0, 1) ** 2; // the ticks lead: the whir only rises under a fast scroll
      whirGain.gain.setTargetAtTime(Math.max(loud * (rewinding ? 0.1 : 0.06), playing ? 0.01 : 0), ac.currentTime, 0.05); // a note keeps a low motor hum under it
      whirFilter.frequency.setTargetAtTime(400 + loud * 500, ac.currentTime, 0.05);
    }
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  addEventListener("scroll", () => {
    if (!armed && scrollY > 0) scrollTo(0, 0);
    if (!passed() && scrollY > hold + worksTop) { scrollTo(0, hold + worksTop); pushed(); }
    wake();
  }, { passive: true });
  startAudio();

  function arm() {
    if (armed || arming) return;
    arming = true;
    note.classList.add("swap"); // the note slips away while the pencil travels
    startAudio();
    window.cassette3d.seat(true);
  }
  function armNow() {
    if (armed) return;
    arm();
    armed = true;
    arming = false;
    note.hidden = true;
    wake();
  }
  // scrolling first: the pencil wiggles, and after a few tries it goes in by itself so nobody is stuck
  function tried() {
    const t = performance.now();
    if (arming || t - lastTry < 800) return;
    lastTry = t;
    window.cassette3d.nudge();
    if (++tries >= 3) arm();
  }
  const held = (e) => { if (armed) return; e.preventDefault(); tried(); };
  addEventListener("wheel", held, { passive: false });
  addEventListener("touchmove", held, { passive: false });
  addEventListener("keydown", (e) => {
    if (!e.target.closest("a, button") && [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) held(e);
  });
  $("pencilBtn").addEventListener("click", arm);
  // the story waits at Tape 1 the way the cassette waits for the pencil: Hear it or Read it opens the way, and the fourth push carries you past by itself, so nobody is stuck
  const passed = () => rail.classList.contains("heard");
  const atWall = () => !passed() && scrollY >= hold + worksTop - 1;
  let pushes = 0, pushedAt = 0, shoveEnd = 0, touchY = 0;
  function pushed() {
    const t = performance.now();
    if (t - pushedAt < 700) return;
    pushedAt = t;
    if (++pushes >= 4) {
      rail.classList.add("heard");
      glide(cardScroll(1), 700); // a held swipe can't scroll any more, so the rail moves on for it
      return;
    }
    yVel += 700; // the page leans into the wall and springs back
    thunk(120, 0.3);
    rail.classList.remove("shove");
    void rail.offsetWidth; // restarts the animation
    rail.classList.add("shove");
    clearTimeout(shoveEnd);
    shoveEnd = setTimeout(() => rail.classList.remove("shove"), 650);
    wake();
  }
  addEventListener("wheel", (e) => { if (e.deltaY > 0 && atWall()) { e.preventDefault(); pushed(); } }, { passive: false });
  addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => {
    const now = e.touches[0].clientY;
    if (now < touchY && atWall()) { if (e.cancelable) e.preventDefault(); pushed(); }
    touchY = now;
  }, { passive: false });
  // the note says what to do next: pick up the pencil, then scroll, then it gets out of the way
  const note = $("pencilNote"), noteWord = $("pencilWord");
  const askWord = matchMedia("(pointer: coarse)").matches ? "tap me first" : noteWord.textContent;
  function noteSays(go) {
    noteWord.textContent = go ? "scroll now" : askWord;
    note.classList.toggle("go", go);
    note.classList.remove("swap");
  }
  noteSays(false);

  // the page is moved by hand, so keyboard focus has to bring things into view itself
  page.addEventListener("focusin", (e) => {
    armNow();
    const card = e.target.closest(".card");
    if (card !== cards[0]) rail.classList.add("heard"); // tabbing past Tape 1 counts as moving on
    if (card) { glide(cardScroll(cards.indexOf(card)), 500); return; }
    const r = e.target.getBoundingClientRect();
    if (r.top < 70 || r.bottom > vh - 70) scrollTo(0, scrollY + r.top - vh / 2);
  });

  addEventListener("cassette3d-ready", () => {
    window.cassette3d.onSeated = () => { armed = true; arming = false; noteSays(true); wake(); };
    if (scrollY < 2) { armed = false; seatedBefore = false; window.cassette3d.seat(false, true); }
    render(0.016, 0);
    // once the cassette has drawn, its slot position is known and the film can start from it
    requestAnimationFrame(() => requestAnimationFrame(() => { layout(); render(0.016, 0); wake(); }));
  });

  const boot = () => { layout(); showState(); render(0.016, 0); };
  // unpack every cover before anyone scrolls to it, so the first look at the story isn't spent decoding pictures
  addEventListener("load", () => document.querySelectorAll(".cover img").forEach((img) => {
    img.decode().catch(() => {});
    if (!img.classList.contains("fg")) return;
    const mask = new Image();
    mask.src = img.src.replace(".jpg", "-mask.png");
    mask.decode().catch(() => {});
  }));
  boot();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(boot);
  addEventListener("load", boot);
  let t;
  addEventListener("resize", () => {
    if (root.clientWidth === vw && Math.abs(innerHeight - vh) < 120) return; // a phone's address bar sliding away, not a real resize
    clearTimeout(t);
    t = setTimeout(boot, 120);
  });
})();
