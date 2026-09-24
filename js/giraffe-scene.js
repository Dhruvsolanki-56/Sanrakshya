/* ==========================================================================
   Sanrakshya home — a wooden giraffe, photographed, that is quietly alive.

   Why a giraffe: it is the animal of height, the oldest nursery motif for
   "look how tall you've grown". It is built like a design-shop toy — turned
   maple, hand-painted patches, walnut details — and it plays along: it
   watches the cursor, blinks, flicks an ear, breathes, grows when held, and
   answers the headline's hidden words.

   Units are metres (a large toy: ~0.5 m tall). Same studio as the station.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/addons/RoundedBoxGeometry.js';
import {
  clamp, lerp, smooth, canvasTex, contactShadowMesh, makeRenderer, studioEnvironment,
  cyclorama, windowLight, createLens, applyShift, createLoop, warmUp,
} from './studio.js';
import { buildRabbit, buildOwl } from './toys.js';
import { nursery } from './room.js';

const TAU = Math.PI * 2;

/* ---- Pattern volumes -----------------------------------------------------------
   Noise and Voronoi cells are computed once, here, into two small tileable 3D
   textures. The skin shaders sample them instead of searching neighbouring cells
   per pixel, so they stay small: they compile quickly and run cheaply. */
const vol = (N, fill) => {
  const d = new Uint8Array(N * N * N * 4); fill(d, N);
  const t = new THREE.Data3DTexture(d, N, N, N);
  t.format = THREE.RGBAFormat; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
};
// Seeded, so every visit meets the same giraffe: its patches never reshuffle on a reload.
const seeded = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const noiseRnd = seeded(0x5A17);
const NOISE = vol(64, (d) => { for (let i = 0; i < d.length; i++) d[i] = (noiseRnd() * 256) | 0; });
// The Voronoi volume is built in a worker, so the page never waits on it.
const VOR_N = 80;
const VORONOI = vol(VOR_N, () => {});
const VORONOI_READY = new Promise((resolve) => {
  const src = `onmessage = (e) => {
    const N = e.data, C = 8, R = N / C, P = new Float32Array(C * C * C * 4), d = new Uint8Array(N * N * N * 4);
    let a = 0x6172; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < C * C * C; i++) { P[i*4] = .1 + rnd() * .8; P[i*4+1] = .1 + rnd() * .8; P[i*4+2] = .1 + rnd() * .8; P[i*4+3] = rnd(); }
    let o = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = (x + .5) / R, py = (y + .5) / R, pz = (z + .5) / R, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
      let d1 = 9, d2 = 9, id = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz;
        const k = ((((cz % C) + C) % C) * C * C + (((cy % C) + C) % C) * C + (((cx % C) + C) % C)) * 4;
        const ex = cx + P[k] - px, ey = cy + P[k+1] - py, ez = cz + P[k+2] - pz, dd = Math.sqrt(ex*ex + ey*ey + ez*ez);
        if (dd < d1) { d2 = d1; d1 = dd; id = P[k+3]; } else if (dd < d2) d2 = dd;
      }
      d[o++] = Math.min(255, d1 / 1.6 * 255); d[o++] = Math.min(255, d2 / 1.6 * 255); d[o++] = id * 255; d[o++] = 255;
    }
    postMessage(d, [d.buffer]);
  };`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  w.onmessage = (e) => { VORONOI.image.data = e.data; VORONOI.needsUpdate = true; w.terminate(); resolve(); };
  w.postMessage(VOR_N);
});

/* ---- Coats: realistic animal skins, and painted wood ----------------------------
   One physical material and one shader for every toy. Colour comes from a pattern
   in the part's own space; relief comes from a height field turned into a
   per-pixel normal, so hair and feathers catch the window light. Hair is faded out
   where it would be finer than a pixel, so nothing shimmers.
     0 giraffe  reticulated patches, cream seams, short hair along the part
     1 rabbit   agouti plush: fawn back, cream belly, ticking
     2 owl      overlapping scalloped feathers with pale tips and dark shafts
     3 owl belly  cream with teardrop streaks
     4 owl face   radiating facial disc with a darker ruff
     5 wood     turned maple with grain and painted patches (the alphabet blocks) */
