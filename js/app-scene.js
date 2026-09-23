/* ==========================================================================
   Sanrakshya — the app, in hand.

   Two things live here:
   1. A screen compositor. It takes the real app screenshots, cleans the
      development status bar off them, and performs them: fields are typed
      into, Save is tapped, charts draw themselves, cards slide in, screens
      push like iOS navigation. It draws on the GPU, into a 740×1600 render
      target per phone, so nothing is uploaded per frame; a canvas version
      is the fallback without WebGL.
   2. A physically rendered phone (dark titanium frame, black glass, the
      screen canvas as its display) floating in front of the paper wall, with
      its shadow on the page. It leans toward the pointer and turns with the
      story; in "Share" a second phone, the paediatrician's, joins it.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/addons/RoundedBoxGeometry.js';
import { clamp, lerp, studioEnvironment, createLoop, warmUp, idle, uberPhysical } from './studio.js';

const SW = 740, SH = 1600;                      // screen canvas (screenshots are 739×1600)
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3 = t => 1 - Math.pow(1 - clamp(t), 3);
const seg = (t, a, b) => clamp((t - a) / (b - a));

/* ---- Screens --------------------------------------------------------------- */
const SRC = {
  measure: 'parent-add-mesurment', dash: 'parent-dashboard2', growth: 'parent-child-growthchart',
  dlist: 'doctor-patient-list', ddash: 'doctor-patient-dashboard',
  vaccine: 'parent-vaacine-planner', meal: 'parent-child-meal-planner', milestone: 'parent-record-milestone', doctors: 'parent-find-doctor',
};
const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
const canvas = (w = SW, h = SH) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Scale to the screen, then erase the Expo status bar by stretching a clean row of the app's own background upward.
function clean(img) {
  const c = canvas(), g = c.getContext('2d');
  g.drawImage(img, 0, 0, SW, SH);
  g.drawImage(c, 0, 112, SW, 1, 0, 0, SW, 112);
  return c;
}
// Read one pixel through a scratch canvas, so the screen sources never get pushed off the GPU.
const probe = (() => { const c = document.createElement('canvas'); c.width = c.height = 1; return c.getContext('2d', { willReadFrequently: true }); })();
const px = (c, x, y) => { probe.clearRect(0, 0, 1, 1); probe.drawImage(c, x, y, 1, 1, 0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };

const FONT = '"Geist", -apple-system, "Segoe UI", sans-serif';
const PREV = { prev: true };                  // stands for "the frame before this scene began"

/* Small pre-drawn pieces (status bar, toast, typed values, focus ring, the push shadow).
   Drawn once into canvases and reused by either backend. */
const sprites = new Map();
function sprite(key, w, h, draw) {
  let s = sprites.get(key);
  if (!s) { const c = canvas(w, h); const g = c.getContext('2d'); const meta = draw(g, w, h) || {}; s = { c, w, h, ...meta }; sprites.set(key, s); }
  return s;
}

/* ---- Two backends with one small drawing vocabulary ------------------------
   image · rect · circle · sprite · push/pop (translate, scale about a point, clip, alpha).
   The GPU backend turns every call into a textured quad drawn into a render target
   that the phone's glass displays: no pixels ever travel from CPU to GPU per frame.
   The canvas backend is the no-WebGL fallback. */
class GPUBackend {
  constructor(renderer) {
    this.r = renderer;
    const mk = () => { const rt = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.HalfFloatType, depthBuffer: false }); rt.texture.generateMipmaps = true; rt.texture.minFilter = THREE.LinearMipmapLinearFilter; rt.texture.anisotropy = 8; return rt; };
    this.rt = mk(); this.prevRT = mk();
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(0, SW, 0, -SH, -1, 1);
    this.pool = []; this.n = 0; this.tex = new WeakMap(); this.stack = [];
    this.plane = new THREE.PlaneGeometry(1, 1);
    this._c = new THREE.Color();
  }
  get texture() { return this.rt.texture; }
  texFor(src) {
    if (src === PREV) return { t: this.prevRT.texture, flip: true, w: SW, h: SH };
    let e = this.tex.get(src);
    if (!e) {
      const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
      e = { t, flip: false, w: src.width, h: src.height }; this.tex.set(src, e);
    }
    return e;
  }
  quad() {
    let m = this.pool[this.n];
    if (!m) {
      m = new THREE.Mesh(this.plane, new THREE.ShaderMaterial({
        uniforms: { map: { value: null }, uvr: { value: new THREE.Vector4() }, opacity: { value: 1 }, color: { value: new THREE.Color() }, mode: { value: 0 }, flipV: { value: 0 }, soft: { value: 0.02 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform sampler2D map; uniform vec4 uvr; uniform float opacity, mode, flipV, soft; uniform vec3 color; varying vec2 vUv;
          void main(){
            if (mode < .5) { vec2 uv = vec2(mix(uvr.x, uvr.z, vUv.x), mix(uvr.w, uvr.y, vUv.y)); if (flipV > .5) uv.y = 1. - uv.y; vec4 c = texture2D(map, uv); gl_FragColor = vec4(c.rgb, c.a * opacity); }
            else if (mode < 1.5) gl_FragColor = vec4(color, opacity);
            else { float d = length(vUv - .5) * 2.; gl_FragColor = vec4(color, opacity * (1. - smoothstep(1. - soft, 1., d))); }
          }`,
        transparent: true, depthTest: false, depthWrite: false,
      }));
      m.frustumCulled = false; this.scene.add(m); this.pool.push(m);
    }
    m.visible = true; m.renderOrder = this.n++; return m;
  }
  get top() { return this.stack[this.stack.length - 1]; }
  begin() { this.n = 0; this.stack = [{ a: 1, bx: 0, by: 0, alpha: 1, clip: [0, 0, SW, SH] }]; }
  push({ x = 0, y = 0, s = 1, cx = 0, cy = 0, clip, alpha = 1 } = {}) {
    const p = this.top;
    let a = p.a, bx = p.bx + p.a * x, by = p.by + p.a * y;
    if (s !== 1) { bx += a * cx * (1 - s); by += a * cy * (1 - s); a *= s; }
    let c = p.clip;
    if (clip) {
      const X = p.a * clip[0] + p.bx, Y = p.a * clip[1] + p.by, X2 = X + p.a * clip[2], Y2 = Y + p.a * clip[3];
      c = [Math.max(c[0], X), Math.max(c[1], Y), Math.min(c[0] + c[2], X2) - Math.max(c[0], X), Math.min(c[1] + c[3], Y2) - Math.max(c[1], Y)];
    }
    this.stack.push({ a, bx, by, alpha: p.alpha * alpha, clip: c });
  }
  pop() { this.stack.pop(); }
  _place(m, X, Y, W, H) { m.position.set(X + W / 2, -(Y + H / 2), 0); m.scale.set(W, H, 1); }
  image(src, sx, sy, sw, sh, dx, dy, dw, dh, alpha = 1) {
    const T = this.top, o = T.alpha * alpha; if (o <= 0.002) return;
    let X = T.a * dx + T.bx, Y = T.a * dy + T.by, W = T.a * dw, H = T.a * dh;
    const [cx, cy, cw, ch] = T.clip;
    const X0 = Math.max(X, cx), Y0 = Math.max(Y, cy), X1 = Math.min(X + W, cx + cw), Y1 = Math.min(Y + H, cy + ch);
    if (X1 <= X0 || Y1 <= Y0) return;
    const e = this.texFor(src);
    const u0 = (sx + (X0 - X) / W * sw) / e.w, u1 = (sx + (X1 - X) / W * sw) / e.w;
    const v0 = (sy + (Y0 - Y) / H * sh) / e.h, v1 = (sy + (Y1 - Y) / H * sh) / e.h;
    const m = this.quad(), U = m.material.uniforms;
    U.mode.value = 0; U.map.value = e.t; U.flipV.value = e.flip ? 1 : 0; U.uvr.value.set(u0, v0, u1, v1); U.opacity.value = o;
    this._place(m, X0, Y0, X1 - X0, Y1 - Y0);
  }
  rect(color, x, y, w, h, alpha = 1) {
    const T = this.top, o = T.alpha * alpha; if (o <= 0.002) return;
    let X = T.a * x + T.bx, Y = T.a * y + T.by, X1 = X + T.a * w, Y1 = Y + T.a * h;
    const [cx, cy, cw, ch] = T.clip;
    X = Math.max(X, cx); Y = Math.max(Y, cy); X1 = Math.min(X1, cx + cw); Y1 = Math.min(Y1, cy + ch);
    if (X1 <= X || Y1 <= Y) return;
    const m = this.quad(), U = m.material.uniforms;
    U.mode.value = 1; U.color.value.setStyle(color); U.opacity.value = o;
    this._place(m, X, Y, X1 - X, Y1 - Y);
  }
  circle(color, x, y, r, alpha = 1) {
    const T = this.top, o = T.alpha * alpha; if (o <= 0.002) return;
    const X = T.a * x + T.bx, Y = T.a * y + T.by, R = T.a * r;
    const m = this.quad(), U = m.material.uniforms;
    U.mode.value = 2; U.color.value.setStyle(color); U.opacity.value = o; U.soft.value = 2.5 / R;
    this._place(m, X - R, Y - R, 2 * R, 2 * R);
  }
  sprite(s, dx, dy, alpha = 1) { this.image(s.c, 0, 0, s.w, s.h, dx, dy, s.w, s.h, alpha); }
  _render(target) {
    for (let i = this.n; i < this.pool.length; i++) this.pool[i].visible = false;
    const r = this.r, cc = r.getClearColor(this._c).clone(), ca = r.getClearAlpha(), tm = r.toneMapping;
    r.setRenderTarget(target); r.setClearColor(0xffffff, 1); r.toneMapping = THREE.NoToneMapping; r.clear(); r.render(this.scene, this.cam);
    r.setRenderTarget(null); r.setClearColor(cc, ca); r.toneMapping = tm;
  }
  end() { this._render(this.rt); }
}
// copy the current screen into prev, so the next scene can push over it
GPUBackend.prototype.snapshot = function () {
  this.begin();
  const m = this.quad(), U = m.material.uniforms;
  U.mode.value = 0; U.map.value = this.rt.texture; U.flipV.value = 1; U.uvr.value.set(0, 0, 1, 1); U.opacity.value = 1;
  this._place(m, 0, 0, SW, SH);
  this._render(this.prevRT);
};

class CanvasBackend {
  constructor() { this.c = canvas(); this.g = this.c.getContext('2d', { alpha: false }); this.prev = canvas(); this.alpha = [1]; }
  begin() { const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH); this.alpha = [1]; }
  push({ x = 0, y = 0, s = 1, cx = 0, cy = 0, clip, alpha = 1 } = {}) {
    const g = this.g; g.save(); g.translate(x, y);
    if (s !== 1) { g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
    if (clip) { g.beginPath(); g.rect(...clip); g.clip(); }
    this.alpha.push(this.alpha[this.alpha.length - 1] * alpha);
  }
  pop() { this.g.restore(); this.alpha.pop(); }
  get a() { return this.alpha[this.alpha.length - 1]; }
  image(src, sx, sy, sw, sh, dx, dy, dw, dh, alpha = 1) { const g = this.g; g.globalAlpha = this.a * alpha; g.drawImage(src === PREV ? this.prev : src, sx, sy, sw, sh, dx, dy, dw, dh); g.globalAlpha = 1; }
  rect(color, x, y, w, h, alpha = 1) { const g = this.g; g.globalAlpha = this.a * alpha; g.fillStyle = color; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
  circle(color, x, y, r, alpha = 1) { const g = this.g; g.globalAlpha = this.a * alpha; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
  sprite(s, dx, dy, alpha = 1) { this.image(s.c, 0, 0, s.w, s.h, dx, dy, s.w, s.h, alpha); }
  end() {}
  snapshot() { this.prev.getContext('2d').drawImage(this.c, 0, 0); }
}

/* ---- Shared pieces ---------------------------------------------------------- */
function statusBar(A, dark) {
  A.sprite(sprite('status' + (dark ? 'D' : 'L'), SW, 100, (g) => {
    g.fillStyle = dark ? '#fff' : '#111';
    g.font = `600 31px ${FONT}`; g.textBaseline = 'middle'; g.fillText('9:41', 74, 56);
    for (let i = 0; i < 4; i++) g.fillRect(560 + i * 11, 64 - (i + 1) * 5.5, 7, (i + 1) * 5.5);
    g.lineWidth = 4.2; g.lineCap = 'round'; g.strokeStyle = g.fillStyle;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(622, 66, 6 + i * 7, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
    g.globalAlpha = 0.4; g.lineWidth = 2.5; g.beginPath(); g.roundRect(652, 44, 50, 24, 7); g.stroke(); g.fillRect(705, 51, 3.5, 10);
    g.globalAlpha = 1; g.beginPath(); g.roundRect(656, 48, 36, 16, 4); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.roundRect(SW / 2 - 116, 20, 232, 68, 34); g.fill();
  }), 0, 0);
}
function ripple(A, x, y, k) {
  if (k <= 0 || k >= 1) return;
  A.circle('rgb(20,20,30)', x, y, 26 + 70 * out3(k), 0.2 * (1 - k));
  if (k < 0.45) A.circle('rgb(20,20,30)', x, y, 30, 0.16);
}
function finger(A, x, y, a) {
  if (a <= 0) return;
  A.circle('rgb(20,20,30)', x, y, 34, 0.18 * a);
  A.circle('rgb(255,255,255)', x, y, 30, 0.55 * a);
}
const edge = () => sprite('edge', 48, 16, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
// iOS push: the old screen slides a third away and dims; the new one comes in from the right with a soft edge shadow.
function push(A, drawA, drawB, k) {
  const e = ease(clamp(k));
  A.push({ x: -SW * 0.3 * e }); drawA(); A.rect('rgb(0,0,0)', 0, 0, SW, SH, 0.12 * e); A.pop();
  A.push({ x: SW * (1 - e) });
  const s = edge(); A.image(s.c, 0, 0, s.w, s.h, -48, 0, 48, SH);
  A.rect('rgb(255,255,255)', 0, 0, SW, SH); drawB(); A.pop();
}
function toast(A, k, title, sub) {
  if (k <= 0) return;
  const s = sprite('toast:' + title + sub, SW, 190, (g) => {
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
    g.fillStyle = '#1d1c1f'; g.beginPath(); g.roundRect(34, 30, SW - 68, 112, 34); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#34c759'; g.beginPath(); g.arc(94, 86, 24, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(83, 87); g.lineTo(91, 95); g.lineTo(106, 78); g.stroke();
    g.fillStyle = '#fff'; g.font = `600 29px ${FONT}`; g.fillText(title, 138, 80);
    g.fillStyle = 'rgba(255,255,255,.62)'; g.font = `400 24px ${FONT}`; g.fillText(sub, 138, 114);
  });
  A.sprite(s, 0, lerp(-150, 108, out3(k)) - 30);
}

/* A screen: a backend, the current "scene", and a snapshot for pushes between scenes. */
class Screen {
  constructor(backend) { this.A = backend; this.scene = null; this.t0 = 0; this.hasPrev = false; this.dark = false; this.rested = false; }
  play(scene, now) {
    if (this.scene) { this.A.snapshot(); this.hasPrev = true; }
    this.scene = scene; this.t0 = now; this.rested = false;
  }
  // returns true when it drew; a screen holding still is drawn once and then left alone
  draw(now) {
    const A = this.A, t = Math.max(0, (now - this.t0) / 1000);   // rAF time can trail the moment a scene was set
    const quiet = t > 0.6 && this.scene.quiet?.(t);
    if (quiet && this.rested) return false;
    this.rested = !!quiet;
    A.begin();
    const drawScene = () => { this.dark = !!this.scene.dark; this.scene(A, t, this); };
    if (this.hasPrev && t < 0.55) push(A, () => A.image(PREV, 0, 0, SW, SH, 0, 0, SW, SH), drawScene, t / 0.55);
    else drawScene();
    statusBar(A, this.dark);
    A.end();
    return true;
  }
}

/* ---- The performances --------------------------------------------------------- */
function scenes(S, BG, onKeep) {
  const full = (A, src, alpha = 1) => A.image(src, 0, 0, SW, SH, 0, 0, SW, SH, alpha);
  const typed = (A, text, x, base, t, caret) => {
    const s = sprite('txt:' + text, 360, 60, (g) => { g.fillStyle = '#1b1d29'; g.font = `500 34px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText(text, 0, 46); return { tw: g.measureText(text).width }; });
    A.sprite(s, x, base - 46);
    if (caret && (t * 2 % 1) < 0.6) A.rect('rgb(99,102,241)', x + s.tw + 3, base - 32, 3, 40);
  };
  const focus = (A, y0, y1, a) => {
    if (a <= 0) return;
    const s = sprite('focus' + (y1 - y0), 664, y1 - y0 + 8, (g, w, h) => { g.strokeStyle = '#6366f1'; g.lineWidth = 3; g.beginPath(); g.roundRect(4.5, 4, 655, h - 8, 26); g.stroke(); });
    A.sprite(s, 36.5, y0 - 4, a);
  };

  // 01 Measure: type height and weight, tap Save, land on the dashboard with a confirmation.
  const measureForm = (A, t) => {
    full(A, S.measure);
    const h = '96.4', w = '14.2';
    const nh = Math.floor(clamp((t - 1.05) / 0.64) * h.length), nw = Math.floor(clamp((t - 2.45) / 0.64) * w.length);
    if (t > 0.9) { A.rect(BG.field, 172, 902, 390, 64); typed(A, h.slice(0, nh), 180, 948, t, t < 2.2); }
    if (t > 2.3) { A.rect(BG.field, 172, 1072, 390, 64); typed(A, w.slice(0, nw), 180, 1118, t, t < 3.4); }
    focus(A, 858, 982, t > 0.85 && t < 2.2 ? 1 : 0); focus(A, 1026, 1152, t > 2.25 && t < 3.4 ? 1 : 0);
    ripple(A, 420, 930, seg(t, 0.8, 1.35)); ripple(A, 420, 1098, seg(t, 2.2, 2.75)); ripple(A, 618, 168, seg(t, 3.35, 3.9));
  };
  const measure = (A, T) => {
    const t = T % 8.6;
    if (t < 3.9) measureForm(A, t);
    else if (t < 4.4) push(A, () => measureForm(A, 3.9), () => full(A, S.dash), (t - 3.9) / 0.5);
    else { full(A, S.dash); toast(A, seg(t, 4.55, 5.0) - seg(t, 7.3, 7.8), 'Saved to Emma’s record', 'Height 96.4 cm · Weight 14.2 kg'); }
    if (t > 8.2) A.rect('rgb(248,248,252)', 0, 0, SW, SH, seg(t, 8.2, 8.6));
  };

  // 02 Understand: the growth chart draws itself; the AI's plain-words update rises into view.
  const growth = (A, T) => {
    const t = Math.min(T, 7.5);
    full(A, S.growth);
    const k = ease(seg(t, 0.7, 2.6));
    A.rect(BG.chartCard, 176, 585, 470, 372);
    A.push({ clip: [176, 560, Math.max(0.001, 470 * k), 400] }); full(A, S.growth); A.pop();
    const a = seg(t, 0.35, 0.9);
    A.rect(BG.chartCard, 70, 455, 240, 90); A.image(S.growth, 70, 455, 240, 90, 70, 455 + (1 - a) * 14, 240, 90, a);
    const c = out3(seg(t, 2.7, 3.4));
    A.rect(BG.growthPage, 20, 1086, 700, 270); A.image(S.growth, 20, 1086, 700, 270, 20, 1086 + (1 - c) * 70, 700, 270, c);
  };

  // 03 Share (the paediatrician's phone): patients arrive, one is opened, their charts draw.
  const cards = [[505, 777], [821, 1098], [1143, 1410]];
  const dlist = (A, t) => {
    full(A, S.dlist);
    A.rect(BG.list, 24, 495, 692, 925);
    cards.forEach(([y0, y1], i) => {
      const k = out3(seg(t, 0.4 + i * 0.16, 1.0 + i * 0.16));
      const press = t > 2.0 && t < 2.35 && i === 0 ? 0.985 : 1;
      A.push({ y: (1 - k) * 50, s: press, cx: SW / 2, cy: (y0 + y1) / 2, alpha: k });
      A.image(S.dlist, 24, y0 - 6, 692, y1 - y0 + 12, 24, y0 - 6, 692, y1 - y0 + 12);
      A.pop();
    });
    ripple(A, 360, 620, seg(t, 2.0, 2.6));
  };
  const ddash = (A, t) => {
    full(A, S.ddash);
    const k1 = ease(seg(t, 0.3, 1.8)), k2 = ease(seg(t, 1.2, 2.6));
    A.rect(BG.ddCard, 190, 715, 506, 350);
    A.push({ clip: [190, 700, Math.max(0.001, 506 * k1), 370] }); full(A, S.ddash); A.pop();
    A.rect(BG.ddCard, 190, 1335, 506, 230);
    A.push({ clip: [190, 1320, Math.max(0.001, 506 * k2), 250] }); full(A, S.ddash); A.pop();
  };
  const doctor = (A, T) => {
    const t = T % 10;
    if (t < 2.6) dlist(A, t);
    else if (t < 3.1) push(A, () => dlist(A, 2.6), () => ddash(A, 0), (t - 2.6) / 0.5);
    else ddash(A, t - 3.1);
    if (t > 9.6) A.rect('rgb(245,246,250)', 0, 0, SW, SH, seg(t, 9.6, 10));
  };

  // 04 Keep: a swipe through the passport: dashboard, vaccines, meals, milestones, doctors.
  const KEEP = [S.dash, S.vaccine, S.meal, S.milestone, S.doctors];
  let lastKeep = -1;
  const keep = (A, T) => {
    const per = 2.6, t = T % (per * KEEP.length), i = Math.floor(t / per), lt = t - i * per;
    const cur = KEEP[i], next = KEEP[(i + 1) % KEEP.length];
    if (lt < per - 0.55) full(A, cur);
    else push(A, () => full(A, cur), () => full(A, next), (lt - (per - 0.55)) / 0.55);
    const s = seg(lt, per - 0.85, per - 0.4);
    finger(A, lerp(620, 150, ease(s)), 980, s > 0 && s < 1 ? Math.min(1, Math.sin(s * Math.PI) * 2) : 0);
    const shown = lt < per - 0.3 ? i : (i + 1) % KEEP.length;
    if (shown !== lastKeep) { lastKeep = shown; onKeep(shown); }
  };

  // the stretches where nothing on screen moves
  const inside = (t, spans) => !spans.some(([a, b]) => t >= a && t <= b);
  measure.quiet = (T) => inside(T % 8.6, [[0.7, 5.15], [7.2, 7.9], [8.1, 8.6]]);
  growth.quiet = (T) => T > 3.6;
  doctor.quiet = (T) => inside(T % 10, [[0.3, 5.9], [9.5, 10]]);
  keep.quiet = (T) => (T % 2.6) < 2.6 - 0.95;
  const still = (fn, at) => Object.assign((A) => fn(A, at), { quiet: () => true });
  return { measure, growth, doctor, keep, growthDone: still(growth, 7.5) };
}

/* ---- The phone ---------------------------------------------------------------- */
const P = { w: 0.0716, h: 0.1476, d: 0.0083, r: 0.0112 };
function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function planeFromShape(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedShape(w, h, r), 24);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}
function makePhone(tex, frameColor = 0x3b3a37) {
  const g = new THREE.Group();
  const b = 0.0016;
  const body = new THREE.ExtrudeGeometry(roundedShape(P.w - 2 * b, P.h - 2 * b, P.r - b), {
    depth: P.d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6, curveSegments: 28,
  });
  body.center();
  const titanium = uberPhysical({ color: frameColor, metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.35 }, { aniso: false });
  const m = (geo, mat, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.z = z; o.castShadow = true; g.add(o); return o; };
  m(body, titanium);
  const front = P.d / 2;
  m(planeFromShape(P.w - 0.0011, P.h - 0.0011, P.r - 0.0006), uberPhysical({ color: 0x030303, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, { aniso: false }), front + 0.00006);
  const inset = 0.0023;
  m(planeFromShape(P.w - 2 * inset, P.h - 2 * inset, P.r - inset * 0.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), front + 0.00012).castShadow = false;
  // cover glass: adds only reflections (additive over the display)
  m(planeFromShape(P.w - 0.0011, P.h - 0.0011, P.r - 0.0006), uberPhysical({
    color: 0x000000, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }, { aniso: false }), front + 0.00018).castShadow = false;
  // side buttons
  const btn = (x, y, len) => { const o = m(new RoundedBoxGeometry(0.0014, len, 0.0036, 2, 0.0006), titanium); o.position.set(x, y, 0); };
  btn(-P.w / 2 - 0.0004, 0.035, 0.0075); btn(-P.w / 2 - 0.0004, 0.02, 0.012); btn(-P.w / 2 - 0.0004, 0.004, 0.012); btn(P.w / 2 + 0.0004, 0.022, 0.018);
  // camera plateau on the back, seen when the phone turns
  const cam = m(new RoundedBoxGeometry(0.03, 0.03, 0.0016, 3, 0.0007), uberPhysical({ color: 0x2a2927, roughness: 0.2, clearcoat: 1 }, { aniso: false }), -front - 0.0006);
  cam.position.set(-P.w / 2 + 0.019, P.h / 2 - 0.019, -front - 0.0006);
  return g;
}

/* ==========================================================================
   Init
   ========================================================================== */
export async function initApp({ stage, glCanvas, flat, onKeep }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 900px)').matches;
  const Q = new URLSearchParams(location.search);   // diagnostics: ?appdpr=&appshadow=0&appdraw=0

  // decode and clean the screens one per idle slice, so loading never blocks a scroll frame
  const S = {};
  for (const [k, f] of Object.entries(SRC)) { S[k] = clean(await load(`assets/app/${f}.jpeg`)); await idle(200); }
  const BG = {
    field: px(S.measure, 560, 930), list: px(S.dlist, 16, 700), growthPage: px(S.growth, 16, 1080),
    chartCard: px(S.growth, 640, 600), ddCard: px(S.ddash, 690, 720),
  };
  for (const k of Object.keys(S)) S[k] = await createImageBitmap(S[k]);   // GPU-friendly sources
  if (document.fonts?.ready) await document.fonts.ready;                    // sprites are drawn with the site's fonts
  const SC = scenes(S, BG, onKeep);

  let gl = true;
  try { if (!document.createElement('canvas').getContext('webgl2')) gl = false; } catch { gl = false; }

  let step = 0, parent, doctorScr;
  const setStep = (i, now = performance.now()) => {
    if (i === step) return; const prevStep = step; step = i;
    if (i === 0) parent.play(SC.measure, now);
    if (i === 1) parent.play(SC.growth, now);
    if (i === 2) { if (prevStep !== 1) parent.play(SC.growthDone, now); doctorScr?.play(SC.doctor, now); }
    if (i === 3) parent.play(SC.keep, now);
  };
  const firstView = () => new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return; io.disconnect();
    if (step === 0) parent.t0 = performance.now();          // the first performance starts when the phone is in view
  }, { threshold: 0.45 }).observe(stage);

  /* no WebGL: the same performance on a canvas inside a CSS phone */
  if (!gl) {
    parent = new Screen(new CanvasBackend());
    parent.play(SC.measure, performance.now()); firstView();
    const fg = flat.getContext('2d');
    const loop = (now) => { if (parent.draw(now)) fg.drawImage(parent.A.c, 0, 0); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return { setStep };
  }
  stage.classList.add('is-gl');

  /* ---- Three ---------------------------------------------------------------- */
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, +(Q.get('appdpr') || 2)));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.debug.checkShaderErrors = Q.has('debug');
  renderer.shadowMap.enabled = Q.get('appshadow') !== '0'; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  studioEnvironment(renderer, scene, 0.85);
  const camera = new THREE.PerspectiveCamera(22, 1, 0.01, 5);

  const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(-0.35, 0.45, 0.6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 8; key.shadow.blurSamples = 20; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -0.25, right: 0.25, top: 0.25, bottom: -0.25, near: 0.1, far: 2 });
  scene.add(key);
  // the page itself: an invisible wall that only receives the phone's shadow
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShadowMaterial({ opacity: 0.12 }));
  wall.position.z = -0.045; wall.receiveShadow = true; scene.add(wall);

  parent = new Screen(new GPUBackend(renderer)); doctorScr = new Screen(new GPUBackend(renderer));
  parent.play(SC.measure, performance.now()); doctorScr.play(SC.doctor, performance.now()); firstView();
  const phoneA = makePhone(parent.A.texture), phoneB = makePhone(doctorScr.A.texture, 0x8c8780);   // the doctor's phone in natural titanium
  scene.add(phoneA, phoneB);
  phoneB.visible = false;

  /* poses per step: [x, y, z, rx, ry, rz] */
  const POSE = {
    A: [[0, 0, 0, 0.02, -0.28, -0.035], [0, 0, 0, 0.0, -0.12, 0.02], [-0.036, 0, 0, 0.0, 0.3, 0.01], [0, 0, 0, 0.03, -0.2, -0.02]],
    B: [[0.22, 0, -0.04, 0, -0.4, 0], [0.22, 0, -0.04, 0, -0.4, 0], [0.04, -0.004, -0.018, 0.0, -0.3, -0.015], [0.22, 0, -0.04, 0, -0.4, 0]],
  };
  const st = (p) => ({ p: p.slice(), v: [0, 0, 0, 0, 0, 0] });
  const A = st(POSE.A[0]), B = st(POSE.B[0]);
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!mobile && !reduced) {
    stage.closest('section').addEventListener('pointermove', e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  }
  let scrollV = 0, lastY = scrollY;
  addEventListener('scroll', () => { scrollV += (scrollY - lastY) * 0.00012; lastY = scrollY; }, { passive: true });

  let W = 1, H = 1, dist = 0.53;
  const resize = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    // fit a phone to ~74% of the stage height, and two phones to the width when needed
    const fitH = (P.h / 0.74) / (2 * Math.tan(THREE.MathUtils.degToRad(11)));
    const fitW = (0.19 / (2 * Math.tan(THREE.MathUtils.degToRad(11)) * camera.aspect));
    dist = { one: fitH, two: Math.max(fitH * 1.08, fitW) };
    camera.updateProjectionMatrix();
  };
  resize(); new ResizeObserver(resize).observe(stage);

  const spring = (s, target, w, z, dt) => {
    for (let i = 0; i < 6; i++) { const a = w * w * (target[i] - s.p[i]) - 2 * z * w * s.v[i]; s.v[i] += a * dt; s.p[i] += s.v[i] * dt; }
    if (reduced) { s.p = target.slice(); }
  };
  const apply = (obj, s, extra) => { obj.position.set(s.p[0], s.p[1] + extra.y, s.p[2]); obj.rotation.set(s.p[3] + extra.rx, s.p[4] + extra.ry, s.p[5]); };
  let camZ = 0.53, last = performance.now(), drawTick = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 3)); ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt * 3));
    scrollV *= Math.exp(-dt * 4);
    spring(A, POSE.A[step], 7, 0.62, dt); spring(B, POSE.B[step], 6.5, 0.62, dt);
    const float = reduced ? 0 : 1;
    const common = { y: Math.sin(t * 0.9) * 0.0018 * float, rx: -ptr.sy * 0.16 + clamp(scrollV, -0.12, 0.12), ry: ptr.sx * 0.3 };
    apply(phoneA, A, common);
    apply(phoneB, B, { y: Math.sin(t * 0.9 + 1.4) * 0.0018 * float, rx: common.rx * 0.8, ry: common.ry * 0.8 });
    phoneB.visible = B.p[0] < 0.2;
    const cz = step === 2 ? dist.two : dist.one;
    camZ += (cz - camZ) * (1 - Math.exp(-dt * 4));
    camera.position.set(0, 0, camZ); camera.lookAt(0, 0, 0);

    // the screens are drawn on the GPU straight into the textures the glass shows
    if (Q.get('appdraw') !== '0') {
      parent.draw(now);
      if (phoneB.visible) doctorScr.draw(now);
    }
    renderer.render(scene, camera);
  }
  const runner = createLoop({ renderer, stage, frame, onResize: resize,
    // as the station arrives the phones fade out (story.css --exit): weigh the scene by what is left of it
    weight: () => clamp(1 - 1.35 * Math.min(1, (window.SR?.stationEnter || 0) / 0.5), 0, 1) });
  parent.draw(performance.now()); doctorScr.draw(performance.now());
  await warmUp(renderer, scene, camera, () => renderer.render(scene, camera));
  runner.start();
  window.SR = window.SR || {};
  window.SR.appProbe = () => ({ step, frames: runner.frames, visibleB: phoneB.visible });
  return { setStep };
}
