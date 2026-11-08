// The 3D cassette. site.js drives it: position and reels.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { site } from "../data/site";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 10, H = 6.3, D = 0.8, BEVEL = 0.06;
const FRONT = D / 2 + BEVEL;
const HUB_X = 2.1, HUB_Y = 0.55, HUB_R = 0.58;
const LABEL = { l: -4.55, r: 4.55, b: -1.7, t: 2.75 };

// ---------- Renderer ----------
const canvas = document.createElement("canvas");
canvas.id = "cassette3d";
canvas.setAttribute("aria-hidden", "true");
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const camera = new THREE.PerspectiveCamera(20, 1, 1, 400);
camera.position.z = 100;
const worldHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(-5, 9, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.radius = 14;
sun.shadow.blurSamples = 12;
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
scene.add(sun, sun.target);

// soft shadow on the page behind the cassette
const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.ShadowMaterial({ opacity: 0.17 }));
floor.position.z = -6;
floor.receiveShadow = true;
scene.add(floor);

// ---------- Shapes ----------
function rounded(l, b, r, t, rad, Cls = THREE.Shape) {
  const s = new Cls();
  s.moveTo(l + rad, b);
  s.lineTo(r - rad, b); s.quadraticCurveTo(r, b, r, b + rad);
  s.lineTo(r, t - rad); s.quadraticCurveTo(r, t, r - rad, t);
  s.lineTo(l + rad, t); s.quadraticCurveTo(l, t, l, t - rad);
  s.lineTo(l, b + rad); s.quadraticCurveTo(l, b, l + rad, b);
  return s;
}
function cutHoles(shape) {
  [-HUB_X, HUB_X].forEach((x) => {
    const c = new THREE.Path();
    c.absarc(x, HUB_Y, HUB_R, 0, Math.PI * 2, true);
    shape.holes.push(c);
  });
  shape.holes.push(rounded(-1.15, 0.12, 1.15, 0.98, 0.1, THREE.Path));
  return shape;
}
const std = (color, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ---------- Cassette ----------
const cassette = new THREE.Group();
scene.add(cassette);

// fine moulded-plastic grain, shared by the body parts
function grain() {
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const g = t.getContext("2d"), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 118 + Math.random() * 20;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(t);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.6, 1.6);
  return tex;
}
const grainTex = grain();
// the speckle you can see, multiplied into the colour like the player's noise layer
function speckle() {
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const g = t.getContext("2d"), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 214 + Math.random() * 41;
    d.data[i] = v; d.data[i + 1] = v * 0.99; d.data[i + 2] = v * 0.96;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(t);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.9, 0.9);
  return tex;
}
const speckleTex = speckle();
const plastic = (color, rough = 0.82) => new THREE.MeshStandardMaterial({
  color, roughness: rough, map: speckleTex, bumpMap: grainTex, bumpScale: 0.22,
});
const shellMat = plastic(0x35326f);
const shell = new THREE.ExtrudeGeometry(cutHoles(rounded(-W / 2, -H / 2, W / 2, H / 2, 0.3)), {
  depth: D, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 4, curveSegments: 40,
});
shell.translate(0, 0, -D / 2);
add(cassette, shell, shellMat);

// dark interior behind the window
add(cassette, new THREE.BoxGeometry(W - 1, 3, 0.04), std(0xdedbd4, 0.5), 0, HUB_Y, -0.3);