const COAT_GLSL = /* glsl */`
  uniform float uType, uCell, uSeed, uSpots, uBump, uFur;
  uniform vec2 uFade;
  uniform vec3 uAxis, uC0, uC1, uC2, uBelly;
  uniform sampler3D uNoise, uVor;
  varying vec3 vLocal;
  float gH;
  vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  float vnoise(vec3 p){ return texture(uNoise, p * .015625).r; }
  float vnoise2(vec3 p){ return texture(uNoise, p * .015625).g; }
  float fbm(vec3 p){ return vnoise(p) * .5 + vnoise2(p * 2.03 + 17.1) * .3 + texture(uNoise, (p * 4.1 + 31.7) * .015625).b * .2; }
  vec3 vor(vec3 p){ vec3 v = texture(uVor, p * .125).rgb; return vec3(v.x * 1.6, v.y * 1.6, v.z); }   // F1, F2, cell id
  // hair: streaks running along the part's axis; faded where finer than a pixel
  float hair(vec3 p, float freq){
    float along = dot(p, uAxis); vec3 ac = p - uAxis * along;
    float fw = length(fwidth(p)) * freq;
    return mix(vnoise(ac * freq + uAxis * along * freq * .14 + uSeed), .5, clamp(fw * 1.4 - .4, 0., 1.));
  }
`;
// Every toy material enables the same features (sheen, clearcoat), so the GPU builds
// one program for all of them instead of one per combination.
function coatMaterial({ type = 0, cell = 0.03, seed = 0, spots = 1, fade = [-1, -1], axis = [0, 1, 0], c0 = 0xefe0c2, c1 = 0x8e3f1c, c2 = 0xb75a28, belly = [0, -0.2, 1], bump = 0.0006, fur = 380, roughness = 0.8, sheen = 0.85, sheenColor = 0xfff0dc, clearcoat = 0, clearcoatRoughness = 0.5 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness, sheen: Math.max(sheen, 0.001), sheenRoughness: 0.5, sheenColor: new THREE.Color(sheenColor).multiplyScalar(0.7),
    clearcoat: Math.max(clearcoat, 0.001), clearcoatRoughness,
  });
  const u = {
    uType: { value: type }, uCell: { value: cell }, uSeed: { value: seed }, uSpots: { value: spots }, uBump: { value: bump }, uFur: { value: fur },
    uFade: { value: new THREE.Vector2(...fade) }, uAxis: { value: new THREE.Vector3(...axis).normalize() },
    uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uC2: { value: new THREE.Color(c2) }, uBelly: { value: new THREE.Vector3(...belly).normalize() },
    uNoise: { value: NOISE }, uVor: { value: VORONOI },
  };
  m.onBeforeCompile = coatCompile;
  m.userData.coat = u;
  return m;
}
function coatCompile(sh, renderer) {
  Object.assign(sh.uniforms, this.userData.coat);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + COAT_GLSL)
    .replace('#include <map_fragment>', `
        {
          vec3 p = vLocal, coat; gH = 0.;
          if (uType < .5) {                                     // giraffe
            vec3 q = p / uCell + uSeed;
            q += (vec3(vnoise(q * 1.3), vnoise(q * 1.3 + 17.), vnoise(q * 1.3 + 31.)) - .5) * .75;
            vec3 v = vor(q); float e = v.y - v.x;
            float w = .085 + (fbm(p * 140.) - .5) * .06;
            float m = smoothstep(w, w + .035, e) * uSpots;
            if (uFade.x < uFade.y) m *= smoothstep(uFade.x, uFade.y, p.y);
            else if (uFade.x > uFade.y) m *= 1. - smoothstep(uFade.y, uFade.x, p.y);
            vec3 pc = mix(uC1, uC2, v.z) * (.82 + .3 * fbm(q * 2.4));
            pc *= 1. - .2 * smoothstep(w + .2, w + .04, e);     // patches darken toward their rims
            float hr = hair(p, uFur);
            coat = mix(uC0 * (.9 + .16 * fbm(p * 70.)), pc, m) * (.93 + .14 * hr);
            gH = hr * .8 + m * .15;
          } else if (uType < 1.5) {                            // rabbit
            vec3 n = normalize(p);
            float belly = smoothstep(.1, .7, dot(n, uBelly));
            float back = smoothstep(.15, .95, dot(n, normalize(vec3(0., .75, -.65))));
            float hr = hair(p, uFur), tick = hair(p * 1.7 + 5., uFur * 1.6);
            coat = mix(uC0, uC1, belly) * (1. - .2 * back) * (.84 + .3 * tick) * (.95 + .1 * fbm(p * 30.));
            gH = hr;
          } else if (uType < 2.5) {                            // owl plumage: every feather its own
            float th = atan(p.x, p.z);
            float u2 = th / uCell, v2 = p.y / (uCell * .8);
            float row = floor(v2); u2 += row * .5 + (h33(vec3(row, 7., 1.)).x - .5) * .35;
            vec2 id = vec2(floor(u2), row); vec3 rh = h33(vec3(id, 5.));
            vec2 f = vec2(fract(u2) - .5 + (rh.x - .5) * .16, fract(v2));
            float d = length(vec2(f.x * 1.15, f.y - .6));
            float body = smoothstep(.66, .46, d), rim = smoothstep(.42, .62, d) * smoothstep(.82, .62, d);
            float vane = .5 + .5 * sin(f.y * 20. + abs(f.x) * 30. + rh.z * 6.);              // barbs angled off the shaft
            float shaft = smoothstep(.05, 0., abs(f.x)) * smoothstep(.2, .85, f.y);
            vec3 fc = mix(uC0, mix(uC0, uC1, .5), rh.y * .6) * (.9 + .2 * fbm(p * 9.));
            coat = mix(fc, uC1, rim * .5) * (.92 + .1 * vane * body) * (1. - shaft * .22);
            coat *= 1. - .22 * smoothstep(.55, .75, sin(f.y * 8. + rh.z * 6.)) * body * step(.45, rh.x);   // a few barred feathers
            gH = body * .35 + vane * .22 * body + rim * .08 + hair(p, uFur) * .15;
          } else if (uType < 3.5) {                            // owl belly: teardrop streaks on cream down
            vec3 v = vor(vec3(p.x * 9., p.y * 5.2, p.z * 9.) + uSeed);
            float drop = smoothstep(.3, .1, v.x) * step(.5, v.z) * smoothstep(.2, .6, fbm(p * 4. + 2.));
            coat = mix(uC0, uC1, drop * .75) * (.94 + .1 * fbm(p * 40.));
            gH = hair(p, uFur) * .6 + drop * .15;
          } else if (uType < 4.5) {                            // owl facial disc
            float r = length(p.xz) / .025, ang = atan(p.z, p.x);
            float lines = .5 + .5 * sin(ang * 64. + fbm(p * 180.) * 4.);
            coat = mix(uC0, uC1, lines * .22 + smoothstep(.72, 1., r) * .65);
            gH = lines * .5;
          } else {                                             // wood: turned maple, hand-painted patches
            float along = dot(p, uAxis); vec3 across = p - uAxis * along;
            float ring = length(across) * 420. + vnoise(p * 60. + uSeed) * 3.2 + along * 6.;
            float grain = smoothstep(.62, 1., abs(sin(ring)));
            float fleck = vnoise(p * 900. + uSeed) * .5 + vnoise2(p * 2400.) * .5;
            vec3 wood = uC0 * (.93 - grain * .075 + (fleck - .5) * .05);
            vec3 v = vor(p / uCell + uSeed);
            float edge = .06 + vnoise(p * 180.) * .05;
            float pch = smoothstep(edge, edge + .05, v.y - v.x) * uSpots;
            if (uFade.x < uFade.y) pch *= smoothstep(uFade.x, uFade.y, p.y);
            else if (uFade.x > uFade.y) pch *= 1. - smoothstep(uFade.y, uFade.x, p.y);
            coat = mix(wood, uC1 * (.9 + vnoise(p / uCell * 1.7 + 7.) * .22), pch);
            gH = grain * .2;
          }
          diffuseColor.rgb *= coat;
        }
        #include <map_fragment>`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(gH), dhy = dFdy(gH);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * uBump);
        }`);
}
function woodMaterial({ spots = 1, cell = 0.03, seed = 0, fade = [-1, -1], axis = [0, 1, 0], wood = 0xdcbc91, paint = 0xae5f2c } = {}) {
  return coatMaterial({ type: 5, spots, cell, seed, fade, axis, c0: wood, c1: paint, roughness: 0.52, clearcoat: 0.28, clearcoatRoughness: 0.45, sheen: 0, bump: 0.00015 });
}
// Plain toy parts (walnut, bead eyes, carrot, ears...) share one physical program too.
function plain(o) { return new THREE.MeshPhysicalMaterial({ ...o, sheen: Math.max(o.sheen || 0, 0.001), clearcoat: Math.max(o.clearcoat || 0, 0.001) }); }

/* ---- Block faces: painted letters ------------------------------------------ */
function letterTex(ch, color) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.font = '400 190px "Newsreader", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, w / 2, h / 2 + 12);
    // a hand-painted border inset from the edge
    g.strokeStyle = color; g.lineWidth = 7; g.beginPath(); g.roundRect(20, 20, w - 40, h - 40, 18); g.stroke();
  });
}

/* ==========================================================================
   Scene
   ========================================================================== */
export function initGiraffe({ stage, canvas, annot, hint, words, growButton, onToy }) {
  const SR = window.SR || {};
  const params = new URLSearchParams(location.search);
  const still = params.get('gstill');
  const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  const portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
  const reduced = !!SR.reduced;
  const hi = !mobile;

  const renderer = makeRenderer(canvas, { hi, still });
  const scene = new THREE.Scene();
  studioEnvironment(renderer, scene, 0.55);
  scene.add(nursery({ wallZ: -0.85, chartX: 0.42 }));    // the toys stand in a child's room
  const key = windowLight(scene, { hi, intensity: 42, position: [-2.2, 2.1, 1.7], target: [0.35, 0.35, -1.1], angle: 0.42 });
  key.shadow.camera.near = 1; key.shadow.camera.far = 6;
  const lens = createLens(renderer, hi && params.get('post') !== '0');
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 20);

  /* ---- Materials ----------------------------------------------------------- */
  const walnut = plain({ color: 0x4a2f20, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const bead = plain({ color: 0x0c0a09, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });

  /* ---- The giraffe (faces +x in its own space) ------------------------------ */
  const root = new THREE.Group();
  root.rotation.y = -2.25;                         // turned toward the headline, three-quarter to camera
  root.position.set(0.02, 0, 0);
  scene.add(root);
  const part = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };

  // body: a turned capsule, a little deeper at the chest
  const bodyG = new THREE.Group(); bodyG.position.set(0, 0.205, 0); root.add(bodyG);
  const bodyGeo = new THREE.CapsuleGeometry(0.066, 0.13, 12, 32); bodyGeo.rotateZ(Math.PI / 2);
  const body = part(bodyGeo, coatMaterial({ cell: 0.032, seed: 4.7, axis: [1, 0, 0] }), bodyG);
  body.scale.set(1, 1.08, 0.95);

  // legs: slightly splayed, spots fading out toward the hooves
  const legs = [];
  for (const [x, z, s] of [[0.078, 0.036, 2.1], [0.078, -0.036, 3.7], [-0.078, 0.036, 5.2], [-0.078, -0.036, 6.9]]) {
    const g = new THREE.CylinderGeometry(0.02, 0.0158, 0.172, 24); g.translate(0, -0.086, 0);
    const pivot = new THREE.Group(); pivot.position.set(x, 0.185, z); root.add(pivot);
    const leg = part(g, coatMaterial({ cell: 0.024, seed: s, fade: [-0.11, -0.06] }), pivot);
    part(new THREE.SphereGeometry(0.02, 20, 10), leg.material, pivot, 0, 0, 0).scale.y = 0.6;
    part(new THREE.CylinderGeometry(0.0162, 0.0172, 0.014, 24), walnut, pivot, 0, -0.178, 0);   // walnut hoof, on the floor
    pivot.rotation.x = z > 0 ? -0.05 : 0.05; pivot.rotation.z = x > 0 ? -0.03 : 0.03;
    legs.push(pivot);
  }

  // neck: pivots at the shoulders, stretches along its own length
  const neckPivot = new THREE.Group(); neckPivot.position.set(0.1, 0.24, 0); neckPivot.rotation.z = -0.4; root.add(neckPivot);
  const neckStretch = new THREE.Group(); neckPivot.add(neckStretch);
  const NECK = 0.25;
  const neckGeo = new THREE.CylinderGeometry(0.022, 0.034, NECK, 32, 8); neckGeo.translate(0, NECK / 2, 0);
  part(neckGeo, coatMaterial({ cell: 0.021, seed: 9.1, fade: [0.25, 0.2] }), neckStretch);
  const mane = part(new RoundedBoxGeometry(0.014, NECK * 0.88, 0.008, 2, 0.003), coatMaterial({ spots: 0, c0: 0x5b3521, fur: 700, bump: 0.0009 }), neckStretch, -0.024, NECK * 0.47, 0);
  mane.rotation.z = -0.05;

  // head: level on top of the neck, with muzzle, ossicones, ears and bead eyes
  const headPivot = new THREE.Group(); neckPivot.add(headPivot);
  headPivot.rotation.order = 'YXZ';
  const head = new THREE.Group(); headPivot.add(head);
  const skull = new THREE.CapsuleGeometry(0.029, 0.05, 10, 28); skull.rotateZ(Math.PI / 2);
  const headMat = coatMaterial({ spots: 0.55, cell: 0.014, seed: 12.4, axis: [1, 0, 0] });
  part(skull, headMat, head, 0.028, 0.012, 0).scale.set(1, 1, 0.9);
  part(new THREE.SphereGeometry(0.027, 28, 18), coatMaterial({ spots: 0, axis: [1, 0, 0], seed: 3, c0: 0xe6d0aa, fur: 520 }), head, 0.074, 0.001, 0).scale.set(1.05, 0.86, 0.82);
  for (const z of [-0.0075, 0.0075]) part(new THREE.SphereGeometry(0.0017, 10, 8), walnut, head, 0.1005, 0.002, z).scale.set(0.5, 1, 1);   // nostrils, barely there
  for (const z of [-0.013, 0.013]) {
    const o = part(new THREE.CylinderGeometry(0.0048, 0.0062, 0.03, 16), headMat, head, -0.002, 0.052, z);
    o.rotation.x = z > 0 ? 0.18 : -0.18;
    part(new THREE.SphereGeometry(0.0074, 16, 10), walnut, o, 0, 0.017, 0);
  }
  const ears = [-1, 1].map(side => {
    const p = new THREE.Group(); p.position.set(-0.006, 0.034, side * 0.024); head.add(p);
    const e = part(new THREE.SphereGeometry(1, 20, 12), headMat, p, 0, 0, side * 0.018);
    e.scale.set(0.011, 0.0055, 0.022);
    p.userData.side = side; p.rotation.x = side * 0.35;
    return p;
  });
  const eyes = [-1, 1].map(side => part(new THREE.SphereGeometry(0.0072, 20, 14), bead, head, 0.05, 0.024, side * 0.0232));

  // tail: a thin walnut-tipped cord
  const tailPivot = new THREE.Group(); tailPivot.position.set(-0.128, 0.225, 0); root.add(tailPivot);
  const tailGeo = new THREE.CylinderGeometry(0.0028, 0.0045, 0.085, 10); tailGeo.translate(0, -0.042, 0);
  part(tailGeo, coatMaterial({ spots: 0, seed: 4, c0: 0xd9bf96 }), tailPivot);
  part(new THREE.SphereGeometry(0.009, 14, 10), walnut, tailPivot, 0, -0.088, 0).scale.set(0.8, 1.5, 0.8);

  root.add(contactShadowMesh(0.34, 0.16, { inner: 0.62, blur: 20, round: 0.5, opacity: 0.55 }));
  for (const l of legs) {
    const s = contactShadowMesh(0.07, 0.07, { inner: 0.45, blur: 12, round: 0.5, opacity: 0.8 });
    s.position.set(l.position.x, 0.0009, l.position.z); root.add(s);
  }

  /* ---- Alphabet blocks at its feet ----------------------------------------- */
  const blockGeo = (s) => new RoundedBoxGeometry(s, s, s, 3, s * 0.1);
  const blockMat = woodMaterial({ spots: 0, seed: 21, axis: [0, 1, 0] });
  const face = (ch, color, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.9, s * 0.9),
      new THREE.MeshStandardMaterial({ map: letterTex(ch, color), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.z = s / 2 + 0.0004; return m;
  };
  /* The shelf: giraffe (grow), rabbit (eat), owl (learn), far enough apart that one fills the frame. */
  const SHELF = [0, 1.5, 3.0];
  const blocks = new THREE.Group(); blocks.position.set(SHELF[2] - 0.19, 0, 0.15); blocks.rotation.y = 0.38; scene.add(blocks);
  const bA = part(blockGeo(0.07), blockMat, blocks, 0, 0.035, 0); bA.add(face('A', '#b25a2e', 0.07));
  { const top = face('S', '#6f7f63', 0.07); top.rotation.x = -Math.PI / 2; top.position.set(0, 0.0354, 0); bA.add(top); }
  const bB = part(blockGeo(0.058), blockMat, blocks, 0.006, 0.07 + 0.029, -0.004); bB.add(face('B', '#5d7390', 0.058));
  bB.rotation.y = -0.32;
  const bShadow = contactShadowMesh(0.12, 0.12, { inner: 0.62, blur: 14, round: 0.2, opacity: 0.7 }); blocks.add(bShadow);
  const bBShadow = contactShadowMesh(0.1, 0.1, { inner: 0.6, blur: 12, round: 0.2, opacity: 0 }); blocks.add(bBShadow);

  /* ---- The top block is a rigid body ----------------------------------------
     Unit mass, gravity, impulse contacts at its eight corners against the floor
     and the top of block A, restitution and Coulomb friction, then sleep.
     Positional correction keeps every corner above the floor: nothing sinks. */
  const BH = 0.029, A_TOP = 0.07, A_HALF = 0.035, INERTIA = (2 * BH) ** 2 / 6;
  const home = { x: bB.position.clone(), q: bB.quaternion.clone() };
  const rb = { mode: 'home', x: home.x.clone(), v: new THREE.Vector3(), q: home.q.clone(), w: new THREE.Vector3(), rest: 0, ret: 0, from: null, landed: false };
  const CORNERS = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) CORNERS.push(new THREE.Vector3(a * BH, b * BH, c * BH));
  const _r = new THREE.Vector3(), _c = new THREE.Vector3(), _vc = new THREE.Vector3(), _rn = new THREE.Vector3(), _t = new THREE.Vector3(), _rt = new THREE.Vector3(), _dq = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  let onImpact = () => {};
  const A_CORNERS = [];
  for (const a of [-1, 1]) for (const c of [-1, 1]) A_CORNERS.push(new THREE.Vector3(a * A_HALF, A_TOP, c * A_HALF));
  const _l = new THREE.Vector3(), _n = new THREE.Vector3(), _qi = new THREE.Quaternion();
  // contacts as { r (from B's centre), n (pushes B out), pen }
  function contacts() {
    const out = [];
    for (const k of CORNERS) {
      _r.copy(k).applyQuaternion(rb.q); _c.copy(_r).add(rb.x);
      if (_c.y < 0) out.push({ r: _r.clone(), n: new THREE.Vector3(0, 1, 0), pen: -_c.y });
      // B's corner inside block A: leave through the nearest face of A
      const px = A_HALF - Math.abs(_c.x), pz = A_HALF - Math.abs(_c.z), py = A_TOP - _c.y;
      if (px > 0 && pz > 0 && py > 0 && _c.y > 0) {
        const m = Math.min(px, pz, py);
        const n = m === py ? new THREE.Vector3(0, 1, 0) : m === px ? new THREE.Vector3(Math.sign(_c.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(_c.z));
        out.push({ r: _r.clone(), n, pen: m });
      }
    }
    // A's top corners inside B: push B off along the face of B that the corner is under
    _qi.copy(rb.q).invert();
    for (const a of A_CORNERS) {
      _l.copy(a).sub(rb.x).applyQuaternion(_qi);
      const ex = BH - Math.abs(_l.x), ey = BH - Math.abs(_l.y), ez = BH - Math.abs(_l.z);
      if (ex > 0 && ey > 0 && ez > 0) {
        const m = Math.min(ex, ey, ez);
        _n.set(m === ex ? Math.sign(_l.x) : 0, m === ey ? Math.sign(_l.y) : 0, m === ez ? Math.sign(_l.z) : 0).applyQuaternion(rb.q).negate();
        out.push({ r: a.clone().sub(rb.x), n: _n.clone(), pen: m });
      }
    }
    return out;
  }
  function rbStep(h) {
    rb.v.y -= 9.81 * h;
    rb.v.multiplyScalar(Math.exp(-0.25 * h)); rb.w.multiplyScalar(Math.exp(-0.9 * h));
    rb.x.addScaledVector(rb.v, h);
    _dq.set(rb.w.x * h * 0.5, rb.w.y * h * 0.5, rb.w.z * h * 0.5, 0).multiply(rb.q);
    rb.q.set(rb.q.x + _dq.x, rb.q.y + _dq.y, rb.q.z + _dq.z, rb.q.w + _dq.w).normalize();
    const cs = contacts();
    if (!cs.length) return false;
    // lift out of every penetration (largest along each normal), then resolve velocities
    const fix = new THREE.Vector3();
    for (const c of cs) { const along = fix.dot(c.n); if (c.pen > along) fix.addScaledVector(c.n, c.pen - along); }
    rb.x.add(fix);
    for (const { r, n } of cs) {
      _vc.crossVectors(rb.w, r).add(rb.v);
      const vn = _vc.dot(n);
      if (vn >= 0) continue;
      if (vn < -0.35 && !rb.landed && n.y > 0.9) { rb.landed = true; onImpact(-vn); }
      _rn.crossVectors(r, n);
      const j = -(1 + (vn < -0.2 ? 0.28 : 0)) * vn / (1 + _rn.lengthSq() / INERTIA);
      rb.v.addScaledVector(n, j); rb.w.addScaledVector(_rn, j / INERTIA);
      // Coulomb friction along the contact plane
      _vc.crossVectors(rb.w, r).add(rb.v);
      _t.copy(_vc).addScaledVector(n, -_vc.dot(n));
      const vt = _t.length();
      if (vt > 1e-5) {
        _t.divideScalar(vt); _rt.crossVectors(r, _t);
        const jt = Math.min(vt / (1 + _rt.lengthSq() / INERTIA), 0.55 * j);
        rb.v.addScaledVector(_t, -jt); rb.w.addScaledVector(_rt, -jt / INERTIA);
      }
    }
    return true;
  }
  function topple() {
    rb.mode = 'sim'; rb.rest = 0; rb.landed = false;
    rb.x.copy(bB.position); rb.q.copy(bB.quaternion); rb.v.set(0, 0, 0); rb.w.set(0, 0, 0);
    // a flick at the top back edge, toward the lens
    const J = new THREE.Vector3(-0.35, 0.25, 0.95).normalize().multiplyScalar(0.46);
    const r = new THREE.Vector3(-0.3, 1, -0.4).normalize().multiplyScalar(BH * 1.3).applyQuaternion(rb.q);
    rb.v.add(J); rb.w.add(new THREE.Vector3().crossVectors(r, J).divideScalar(INERTIA));
    // it tips over its front edge as it goes: spin about (up × push direction)
    rb.w.addScaledVector(new THREE.Vector3().crossVectors(UP, J).normalize(), 9);
  }
  function restack() { rb.mode = 'return'; rb.ret = 0; rb.from = { x: bB.position.clone(), q: bB.quaternion.clone() }; }

  const kit = { part, woodMaterial, coatMaterial, plain, bead, walnut, contactShadowMesh };
  const rabbit = buildRabbit(kit); rabbit.root.position.set(SHELF[1] + 0.03, 0, 0.02); rabbit.root.rotation.y = -0.4; scene.add(rabbit.root);
  const owl = buildOwl(kit); owl.root.position.set(SHELF[2], 0, 0); owl.root.rotation.y = -0.32; scene.add(owl.root);
  const giraffe = {
    root, head, height: 0.55,
    messages: { line2: '<b>Height, weight, arm, temperature, pulse, oxygen.</b><span>All six, every visit.</span>' },
  };
  const TOYS = [giraffe, rabbit, owl];
  let cur = 0, arrivedAt = 0;

  /* ---- Camera framing -------------------------------------------------------- */
  function baseFrame(aspect) {
    if (portrait || aspect < 0.8) return { p: [0.0, 0.24, 2.37], t: [-0.02, 0.0], fov: 34, s: [0.0, 0.5] };
    if (aspect < 1.25) return { p: [0.05, 0.22, 1.55], t: [0.05, 0.0], fov: 32, s: [-0.3, 0.2] };
    return { p: [0.02, 0.2, 1.42], t: [0.02, 0.0], fov: 30, s: [-0.42, 0.24] };
  }
  // the same composition for every toy, scaled to its size
  function frameFor(aspect, i = cur) {
    const b = baseFrame(aspect), k = i === 0 ? 1 : Math.min(1, TOYS[i].height / 0.55 * 1.22);
    return { p: [SHELF[i] + b.p[0] * k, b.p[1] * k, b.p[2] * k], t: [SHELF[i] + b.t[0] * k, b.t[1]], fov: b.fov, s: b.s };
  }
  let F = frameFor(1.6);
  const cam = { from: null, k: 1, dur: 1.7 };
  const lerpFrame = (a, b, e) => ({ p: a.p.map((v, i) => lerp(v, b.p[i], e)), t: a.t.map((v, i) => lerp(v, b.t[i], e)), fov: lerp(a.fov, b.fov, e), s: a.s.map((v, i) => lerp(v, b.s[i], e)) });
  const liveFrame = () => cam.k >= 1 ? F : lerpFrame(cam.from, F, cam.k < .5 ? 4 * cam.k ** 3 : 1 - Math.pow(-2 * cam.k + 2, 3) / 2);

  /* ---- Notes (HTML, projected near the head) ------------------------------- */
  const note = document.createElement('div'); note.className = 'gnote'; annot.appendChild(note);
  let noteTimer = 0;
  const say = (html, ms = 2200) => { note.innerHTML = html; note._w = 0; note.classList.add('is-on'); noteTimer = ms / 1000; };

  /* ---- State --------------------------------------------------------------- */
  const S = {
    stretch: 1, stretchV: 0, grow: 1,         // neck scale, velocity, target
    yaw: 0, pitch: 0, roll: 0, yawV: 0, pitchV: 0, rollV: 0,
    nod: 0, blink: 0, nextBlink: 2.2, earT: [0, 0], nextEar: 4, tail: 0, tailKick: 0,
    over: false, holding: false, holdT: 0, clicks: 0, lastMove: 0, glanceUntil: 0, glanceAt: null,
    interacted: false, hintShown: false,
    startle: 0, shy: 0, wasShy: false, shake: 0, glancePt: null,
  };
  S.nextBlink = 1.5;                             // the first blink lands as it turns to find you
  const ptr = new THREE.Vector2(0, 0); let hasPtr = false;
  const ray = new THREE.Raycaster();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(), headW = new THREE.Vector3();
  const frontPlane = new THREE.Plane(), Z_AXIS = new THREE.Vector3(0, 0, 1);

  /* ---- Sizing ---------------------------------------------------------------- */
  let W = 1, H = 1;
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; F = frameFor(camera.aspect);
    const pr = renderer.getPixelRatio();
    lens.setSize(Math.round(W * pr), Math.round(H * pr));
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* ---- Interaction ------------------------------------------------------------ */
  const toNdc = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
  const hitGiraffe = (x, y, obj = root) => { ray.setFromCamera({ x, y }, camera); return ray.intersectObject(obj, true).length > 0; };
  const MESSAGES = [
    '<b>Growing well.</b>',
    '<b>Taller than yesterday.</b>',
    '<b>+2 cm since spring.</b><span>(she&rsquo;s a toy; yours will be real)</span>',
    '<b>Okay, okay. She&rsquo;s growing.</b>',
    '<b>Every centimetre counts.</b><span>That&rsquo;s the whole idea.</span>',
  ];
  const spurt = () => {
    S.stretchV += 3.2; S.tailKick = 1;
    say(MESSAGES[S.clicks % MESSAGES.length]); S.clicks++;
    S.interacted = true;
  };
  const toyHeightCm = () => { headW.setFromMatrixPosition(head.matrixWorld); return (headW.y + 0.04) * 100; };

  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (e.clientY > r.bottom || e.clientY < r.top) { hasPtr = false; return; }
    const [x, y] = toNdc(e); ptr.set(x, y); hasPtr = true; S.lastMove = performance.now() / 1000;
    if (e.pointerType === 'mouse') {
      S.over = hitGiraffe(x, y, TOYS[cur].root) || (cur === 2 && hitGiraffe(x, y, blocks));
      if (cur) TOYS[cur].over(S.over && !hitGiraffe(x, y, blocks));
      canvas.classList.toggle('is-over', S.over);
    }
  }, { passive: true });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toNdc(e);
    if (cur === 2 && (hitGiraffe(x, y, bB) || hitGiraffe(x, y, bA))) { rb.mode === 'home' ? topple() : restack(); S.glanceAt = bB; S.glanceUntil = performance.now() / 1000 + 2.2; S.interacted = true; return; }
    if (!hitGiraffe(x, y, TOYS[cur].root)) return;
    S.holding = true; S.holdT = 0; canvas.classList.add('is-holding');
    if (cur) TOYS[cur].hold(true);
    canvas.setPointerCapture?.(e.pointerId);
  });
  const release = () => {
    if (!S.holding) return;
    S.holding = false; canvas.classList.remove('is-holding');
    if (cur) {
      const toy = TOYS[cur]; toy.hold(false);
      if (S.holdT < 0.28) { toy.tap(); say(toy.messages.tap[S.clicks++ % toy.messages.tap.length]); }
      else say(toy.messages.held, 2800);
      S.interacted = true; S.grow = 1; return;
    }
    if (S.holdT < 0.28) spurt();
    else { say(`<b>${toyHeightCm().toFixed(1)} cm</b><span>Measured. Now let go of the neck.</span>`, 2600); S.interacted = true; }
    S.grow = 1; S.shake = S.holdT > 0.6 ? 1 : 0;
  };
  onImpact = (speed) => {
    S.startle = Math.min(1, speed * 1.6); S.blink = 1; S.tailKick = 1;
    S.glanceAt = bB; S.glanceUntil = performance.now() / 1000 + 2.4;
  };
  // hovering a call to action: it glances at the button and gives a small nod ("go on")
  for (const btn of stage.querySelectorAll('.btn')) {
    btn.addEventListener('pointerenter', () => {
      const r = btn.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      ray.setFromCamera({ x: ((r.left + r.width / 2 - c.left) / c.width) * 2 - 1, y: -((r.top + r.height / 2 - c.top) / c.height) * 2 + 1 }, camera);
      S.glancePt = ray.ray.at(1.2, new THREE.Vector3()); S.glanceAt = null;
      S.glanceUntil = performance.now() / 1000 + 1.4; S.nod = Math.max(S.nod, 0.45);
    });
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('contextmenu', e => { if (S.holding) e.preventDefault(); });
  canvas.addEventListener('pointercancel', release);
  growButton?.addEventListener('click', () => { if (cur) { TOYS[cur].tap(); say(TOYS[cur].messages.tap[S.clicks++ % TOYS[cur].messages.tap.length]); } else spurt(); });

  // Headline easter eggs
  const growWord = words.grow, wellWord = words.well;
  const onGrow = (on) => {
    growWord.classList.toggle('is-active', on);
    if (cur) { TOYS[cur].word(on); if (on) { say(TOYS[cur].messages.word, 1800); S.interacted = true; } return; }
    S.grow = on ? 1.3 : 1;
    if (on) { say(`<b>${(toyHeightCm() + 7).toFixed(1)} cm</b><span>and counting</span>`, 1800); S.interacted = true; }
  };
  const onWell = (on) => {
    wellWord.classList.toggle('is-active', on);
    if (!on) return;
    if (cur) TOYS[cur].nod(); else S.nod = 1;
    say(TOYS[cur].messages.line2, 2600); S.interacted = true;
  };
  for (const [el, fn] of [[growWord, onGrow], [wellWord, onWell]]) {
    if (!el) continue;
    el.addEventListener('pointerenter', () => fn(true));
    el.addEventListener('pointerleave', () => fn(false));
    el.addEventListener('click', () => { fn(true); setTimeout(() => fn(false), 1600); });
  }

  /* ---- Frame -------------------------------------------------------------------- */
  const spring = (x, v, target, w, z, dt) => { const a = w * w * (target - x) - 2 * z * w * v; v += a * dt; return [x + v * dt, v]; };
  const project = (v) => { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H]; };
  let t0 = performance.now(), last = t0, shadowTick = 0;

  function frame(now, forcedT) {
    const dt = forcedT != null ? 1 / 60 : Math.min(0.05, (now - last) / 1000); last = now;
    const t = forcedT ?? (now - t0) / 1000;
    const hp = clamp(SR.homeProgress || 0);
    const wall = performance.now() / 1000;          // real clock, for pointer idleness and glances

    /* camera: fixed framing, a slow float, and a little rise as the page scrolls */
    const fl = reduced ? 0 : 1;
    if (cam.k < 1) cam.k = Math.min(1, cam.k + dt / (reduced ? 0.01 : cam.dur));
    const LF = liveFrame();
    camera.position.set(LF.p[0] + Math.sin(t * 0.21) * 0.004 * fl, LF.p[1] + Math.sin(t * 0.17 + 1.3) * 0.003 * fl + hp * 0.05, LF.p[2]);
    camera.lookAt(LF.t[0], camera.position.y, LF.t[1]);
    camera.fov = LF.fov; camera.updateProjectionMatrix();
    // the lens rises with a growing neck, so the head stays in frame (read from last frame's stretch)
    applyShift(camera, LF.s[0], LF.s[1] - hp * 0.12 + (S.stretch - 1) * (portrait ? 0.6 : 0.95) * (cur === 0 ? 1 : 0));
    scene.updateMatrixWorld();

    /* where to look: pointer (projected in front of the toy), a glance, or the lens */
    let target;
    const since = t - arrivedAt;
    if (!reduced && since < 1.5 && since > -2 && !hasPtr) target = cur === 0 ? tmp2.set(-0.26, 0.02, 0.32) : cur === 1 ? rabbit.prop.getWorldPosition(tmp2) : bA.getWorldPosition(tmp2);   // on arrival: busy with its things, then it notices you
    else if (S.glanceAt && wall < S.glanceUntil) target = S.glanceAt.getWorldPosition(tmp2);
    else if (S.glancePt && wall < S.glanceUntil) target = tmp2.copy(S.glancePt);
    else if (hasPtr && !mobile && wall - S.lastMove < 6) {
      ray.setFromCamera(ptr, camera);
      // the smaller toys stand nearer the lens: a point 1.25 m out would sit behind their heads,
      // so they follow the cursor where it crosses a plane just in front of their faces
      const hit = cur !== 0 && ray.ray.intersectPlane(frontPlane.set(Z_AXIS, -(TOYS[cur].root.getWorldPosition(tmp3).z + 0.4)), tmp2);
      target = hit || ray.ray.at(1.25, tmp2);
    } else if (!reduced && wall - S.lastMove > 7 && Math.sin(t * 0.35) > 0.6) target = tmp2.set(SHELF[cur] - 0.9, 0.35, 0.4);  // idle: peeks at the headline
    else target = tmp2.copy(camera.position);
    if (hp > 0.05) target = tmp2.set(SHELF[cur] - 0.2, -0.4, 1.2);                   // scrolling: looks down, toward what's next
    const toyTarget = target.clone();
    if (cur !== 0) target = tmp2.copy(camera.position);                              // the giraffe rests while another toy has the stage
    const local = root.worldToLocal(target.clone());
    headW.setFromMatrixPosition(headPivot.matrixWorld); const hl = root.worldToLocal(headW.clone());
    const d = local.sub(hl);
    let yawT = clamp(Math.atan2(-d.z, d.x), -1.25, 1.25);
    // don't turn all the way around: past the shoulder, turn back toward the lens
    if (Math.abs(Math.atan2(-d.z, d.x)) > 2.2) yawT = Math.sign(yawT) * 0.9;
    const pitchT = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.55, 0.45);
    const k = reduced ? 1 : 0;
    [S.yaw, S.yawV] = spring(S.yaw, S.yawV, yawT, 7, 0.75, dt);
    [S.pitch, S.pitchV] = spring(S.pitch, S.pitchV, pitchT, 7, 0.75, dt);
    [S.roll, S.rollV] = spring(S.roll, S.rollV, S.over || S.holding ? 0.16 : 0, 6, 0.5, dt);

    /* shy: when the cursor comes right up to its face it leans back and blinks */
    headW.setFromMatrixPosition(head.matrixWorld);
    let shy = false;
    if (hasPtr && !mobile && !S.holding) { ray.setFromCamera(ptr, camera); shy = ray.ray.distanceToPoint(headW) < 0.045; }
    if (shy && !S.wasShy) S.blink = 1;
    S.wasShy = shy;
    S.shy += ((shy ? 1 : 0) - S.shy) * (1 - Math.exp(-dt * 6));
    S.startle = Math.max(0, S.startle - dt * 1.4);
    S.shake = Math.max(0, S.shake - dt * 1.1);
    if (k) { S.yaw = yawT; S.pitch = pitchT; }

    /* neck: a bouncy spring toward its target length; holding keeps it growing */
    if (S.holding) { S.holdT += dt; S.grow = Math.min(1.75, 1 + S.holdT * 0.38); }
    const growT = S.grow;
    [S.stretch, S.stretchV] = spring(S.stretch, S.stretchV, growT, S.holding ? 5 : 9, S.holding ? 0.9 : 0.32, dt);
    if (reduced) S.stretch = growT;
    neckStretch.scale.set(1 - (S.stretch - 1) * 0.12, S.stretch, 1 - (S.stretch - 1) * 0.12);
    headPivot.position.set(0, NECK * S.stretch - 0.004, 0);

    /* nod (the "how well" egg) */
    S.nod = Math.max(0, S.nod - dt * 0.8);
    const nod = Math.sin((1 - S.nod) * TAU * 2) * 0.22 * S.nod;

    /* breathing, lean, blink, ears, tail */
    const br = reduced ? 0 : Math.sin(t * 1.7);
    body.scale.y = 1.08 * (1 + br * 0.006);
    const sway = reduced ? 0 : Math.sin(t * 0.55) * 0.012;                       // weight shifting, feet planted
    const startle = Math.sin(Math.min(1, (1 - S.startle) * 3) * Math.PI) * S.startle;
    bodyG.rotation.x = sway;
    neckPivot.rotation.x = sway * 1.4;
    neckPivot.rotation.z = -0.4 + br * 0.01 - hp * 0.2 + (S.stretch - 1) * 0.25 + S.shy * 0.14 + startle * 0.1;
    neckPivot.rotation.y = S.yaw * 0.28;
    const shake = Math.sin(t * 26) * 0.2 * S.shake * S.shake;
    headPivot.rotation.set(S.roll + shake, S.yaw * 0.72, 0.4 - (S.stretch - 1) * 0.25 + S.pitch + nod + hp * -0.1 + startle * 0.18 - S.shy * 0.1);

    if (!reduced && t > S.nextBlink) { S.blink = 1; S.nextBlink = t + 2.4 + Math.random() * 3.6 + (Math.random() < 0.2 ? -2.2 : 0); }
    S.blink = Math.max(0, S.blink - dt * 7);                       // ~140 ms, shut at the midpoint
    for (const e of eyes) e.scale.y = 1 - 0.88 * Math.sin(S.blink * Math.PI);

    if (!reduced && t > S.nextEar) { S.earT[Math.random() < 0.5 ? 0 : 1] = 1; S.nextEar = t + 3.5 + Math.random() * 5; }
    ears.forEach((p, i) => {
      S.earT[i] = Math.max(0, S.earT[i] - dt * 4);
      const flick = Math.sin(S.earT[i] * Math.PI) * 0.6;
      const perk = (S.over || S.holding ? -0.25 : 0) - S.startle * 0.4 + S.shy * 0.35;
      p.rotation.x = p.userData.side * (0.35 + flick + perk);
    });

    S.tailKick = Math.max(0, S.tailKick - dt * 1.2);
    tailPivot.rotation.x = reduced ? 0 : Math.sin(t * 2.1) * 0.12 + Math.sin(t * 9) * 0.35 * S.tailKick;
    tailPivot.rotation.z = -0.35 + Math.sin(t * 1.3) * 0.05;

    /* block: simulated while loose, flown home on a gentle arc when restacked */
    if (rb.mode === 'sim') {
      const n = 8, h = dt / n; let touching = false;
      for (let i = 0; i < n; i++) touching = rbStep(h) || touching;
      rb.rest = touching && rb.v.length() < 0.05 && rb.w.length() < 0.6 ? rb.rest + dt : 0;
      if (rb.rest > 0.5) { rb.mode = 'rest'; rb.v.set(0, 0, 0); rb.w.set(0, 0, 0); }
      bB.position.copy(rb.x); bB.quaternion.copy(rb.q);
    } else if (rb.mode === 'return') {
      rb.ret = Math.min(1, rb.ret + dt / (reduced ? 0.01 : 0.75));
      const e = rb.ret < .5 ? 4 * rb.ret ** 3 : 1 - Math.pow(-2 * rb.ret + 2, 3) / 2;
      bB.position.lerpVectors(rb.from.x, home.x, e); bB.position.y += Math.sin(e * Math.PI) * 0.06;
      bB.quaternion.slerpQuaternions(rb.from.q, home.q, e);
      if (rb.ret >= 1) rb.mode = 'home';
    }
    {
      const lift = bB.position.y - BH;                       // height of the block's centre above resting
      bBShadow.position.set(bB.position.x, 0.001, bB.position.z);
      bBShadow.material.opacity = rb.mode === 'home' ? 0 : 0.75 * (1 - smooth(0.0, 0.1, lift));
    }

    /* the other toys: only the ones on camera exist this frame (the shadow pass would draw the rest) */
    const onCam = (i) => i === cur || (cam.k < 1 && Math.abs(SHELF[i] - lerp(cam.from.t[0], F.t[0], cam.k)) < 1.2);
    root.visible = onCam(0); rabbit.root.visible = onCam(1); owl.root.visible = blocks.visible = onCam(2);
    if (rabbit.root.visible) rabbit.update({ t, dt, reduced, active: cur === 1, target: cur === 1 ? toyTarget : camera.position });
    if (owl.root.visible) owl.update({ t, dt, reduced, target: cur === 2 ? toyTarget : camera.position });

    /* the window light travels with the camera along the shelf */
    if (!reduced) key.drift(t);
    key.position.x += LF.t[0]; key.target.position.x = 0.35 + LF.t[0]; key.target.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = (shadowTick = (shadowTick + 1) % 2) === 0 || forcedT != null;
    lens.render(scene, camera, t);

    /* note + hint follow the head */
    headW.setFromMatrixPosition(TOYS[cur].head.matrixWorld);
    tmp2.copy(headW).add(tmp.set(0, 0.015, 0));
    const [nx, ny] = project(tmp2);
    const fit = (x, w) => clamp(x, 12, W - w - 12);
    const nw = note._w ||= note.offsetWidth, flip = nx + 26 + nw > W - 12;
    note.style.transform = `translate3d(${fit(flip ? nx - nw - 26 : nx + 26, nw).toFixed(1)}px, ${(ny - 20).toFixed(1)}px, 0)`;
    if (noteTimer > 0) { noteTimer -= dt; if (noteTimer <= 0) note.classList.remove('is-on'); }
    if (hint) {
      const hw = hint._w ||= hint.offsetWidth, hflip = nx + 64 + hw > W - 12;
      hint.style.transform = `translate3d(${fit(hflip ? nx - hw - 64 : nx + 64, hw).toFixed(1)}px, ${(ny + 8).toFixed(1)}px, 0)`;
      const showHint = !S.interacted && t > 5.5 && hp < 0.05 && noteTimer <= 0;
      if (showHint !== S.hintShown) { hint.classList.toggle('is-on', showHint); S.hintShown = showHint; }
    }
  }

  /* ---- Run ---------------------------------------------------------------------- */
  if (still) {
    frame(performance.now(), Number(still));
    canvas.style.transition = 'none'; canvas.classList.add('is-ready');
    // still mode only: lets an offline render drop the toys and keep the empty room
    window.SR.giraffeToys = (on) => scene.traverse(o => { if (o.isMesh && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius < 1.5) o.visible = on; });
    window.SR.giraffeStill = (t, opts = {}) => { Object.assign(S, opts); if (opts.ptr) { ptr.set(...opts.ptr); hasPtr = true; S.lastMove = performance.now() / 1000; } for (let i = 0; i < 90; i++) frame(performance.now(), t - (90 - i) / 60); frame(performance.now(), t); };
    return;
  }
  const setToy = (i) => {
    if (i === cur) return;
    cam.from = liveFrame(); cam.k = 0;
    cur = i; F = frameFor(camera.aspect); arrivedAt = (performance.now() - t0) / 1000 + cam.dur * 0.6;
    S.grow = 1; S.holding = false; S.glanceAt = null; S.glancePt = null; hint?.classList.remove('is-on'); S.hintShown = false;
    note.classList.remove('is-on'); noteTimer = 0;
  };
  window.SR.toys = { setToy, get current() { return cur; } };
  onToy?.(setToy);
  const runner = createLoop({ renderer, stage, frame: now => frame(now), onResize: resize, eases: true });
  // every toy is compiled now (not when the shelf first slides to it), then the hero appears
  VORONOI_READY.then(() => warmUp(renderer, scene, camera, () => frame(performance.now(), 0), lens)).then(() => {
    requestAnimationFrame(() => {
      canvas.classList.add('is-ready'); t0 = last = performance.now(); runner.start();
      window.dispatchEvent(new Event('sr:hero-ready'));
    });
  });
  if (params.has('diag')) setTimeout(() => console.log('[giraffe] frames', runner.frames), 6000);
  // test hooks: where things are on screen, and the block's state
  const scr = (o) => { const [x, y] = project(o.getWorldPosition(new THREE.Vector3())); const r = canvas.getBoundingClientRect(); return [x + r.left, y + r.top]; };
  const toyBody = () => { const r = TOYS[cur].root; const v = r.localToWorld(new THREE.Vector3(0, TOYS[cur].height * (cur ? 0.32 : 0.4), 0)); const [x, y] = project(v); const c = canvas.getBoundingClientRect(); return [x + c.left, y + c.top]; };
  window.SR.giraffeProbe = () => ({ cur, toyHead: scr(TOYS[cur].head), toyBody: toyBody(), carrot: rabbit.carrotLeft, head: scr(head), body: scr(bodyG), blockB: scr(bB), blockA: scr(bA), mode: rb.mode, minCornerY: Math.min(...CORNERS.map(k => k.clone().applyQuaternion(bB.quaternion).add(bB.position).y)), stretch: S.stretch });
}
