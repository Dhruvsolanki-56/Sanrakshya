/* ==========================================================================
   Sanrakshya studio — shared set for every 3D scene on the site.

   One photographic language: a warm paper sweep, morning light through a
   window, soft contact shadows, and a lens pass (slight aberration, falloff,
   fine grain). Scenes differ in what stands on the sweep, never in the light.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/addons/RoomEnvironment.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---- Procedural textures -------------------------------------------------- */
export function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Microscopic surface variation — keeps highlights from looking CG-perfect.
export function microRoughness(base = 0.6, spread = 0.08) {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const n = (Math.random() + Math.random() + Math.random()) / 3;
      const v = clamp(base + (n - 0.5) * spread * 2) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: true });
}

// Window gobo for the key light: morning sun through a six-pane window.
export function windowGobo() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.save();
    g.shadowColor = '#fff'; g.shadowBlur = 10; g.shadowOffsetX = 2000;
    g.fillStyle = '#fff';
    const pad = 40, gap = 30, cols = 2, rows = 3;
    const cw = (w - pad * 2 - gap * (cols - 1)) / cols, ch = (h - pad * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.fillRect(pad + c * (cw + gap) - 2000, pad + r * (ch + gap), cw, ch);
    g.restore();
  });
}

// Soft contact shadow (alpha) for things that meet the floor.
export function contactShadow(wm, hm, inner = 0.66, blur = 22, round = 0.08) {
  return canvasTex(256, Math.round(256 * hm / wm), (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.save();
    g.shadowColor = '#fff'; g.shadowBlur = blur; g.shadowOffsetX = 2000;
    g.fillStyle = '#fff';
    const iw = w * inner, ih = h * inner, r = Math.min(iw, ih) * round;
    g.beginPath(); g.roundRect((w - iw) / 2 - 2000, (h - ih) / 2, iw, ih, r); g.fill();
    g.restore();
  }, { srgb: false });
}
export function contactShadowMesh(w, d, { inner = 0.7, blur = 26, round = 0.08, opacity = 0.85 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: 0x1b1712, alphaMap: contactShadow(w, d, inner, blur, round), transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0008; m.renderOrder = -1;
  return m;
}

/* ---- Renderer + environment ---------------------------------------------- */
export function makeRenderer(canvas, { hi, still }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !hi, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!still });
  // full-screen scenes render at up to 1.5×; the lens grain and falloff make 1.5× and 2× indistinguishable
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.autoUpdate = false;                       // scenes refresh shadows only when something moved
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.debug.checkShaderErrors = new URLSearchParams(location.search).has('debug');   // no blocking shader-log queries in production
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export function studioEnvironment(renderer, scene, intensity = 0.5) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
}

/* Cyclorama: floor sweeping into wall, like a studio paper roll.
   cz is where the floor starts to curve; R the radius of the curve. */
export function cyclorama({ cz = -1.1, R = 1.5, X = 7, color = 0xe8e3db } = {}) {
  const prof = [];
  for (let z = 5; z > cz; z -= 0.25) prof.push([z, 0]);
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; prof.push([cz - Math.sin(a) * R, R - Math.cos(a) * R]); }
  for (let y = R + 0.3; y <= 7; y += 0.5) prof.push([cz - R, y]);
  const xs = 24;
  const pos = [], idx = [];
  prof.forEach(([z, y]) => { for (let i = 0; i <= xs; i++) pos.push(-X + (i / xs) * 2 * X, y, z); });
  for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < xs; i++) {
    const a = j * (xs + 1) + i, b = a + 1, c = a + xs + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const paper = new THREE.MeshStandardMaterial({ color, roughness: 0.94, roughnessMap: microRoughness(0.94, 0.04) });
  const cyc = new THREE.Mesh(geo, paper);
  cyc.receiveShadow = true;
  return cyc;
}