// tape packs and toothed hubs
function packTexture() {
  const t = document.createElement("canvas");
  t.width = t.height = 512;
  const g = t.getContext("2d");
  g.fillStyle = "#33241b";
  g.fillRect(0, 0, 512, 512);
  // wound layers, plus faint streaks so rotation reads
  for (let r = 40; r < 256; r += 5) {
    g.strokeStyle = `rgba(${150 + (r % 3) * 30}, ${110 + (r % 3) * 22}, 80, ${0.05 + (r % 7) * 0.012})`;
    g.lineWidth = 2;
    g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    g.strokeStyle = "rgba(240, 205, 165, .16)";
    g.lineWidth = 9 + (i % 3) * 5;
    g.beginPath(); g.arc(256, 256, 120 + (i % 4) * 34, a, a + 0.5); g.stroke();
  }
  const tex = new THREE.CanvasTexture(t);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const packTop = new THREE.MeshStandardMaterial({ map: packTexture(), roughness: 0.72 });
const packMat = [std(0x33241b, 0.4), packTop, packTop];
const packGeo = new THREE.CylinderGeometry(1, 1, 0.42, 72).rotateX(Math.PI / 2);
const packL = add(cassette, packGeo, packMat, -HUB_X, HUB_Y, -0.03);
const packR = add(cassette, packGeo, packMat, HUB_X, HUB_Y, -0.03);
packL.scale.set(1.52, 1.52, 1);
packR.scale.set(1.52, 1.52, 1);

function hub(x) {
  const g = new THREE.Group();
  g.position.set(x, HUB_Y, 0);
  const white = std(0xf4f1ea, 0.6);
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.53, 0, Math.PI * 2, false);
  const open = new THREE.Path();
  open.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
  ring.holes.push(open);
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.5, bevelEnabled: false, curveSegments: 48 });
  ringGeo.translate(0, 0, -0.24);
  add(g, ringGeo, white);
  add(g, new THREE.CylinderGeometry(0.33, 0.33, 0.02, 40).rotateX(Math.PI / 2), std(0xd9d6cf, 0.6), 0, 0, -0.14);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tooth = add(g, new THREE.BoxGeometry(0.17, 0.1, 0.4), white, Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.04);
    tooth.rotation.z = a;
  }
  cassette.add(g);
  return g;
}
const hubL = hub(-HUB_X), hubR = hub(HUB_X);

// printed label: one per side
function makeLabel() {
  const c = document.createElement("canvas");
  c.width = 1638; c.height = 800;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const geo = new THREE.ShapeGeometry(cutHoles(rounded(LABEL.l, LABEL.b, LABEL.r, LABEL.t, 0.14)), 40);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - LABEL.l) / (LABEL.r - LABEL.l), (pos.getY(i) - LABEL.b) / (LABEL.t - LABEL.b));
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62 }));
  mesh.position.z = FRONT + 0.005;
  mesh.receiveShadow = true;
  return { c, tex, mesh };
}
const labelA = makeLabel(), labelB = makeLabel();
const sideA = new THREE.Group(), sideB = new THREE.Group();
sideA.add(labelA.mesh);
sideB.add(labelB.mesh);
sideB.rotation.y = Math.PI;
cassette.add(sideA, sideB);

function paint({ c, tex }, side, title, track) {
  const g = c.getContext("2d"), w = c.width, h = c.height;
  g.fillStyle = "#fbf4e4";
  g.fillRect(0, 0, w, h);
  // sunset bands under the writing area
  const bands = ["#ffc145", "#ff8a3d", "#f4476b", "#b5338a"];
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, 340 + i * 64, w, 64); });
  g.fillStyle = "#35326f";
  g.fillRect(0, 596, w, h - 596);
  g.fillStyle = "#35326f";
  g.font = '150px "Permanent Marker", cursive';
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillText(title, w / 2, 195);
  g.fillStyle = "#ffc145";
  g.font = '800 70px Geist, sans-serif';
  g.textAlign = "left";
  g.fillText(side, 52, 700);
  g.textAlign = "center";
  g.fillStyle = "#fbf4e4";
  g.font = '600 50px Geist, sans-serif';
  g.fillText(track, w / 2, 690);
  g.textAlign = "right";
  g.fillStyle = "#ffc145";
  g.font = '800 60px Geist, sans-serif';
  g.fillText("C60", w - 52, 696);
  // paper tooth, the same speckle as the plastic
  const n = g.getImageData(0, 0, w, h), px = n.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = 1 - Math.random() * 0.07;
    px[i] *= v; px[i + 1] *= v; px[i + 2] *= v;
  }
  g.putImageData(n, 0, 0);
  tex.needsUpdate = true;
}

// raised plate around the window
const plate = new THREE.ExtrudeGeometry(cutHoles(rounded(-3.3, -0.42, 3.3, 1.52, 0.32)), {
  depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 40,
});
const plateMat = plastic(0xdfd3b8);
add(cassette, plate, plateMat, 0, 0, FRONT + 0.01);
const plateBack = add(cassette, plate, plateMat, 0, 0, 0);
plateBack.rotation.y = Math.PI;
plateBack.position.z = -FRONT - 0.01;

// raised frame around the label, and rims around the reels and window
const frameShape = rounded(LABEL.l - 0.1, LABEL.b - 0.1, LABEL.r + 0.1, LABEL.t + 0.1, 0.2);
frameShape.holes.push(rounded(LABEL.l, LABEL.b, LABEL.r, LABEL.t, 0.14, THREE.Path));
const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16 });
add(cassette, frameGeo, shellMat, 0, 0, FRONT);
const rimMat = plastic(0xbfb396, 0.7);
[-HUB_X, HUB_X].forEach((x) => {
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HUB_R + 0.02, 0.04, 12, 64), rimMat);
  rim.position.set(x, HUB_Y, FRONT + 0.1);
  cassette.add(rim);
});
const winFrame = rounded(-1.22, 0.05, 1.22, 1.05, 0.13);
winFrame.holes.push(rounded(-1.15, 0.12, 1.15, 0.98, 0.1, THREE.Path));
add(cassette, new THREE.ExtrudeGeometry(winFrame, { depth: 0.03, bevelEnabled: false, curveSegments: 12 }), rimMat, 0, 0, FRONT + 0.08);

// window plastic
const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.3 });
add(cassette, new THREE.PlaneGeometry(2.3, 0.86), glass, 0, 0.55, FRONT + 0.03).castShadow = false;

// lower head block, both sides
const trap = new THREE.Shape();
trap.moveTo(-3.7, -H / 2); trap.lineTo(3.7, -H / 2); trap.lineTo(3.15, -1.86); trap.lineTo(-3.15, -1.86); trap.closePath();
const trapGeo = new THREE.ExtrudeGeometry(trap, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
add(cassette, trapGeo, plateMat, 0, 0, FRONT);
const trapBack = add(cassette, trapGeo, plateMat, 0, 0, -FRONT);
trapBack.rotation.y = Math.PI;
const dark = std(0x26252a, 0.7);
[-2.4, 2.4].forEach((x) => add(cassette, new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24).rotateX(Math.PI / 2), dark, x, -2.5, FRONT + 0.14));
[-1.05, 1.05].forEach((x) => add(cassette, new THREE.BoxGeometry(0.3, 0.3, 0.04), dark, x, -2.5, FRONT + 0.14));

// ribbed lower body, both faces
const ribGeo = new THREE.BoxGeometry(W - 0.5, 0.045, 0.03);
const ribs = new THREE.InstancedMesh(ribGeo, std(0x2a2860, 0.8), 28);
const ribM = new THREE.Matrix4();
for (let i = 0; i < 14; i++) {
  const y = -H / 2 + 0.16 + i * 0.1;
  ribM.setPosition(0, y, FRONT + 0.01); ribs.setMatrixAt(i, ribM);
  ribM.setPosition(0, y, -FRONT - 0.01); ribs.setMatrixAt(i + 14, ribM);
}
cassette.add(ribs);

// the opening on the bottom edge: slot, rollers and the exposed run of tape
add(cassette, new THREE.BoxGeometry(5.2, 0.12, D * 0.72), std(0x121124, 0.8), 0, -H / 2 - 0.02, 0);
[-2.3, 2.3].forEach((x) => add(cassette, new THREE.CylinderGeometry(0.15, 0.15, D * 0.6, 28).rotateX(Math.PI / 2), std(0xe7c063, 0.4, 0.7), x, -H / 2 - 0.02, 0));
add(cassette, new THREE.BoxGeometry(4.6, 0.05, D * 0.34), std(0x3a2a20, 0.3), 0, -H / 2 - 0.1, 0);

// screws
const screwMat = std(0xe7c063, 0.4, 0.7);
[[-4.72, 2.87], [4.72, 2.87], [-4.72, -2.87], [4.72, -2.87], [0, -2.5]].forEach(([x, y]) => {
  const s = add(cassette, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24).rotateX(Math.PI / 2), screwMat, x, y, FRONT + (y === -2.5 ? 0.14 : 0.01));
  add(s, new THREE.BoxGeometry(0.17, 0.03, 0.02), dark, 0, 0, 0.03);
});