/* Window light: a spot with a gobo so the sweep carries the shadow of panes. */
export function windowLight(scene, { intensity = 95, position = [-3.1, 2.7, 2.5], target = [0.55, 0.85, -1.6], angle = 0.36, hi = true } = {}) {
  const key = new THREE.SpotLight(0xffeedb, intensity, 0, angle, 0.55, 2);
  key.map = windowGobo();
  key.castShadow = true;
  key.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  key.shadow.bias = -0.00015; key.shadow.normalBias = 0.015; key.shadow.radius = hi ? 5 : 3; key.shadow.blurSamples = 16;
  key.shadow.camera.near = 1; key.shadow.camera.far = 9;
  key.position.set(...position);
  key.target.position.set(...target);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xe4e9f2, 0.55);
  rim.position.set(2.4, 2.4, -2.0); scene.add(rim);
  const bounce = new THREE.DirectionalLight(0xfff6ec, 0.18);
  bounce.position.set(0.2, -1, 1.5); scene.add(bounce);
  const base = { x: position[0], z: position[2], i: intensity };
  // the sun drifts: shadows crawl across the sweep, almost too slowly to notice
  key.drift = (t) => {
    key.position.x = base.x + Math.sin(t * 0.045) * 0.22;
    key.position.z = base.z + Math.cos(t * 0.037) * 0.12;
    key.intensity = base.i * (0.96 + 0.04 * Math.sin(t * 0.11));
  };
  return key;
}

/* Lens: MSAA target → aberration, falloff, grain → tone map. Off on phones. */
export function createLens(renderer, enabled) {
  if (!enabled) return { render: (s, c) => renderer.render(s, c), setSize() {}, target: null };
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: devicePixelRatio >= 1.5 ? 2 : 4 });   // dense screens need less AA
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uGrain: { value: 0.013 }, uVig: { value: 0.22 }, uCA: { value: 0.006 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uCA; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main(){
        vec2 d = vUv - .5; float r2 = dot(d, d);
        vec2 o = d * r2 * uCA;
        vec3 c = vec3(texture2D(tDiffuse, vUv - o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + o).b);
        c *= mix(1., smoothstep(1.05, .15, sqrt(r2) * 1.25), uVig);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float g = hash(vUv * uRes + fract(uTime * 7.13) * 91.7) - .5;
        gl_FragColor.rgb += g * uGrain;
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    render(scene, camera, t = 0) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      mat.uniforms.uTime.value = t;
      renderer.render(postScene, postCam);
    },
    setSize(w, h) { rt.setSize(w, h); mat.uniforms.uRes.value.set(w, h); },
    target: rt,
    warm() { renderer.compile(postScene, postCam); },
  };
}

/* Lens shift: move the image on the sensor instead of tilting the camera,
   so verticals stay vertical — as an architectural photographer would. */