// ---------- Pencil ----------
const pencil = new THREE.Group();
const lead = new THREE.Group(); // tip at the origin, body along +Y
pencil.add(lead);
add(lead, new THREE.ConeGeometry(0.17, 0.5, 6).rotateX(Math.PI), std(0xe6c490, 0.7), 0, 0.25, 0);
add(lead, new THREE.ConeGeometry(0.06, 0.18, 12).rotateX(Math.PI), std(0x2b2b30, 0.5), 0, 0.09, 0);
// hexagonal barrel with alternating black and silver faces, and a black dipped end
function barrelTexture() {
  const t = document.createElement("canvas");
  t.width = 600; t.height = 8;
  const g = t.getContext("2d");
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "#111114" : "#d9dade"; g.fillRect(i * 100, 0, 100, 8); }
  const tex = new THREE.CanvasTexture(t);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const barrel = new THREE.MeshStandardMaterial({ map: barrelTexture(), roughness: 0.6, metalness: 0.1, flatShading: true });
add(lead, new THREE.CylinderGeometry(0.17, 0.17, 4.9, 6), [barrel, std(0x111114, 0.4), std(0x111114, 0.4)], 0, 2.95, 0);
add(lead, new THREE.CylinderGeometry(0.172, 0.172, 0.22, 6), std(0x0d0d10, 0.3), 0, 5.4, 0);
const pencilDir = new THREE.Vector3(-0.8, 0, 0.6).normalize();
const heroQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0.14, -0.36));
const pencilWorld = pencilDir.clone().applyQuaternion(heroQ), hubPoint = new THREE.Vector3();
const spinQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
lead.scale.set(1.35, 1.43, 1.35);
const PENCIL_LEN = 7.9;
const restDirWide = new THREE.Vector3(0.26, 0.96, 0.1).normalize(), restDirNarrow = new THREE.Vector3(0.97, 0.2, 0.1).normalize();
const restPos = new THREE.Vector3(), restQ = new THREE.Quaternion(), holdPos = new THREE.Vector3(), wiggleQ = new THREE.Quaternion(), FACING = new THREE.Vector3(0, 0, 1);
const pencilEnd = new THREE.Vector3(), pencilTip = new THREE.Vector3(), pencilDirWorld = new THREE.Vector3();
const pencilBtn = document.getElementById("pencilBtn"), pencilNote = document.getElementById("pencilNote");
scene.add(pencil); // not a child of the cassette: when the cassette rocks, the pencil holds its line

// ---------- Driven by site.js ----------
const state = {
  cx: 0, cy: 0, width: 300, angle: 0, p: 0, wind: 0, locked: false,
};
let flip = 0, flipVel = 0, flipTarget = 0, bump = 0, bumpVel = 0, inserted = true;
let seat = 1, seatTarget = 1, wiggle = 0, wiggleVel = 0, onSeated = null; // seat: 0 resting beside the cassette, 1 in the reel
let last = performance.now(), dirty = true, userFlip = false;
const slot = new THREE.Vector3(), mouth = { x: 0, y: 0 };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const part = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

// drag to spin it in your hand, tap to flip it. It settles back on a spring.
const held = { on: false, x: 0, y: 0, moved: 0, rx: 0, ry: 0, vx: 0, vy: 0 };
const inBox = (e) => Math.abs(e.clientX - state.cx) < state.width * 0.52
  && Math.abs(e.clientY - state.cy) < state.width * 0.34 && !e.target.closest?.("button");
addEventListener("pointerdown", (e) => {
  if (reduceMotion || state.locked || !inBox(e)) return;
  Object.assign(held, { on: true, x: e.clientX, y: e.clientY, moved: 0 });
  document.body.style.cursor = "grabbing";
});
addEventListener("pointermove", (e) => {
  if (held.on) {
    const dx = e.clientX - held.x, dy = e.clientY - held.y;
    held.x = e.clientX; held.y = e.clientY;
    held.moved += Math.abs(dx) + Math.abs(dy);
    held.vy = dx * 0.012; held.vx = dy * 0.012;
    held.ry += held.vy; held.rx += held.vx;
    dirty = true;
  } else if (e.pointerType === "mouse" && !reduceMotion && !state.locked) {
    document.body.style.cursor = inBox(e) ? "grab" : document.body.style.cursor === "grab" ? "" : document.body.style.cursor;
  }
}, { passive: true });
const letGo = (e) => {
  if (!held.on) return;
  held.on = false;
  document.body.style.cursor = "";
  if (e.type === "pointerup" && held.moved < 6) { userFlip = !userFlip; flipTarget = userFlip ? 1 : 0; }
};
addEventListener("pointerup", letGo);
addEventListener("pointercancel", letGo); // a touch that turns into a page scroll never sends pointerup

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  dirty = true;
}
addEventListener("resize", resize);
resize();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const px = worldHeight / innerHeight;

  // pencil choreography: picked up from beside the cassette, carried over the reel, plunged in
  const p = state.p, wind = state.wind;
  seat += Math.sign(seatTarget - seat) * Math.min(Math.abs(seatTarget - seat), dt / 0.8);
  const carry = easeInOut(part(seat, 0, 0.72));
  const dip = easeInOut(part(seat, 0.72, 1)); // the plunge is quick
  if (dip >= 1 && !inserted) { inserted = true; bumpVel = -3; onSeated?.(); }
  if (dip < 1) inserted = false;
  wiggleVel += (-wiggle * 240 - wiggleVel * 9) * dt;
  wiggle += wiggleVel * dt;

  // the press of the pencil knocks the cassette, which settles on a spring
  bumpVel += (-bump * 90 - bumpVel * 9) * dt;
  bump += bumpVel * dt;

  // Side B: a quick spring flip
  flipVel += ((flipTarget - flip) * 42 - flipVel * 9) * dt;
  flip += flipVel * dt;

  // let go and it glides back
  if (!held.on) {
    held.vx += (-held.rx * 26 - held.vx * 7) * dt;
    held.vy += (-held.ry * 26 - held.vy * 7) * dt;
    held.rx += held.vx * dt;
    held.ry += held.vy * dt;
  }

  const k = state.width / W * px;
  cassette.scale.setScalar(k);
  floor.position.z = -k * 1.1;
  cassette.position.set(
    (state.cx - innerWidth / 2) * px,
    (innerHeight / 2 - state.cy) * px,
    0,
  );

  // tilted like a tape on a table
  const rock = reduceMotion ? 0 : 0.016 * easeInOut(part(p, 0, 0.05));
  cassette.rotation.set(
    -0.3 + bump * 0.5 + rock * Math.cos(wind) + held.rx,
    0.14 + flip * Math.PI + bump * 0.2 + rock * Math.sin(wind) + held.ry,
    -0.36,
  );

  // reels: site.js owns the scroll spin, the pencil adds to the left reel
  const spin = -THREE.MathUtils.degToRad(state.angle);
  hubL.rotation.z = spin - wind;
  hubR.rotation.z = spin - wind * 0.6;
  packL.rotation.z = hubL.rotation.z;
  packR.rotation.z = hubR.rotation.z;

  // tip stays in the hub; once seated the pencil turns with the reel
  const h = (1 - dip) * 1.3;
  // it spins on its own length as it drives the reel, and nothing else moves it
  lead.quaternion.setFromUnitVectors(UP, pencilDir).multiply(spinQ.setFromAxisAngle(UP, -wind));

  cassette.updateMatrixWorld();
  hubPoint.set(-HUB_X + 0.24, HUB_Y - 0.03, 0.06);
  cassette.localToWorld(hubPoint);
  pencil.scale.setScalar(k);
  holdPos.copy(hubPoint).addScaledVector(pencilWorld, h * k);
  if (carry < 1) {
    const wide = innerWidth > 760, dir = wide ? restDirWide : restDirNarrow;
    const bob = reduceMotion ? 0 : Math.sin(now * 0.0016) * k * 0.09;
    restPos.set(
      (state.cx + state.width * (wide ? 0.74 : 0) - innerWidth / 2) * px,
      (innerHeight / 2 - state.cy - state.width * (wide ? 0 : innerHeight < 700 ? 0.72 : 0.62)) * px + bob,
      k * 0.3,
    ).addScaledVector(dir, -PENCIL_LEN * 0.5 * k);
    restQ.setFromUnitVectors(pencilDir, dir);
    wiggleQ.setFromAxisAngle(FACING, wiggle * 0.5);
    restQ.premultiply(wiggleQ);
    pencil.quaternion.copy(restQ).slerp(heroQ, carry);
    pencil.position.copy(restPos).lerp(holdPos, carry);
    pencil.position.z += Math.sin(carry * Math.PI) * k * 1.6; // lifted over the cassette, not through it
  } else {
    pencil.quaternion.copy(heroQ);
    pencil.position.copy(holdPos);
  }
  if (seat === 0 && !pencilBtn.hidden) {
    // the button over the pencil follows what's drawn
    pencilDirWorld.copy(pencilDir).applyQuaternion(pencil.quaternion);
    pencilTip.copy(pencil.position).project(camera);
    pencilEnd.copy(pencil.position).addScaledVector(pencilDirWorld, PENCIL_LEN * k).project(camera);
    const x1 = (pencilTip.x + 1) / 2 * innerWidth, y1 = (1 - pencilTip.y) / 2 * innerHeight;
    const x2 = (pencilEnd.x + 1) / 2 * innerWidth, y2 = (1 - pencilEnd.y) / 2 * innerHeight;
    pencilBtn.style.width = `${Math.hypot(x2 - x1, y2 - y1).toFixed(1)}px`;
    pencilBtn.style.transform = `translate(${((x1 + x2) / 2).toFixed(1)}px, ${((y1 + y2) / 2).toFixed(1)}px) translate(-50%, -50%) rotate(${Math.atan2(y2 - y1, x2 - x1).toFixed(3)}rad)`;
    const wide = innerWidth > 760;
    // on phones the hero text sits right under the pencil, so the note goes above its tip
    const noteX = wide ? (x1 + x2) / 2 - 4 : x1 - 6, noteY = wide ? (y1 + y2) / 2 - 36 : y1 - 92;
    pencilNote.style.transform = `translate(${noteX.toFixed(1)}px, ${noteY.toFixed(1)}px) rotate(-4deg)`;
  }
  slot.set(0, -H / 2 - 0.1, 0);
  cassette.localToWorld(slot).project(camera);
  mouth.x = (slot.x + 1) / 2 * innerWidth;
  mouth.y = (1 - slot.y) / 2 * innerHeight;

  const moving = seat !== seatTarget || (seat === 0 && !reduceMotion) || Math.abs(wiggle) + Math.abs(wiggleVel) > 0.001 || held.on || Math.abs(held.rx) + Math.abs(held.ry) > 0.001 || Math.abs(flipTarget - flip) > 0.001 || Math.abs(flipVel) > 0.001 || Math.abs(bump) > 0.0005 || Math.abs(bumpVel) > 0.002;
  if (moving || dirty) {
    renderer.render(scene, camera);
    dirty = false;
  }
  requestAnimationFrame(frame);
}

function repaint() {
  paint(labelA, "A", site.tapeTitle, "Side A");
  paint(labelB, "B", site.tapeTitle, "Side B");
  dirty = true;
}

window.cassette3d = {
  mouth,
  update(next) { Object.assign(state, next); dirty = true; },
  knock() { bumpVel = -3; },
  // put the pencil in the reel, or back beside the cassette; `now` skips the move
  seat(on, now = false) {
    seatTarget = on ? 1 : 0;
    if (now) { seat = seatTarget; inserted = on; }
    pencilBtn.hidden = on;
    if (!on) pencilNote.hidden = false; // site.js takes the note away once the tape is moving
    dirty = true;
  },
  nudge() { wiggleVel = 3.4; },
  set onSeated(fn) { onSeated = fn; },
};

Promise.all([document.fonts.load('150px "Permanent Marker"'), document.fonts.load('800 82px Geist')]).catch(() => {}).then(() => {
  repaint();
  document.body.classList.add("has3d");
  window.dispatchEvent(new Event("cassette3d-ready"));
  requestAnimationFrame(frame);
});