export function applyShift(camera, sx, sy) {
  const e = camera.projectionMatrix.elements; e[8] = sx; e[9] = sy;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

/* Loop: render only while the stage is on screen and the tab is visible;
   step the pixel ratio down if frames run long. */
/* One frame scheduler for every 3D scene on the page.
   Between sections two scenes can be on screen at once; rendering both every frame
   doubles the GPU cost exactly where the reader is scrolling. So each frame, the scene
   that fills most of the viewport renders; a scene that is only sliding in or out holds
   its last frame and refreshes occasionally. The cost of a boundary stays one scene.
   Resolution steps down only if the page as a whole runs long, and only for the scene
   that is actually being watched. */
const LOOPS = new Set();
if (window.SR) SR.loops = LOOPS;
let schedRaf = 0, schedTick = 0, schedLast = 0, schedAcc = 0, schedN = 0;
function schedule(now) {
  schedRaf = 0;
  const vh = innerHeight, live = [];
  let any = false;
  for (const L of LOOPS) {
    if (!L.on) continue;
    any = true;
    const r = L.stage.getBoundingClientRect();
    // a chapter that rises over this one on opaque paper hides everything below its top edge:
    // the covered scene stops drawing the moment it can no longer be seen
    const bottom = Math.min(r.bottom, vh, L.cover ? L.cover.getBoundingClientRect().top : vh);
    // weighted by how much of the scene is actually showing (a canvas fading in or out counts less)
    const v = Math.max(0, bottom - Math.max(r.top, 0)) / vh * L.weight();
    if (v > 0.02) live.push([v, L]);
  }
  // keep watching while a scene is merely covered, so it resumes the frame it is uncovered
  if (!any) { schedLast = 0; return; }
  schedRaf = requestAnimationFrame(schedule);
  if (!live.length) { schedLast = 0; return; }
  schedTick++;
  live.sort((a, b) => b[0] - a[0]);
  // while the page itself is moving, a scene whose picture is not driven by scroll can draw
  // every other frame: the browser still moves its canvas at full rate, and the GPU time goes
  // to the scroll instead
  const moving = Math.abs(window.SR?.lenis?.velocity || 0) > 0.5;
  live.forEach(([v, L], i) => {
    const primary = i === 0 || v > 0.6;
    if (primary && moving && L.eases && schedTick % 2) return;
    if (primary || schedTick % 6 === 0) { L.frames++; L.frame(now); }
  });
  // page-level frame time: if it runs long for a while, soften the primary scene only
  if (schedLast) { schedAcc += now - schedLast; schedN++; }
  schedLast = now;
  if (schedN >= 120) {
    const avg = schedAcc / schedN; schedAcc = 0; schedN = 0;
    const P = live[0][1], pr = P.renderer.getPixelRatio();
    if (avg > 24 && pr > 1) { P.renderer.setPixelRatio(Math.max(1, pr - 0.25)); P.onResize(); }
  }
}
const kick = () => { if (!schedRaf) { schedLast = 0; schedRaf = requestAnimationFrame(schedule); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

export function createLoop({ renderer, stage, frame, onResize, weight = () => 1, eases = false }) {
  const next = stage.closest('section')?.nextElementSibling;
  const cover = next?.matches('.clinic, .scale') ? next : null;
  const L = { renderer, stage, frame, onResize, weight, eases, cover, on: false, visible: false, started: false, frames: 0 };
  const set = () => { L.on = L.started && L.visible && !document.hidden; if (L.on) kick(); };
  new IntersectionObserver(([en]) => { L.visible = en.isIntersecting; set(); }, { rootMargin: '10% 0px' }).observe(stage);
  document.addEventListener('visibilitychange', set);
  LOOPS.add(L);
  return { start: () => { L.started = true; set(); }, get frames() { return L.frames; } };
}

/* Warm-up: compile every shader off the main thread where the driver allows it,
   upload every texture, and draw one frame, all before the scene is ever seen.
   Without this, the first frame on screen pays for all of it mid-scroll. */
export async function warmUp(renderer, scene, camera, renderOnce, lens) {
  try {
    // compile the variants that will actually be drawn: scenes seen through the lens are
    // rendered into its target (no tone mapping there), so compile against that target
    if (lens?.target) renderer.setRenderTarget(lens.target);
    const ready = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    lens?.warm?.();
    await ready;
  } catch (e) { /* older drivers: compiled on first render */ }
  scene.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) for (const k of ['map', 'alphaMap', 'roughnessMap', 'normalMap', 'bumpMap', 'metalnessMap']) if (m[k]) renderer.initTexture(m[k]);
  });
  await idle(400);
  renderOnce?.();
}
export const idle = (timeout = 300) => new Promise(r => ('requestIdleCallback' in window) ? requestIdleCallback(() => r(), { timeout }) : setTimeout(r, 30));

/* One program for every physical material in a scene: each material switches on the
   same features (clearcoat, sheen, anisotropy, a colour map and a roughness map — a
   white pixel where a part has none), so the GPU compiles a single shader for all of
   them. The values still differ per material; only the shader is shared. */
const WHITE = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
export function uberPhysical(o = {}, { aniso = true } = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: WHITE, roughnessMap: WHITE, ...o,
    clearcoat: Math.max(o.clearcoat || 0, 0.001), sheen: Math.max(o.sheen || 0, 0.001),
    ...(aniso ? { anisotropy: Math.max(o.anisotropy || 0, 0.001) } : {}),
  });
}
