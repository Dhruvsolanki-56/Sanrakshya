/* ==========================================================================
   Sanrakshya station — the product reveal.

   The station arrives in pieces and assembles as the reader scrolls, while the
   morning light comes up on the wall. Then the camera walks around it and each
   of the six signs is traced to the part that takes it. Then the infant tray
   descends and clicks onto the platform: babies who can't stand yet are weighed
   lying down and measured along a sliding footboard. Last, the growth marks rise
   up the mast, the doorframe made precise, and the whole object is shown whole.

   Hardware is a design concept: placement of components is illustrative.
   Units are metres. The camera never pitches: framing uses lens shift.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/addons/RoundedBoxGeometry.js';
import {
  clamp, lerp, smooth, canvasTex, contactShadowMesh, makeRenderer, studioEnvironment,
  cyclorama, windowLight, createLens, applyShift, createLoop, microRoughness, warmUp, uberPhysical,
} from './studio.js';

const TAU = Math.PI * 2;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = t => { const c = 1.35; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // settles with a small overshoot

const MAST = { x: 0, z: -0.13, r: 0.017, y0: 0.058, y1: 1.52 };
const cmToY = cm => MAST.y0 + cm / 100;
const MARKS = [75.5, 87.0, 95.6, 102.6, 108.1];                 // illustrative
const TRAY = { L: 0.62, W: 0.3, H: 0.055, z: 0.045, baby: 55.1 };

/* ---- Etched scales -------------------------------------------------------- */
function mastScale(hi) {
  const W = hi ? 512 : 256, H = hi ? 4096 : 2048;
  const len = MAST.y1 - MAST.y0, circ = TAU * MAST.r;
  const pxV = H / (len * 1000), pxU = W / (circ * 1000);
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`; g.fillRect(i, 0, 1, H); }
    const u0 = W * 0.5;
    g.fillStyle = '#34322f';
    for (let mm = 0; mm <= 1400; mm += 10) {
      const y = H - (mm * pxV), cm = mm / 10;
      const L = cm % 10 === 0 ? 7.5 : cm % 5 === 0 ? 5 : 3;
      g.fillRect(u0 - 3.2 * pxU, y - 0.35 * pxV, L * pxU, Math.max(1, 0.35 * pxV));
      if (cm % 10 === 0 && cm > 0) {
        g.save(); g.translate(u0 + 5.4 * pxU, y); g.scale(pxU / pxV, 1);
        g.font = `500 ${4.2 * pxV}px "Geist Mono", ui-monospace, monospace`; g.textBaseline = 'middle';
        g.fillText(String(cm), 0, 0); g.restore();
      }
    }
  });
}
function railScale(len) {          // the tray's length rail, 0–60 cm
  return canvasTex(2048, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    const px = w / (len * 1000);
    g.fillStyle = '#34322f';
    for (let mm = 0; mm <= len * 1000; mm += 10) {
      const cm = mm / 10, L = cm % 10 === 0 ? 0.62 : cm % 5 === 0 ? 0.42 : 0.26;
      g.fillRect(mm * px, 0, Math.max(1.5, 0.4 * px), h * L);
      if (cm % 10 === 0 && cm > 0) { g.font = `500 ${h * 0.34}px "Geist Mono", monospace`; g.fillText(String(cm), mm * px + 4, h * 0.92); }
    }
  });
}
function engraving() {
  return canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = '500 30px "Geist", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.letterSpacing = '9px'; g.fillText('SANRAKSHYA', w / 2, h / 2 + 1);
  }, { srgb: false });
}

/* ==========================================================================
   Scene
   ========================================================================== */
export function initStation({ stage, canvas, annot }) {
  const SR = window.SR || {};
  const params = new URLSearchParams(location.search);
  const still = params.get('still');
  const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  const reduced = !!SR.reduced;
  const hi = !mobile;

  const renderer = makeRenderer(canvas, { hi, still });
  const scene = new THREE.Scene();
  studioEnvironment(renderer, scene, 0.5);
  scene.add(cyclorama());
  const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 30);

  /* ---- Materials ------------------------------------------------------------ */
  const P = uberPhysical;                                   // one shader for every physical part
  const graphite = P({
    color: 0x1b1c1e, roughness: 1, roughnessMap: microRoughness(0.6, 0.06),
    clearcoat: 0.22, clearcoatRoughness: 0.5, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x3a3a3c),
  });
  const aluminium = P({ color: 0xcfcfcd, metalness: 1, roughness: 0.33, anisotropy: 0.65, anisotropyRotation: Math.PI / 2 });
  const satin = P({ color: 0x5d5c5a, metalness: 1, roughness: 0.5 });
  const mastMat = P({ color: 0xcfcfcd, metalness: 1, roughness: 0.33, anisotropy: 0.65, anisotropyRotation: Math.PI / 2, map: mastScale(hi) });
  const railMat = P({ color: 0xcfcfcd, metalness: 1, roughness: 0.33, anisotropy: 0.65, map: railScale(0.6) });
  const glass = P({ color: 0x0b0c0d, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, ior: 1.52 });
  const gasket = P({ color: 0x0e0e0f, roughness: 0.85 });
  const band = P({ color: 0x6f6b66, roughness: 0.92, sheen: 1, sheenColor: new THREE.Color(0xb9b3aa), sheenRoughness: 0.6 });
  // the tray: warm white medical polymer, a quilted sage cushion
  const polymer = P({ color: 0xeeebe4, roughness: 0.46, roughnessMap: microRoughness(0.5, 0.05), clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: new THREE.Color(0xffffff) });
  const cushion = P({ color: 0xc9d3c3, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xf3f6ef), sheenRoughness: 0.55 });
  const signal = new THREE.Color(0xff5a26).multiplyScalar(1.3);
  const warm = new THREE.Color(0xfff3e4).multiplyScalar(1.1);

  /* ---- The device, in parts ------------------------------------------------- */
  const DEVICE_YAW = -0.64;
  const pivot = new THREE.Group(); pivot.position.set(MAST.x, 0, MAST.z); pivot.rotation.y = DEVICE_YAW; scene.add(pivot);
  const device = new THREE.Group(); device.position.set(-MAST.x, 0, -MAST.z); pivot.add(device);
  const group = () => { const g = new THREE.Group(); device.add(g); return g; };
  const add = (g, geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };

  // platform (the scale)
  const platform = group();
  add(platform, new RoundedBoxGeometry(0.42, 0.05, 0.34, 5, 0.016), graphite, 0, 0.029, 0);
  add(platform, new RoundedBoxGeometry(0.414, 0.005, 0.334, 3, 0.0024), satin, 0, 0.0036, 0);
  add(platform, new RoundedBoxGeometry(0.39, 0.006, 0.305, 3, 0.012), glass, 0, 0.0545, 0.004);
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.01), new THREE.MeshStandardMaterial({ color: 0x5a5a5c, roughness: 0.5, metalness: 0.2, alphaMap: engraving(), transparent: true, depthWrite: false })); m.position.set(0, 0.03, 0.1702); platform.add(m); }
  const shadows = [contactShadowMesh(0.62, 0.54, { inner: 0.7, blur: 26, opacity: 0.85 }), contactShadowMesh(0.5, 0.42, { inner: 0.84, blur: 6, opacity: 0.9 })];
  shadows.forEach(s => device.add(s));

  // mast
  const mastG = group();
  add(mastG, new THREE.CylinderGeometry(0.03, 0.032, 0.03, 64), satin, MAST.x, 0.072, MAST.z);
  add(mastG, new THREE.CylinderGeometry(0.0305, 0.0305, 0.003, 64), gasket, MAST.x, 0.0585, MAST.z);
  const mastLen = MAST.y1 - MAST.y0;
  add(mastG, new THREE.CylinderGeometry(MAST.r, MAST.r, mastLen, 96), mastMat, MAST.x, MAST.y0 + mastLen / 2, MAST.z).rotation.y = -0.13 - Math.PI - DEVICE_YAW;
  add(mastG, new THREE.CylinderGeometry(MAST.r * 0.94, MAST.r, 0.01, 64), aluminium, MAST.x, MAST.y1 + 0.005, MAST.z);
  add(mastG, new THREE.SphereGeometry(MAST.r * 0.94, 48, 12, 0, TAU, 0, Math.PI / 2), aluminium, MAST.x, MAST.y1 + 0.01, MAST.z).scale.y = 0.25;

  // MUAC module (arm circumference)
  const muac = group(); const MY = 0.64;
  add(muac, new RoundedBoxGeometry(0.046, 0.074, 0.05, 4, 0.012), graphite, MAST.x - 0.036, MY, MAST.z + 0.004).rotation.y = 0.1;
  add(muac, new THREE.CylinderGeometry(MAST.r + 0.004, MAST.r + 0.004, 0.08, 48), graphite, MAST.x, MY, MAST.z);
  add(muac, new RoundedBoxGeometry(0.003, 0.05, 0.024, 2, 0.0012), gasket, MAST.x - 0.0595, MY, MAST.z + 0.006, false).rotation.y = 0.1;
  add(muac, new RoundedBoxGeometry(0.0024, 0.03, 0.017, 2, 0.001), band, MAST.x - 0.0605, MY - 0.046, MAST.z + 0.006).rotation.y = 0.1;

  // sensor module (temperature, pulse, oxygen): a puck with a glass finger cradle
  const sensorG = group(); const SY = 0.93;
  add(sensorG, new THREE.CylinderGeometry(MAST.r + 0.004, MAST.r + 0.004, 0.06, 48), graphite, MAST.x, SY, MAST.z);
  add(sensorG, new RoundedBoxGeometry(0.066, 0.046, 0.054, 5, 0.016), graphite, MAST.x + 0.046, SY, MAST.z + 0.012);
  add(sensorG, new RoundedBoxGeometry(0.036, 0.008, 0.03, 3, 0.0035), glass, MAST.x + 0.052, SY + 0.024, MAST.z + 0.014);
  const puckLed = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 24), new THREE.MeshBasicMaterial({ color: signal, transparent: true, opacity: 0 }));
  puckLed.position.set(MAST.x + 0.046, SY + 0.004, MAST.z + 0.0395); sensorG.add(puckLed);

  // head unit (height)
  const carriage = group();
  const cAdd = (geo, mat, x, y, z) => add(carriage, geo, mat, x, y, z);
  cAdd(new THREE.CylinderGeometry(0.027, 0.027, 0.066, 64), aluminium, 0, 0.033, 0);
  cAdd(new THREE.CylinderGeometry(0.0274, 0.0274, 0.003, 64), gasket, 0, 0.0035, 0);
  cAdd(new THREE.CylinderGeometry(0.0274, 0.0274, 0.003, 64), gasket, 0, 0.0625, 0);
  cAdd(new RoundedBoxGeometry(0.072, 0.03, 0.26, 5, 0.013), graphite, 0, 0.018, 0.128);
  cAdd(new RoundedBoxGeometry(0.036, 0.004, 0.052, 2, 0.0016), glass, 0, 0.0028, 0.19);
  const slitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2e6), transparent: true, opacity: 0 });
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.0035, 0.07), slitMat); slit.rotation.x = -Math.PI / 2; slit.position.set(0, 0.0332, 0.14); carriage.add(slit);
  const CARRIAGE_Y = cmToY(118);

  // the infant tray: shallow bassinet, fixed headboard, sliding footboard on a length rail
  const tray = group(); tray.visible = false;
  const trayBody = new THREE.Group(); tray.add(trayBody);
  const { L: TL, W: TW, H: TH } = TRAY;
  const tAdd = (geo, mat, x, y, z) => add(trayBody, geo, mat, x, y, z);
  tAdd(new RoundedBoxGeometry(TL, 0.014, TW, 5, 0.007), polymer, 0, 0.007, 0);
  for (const s of [-1, 1]) tAdd(new RoundedBoxGeometry(TL, TH, 0.016, 5, 0.0075), polymer, 0, TH / 2, s * (TW / 2 - 0.008));
  tAdd(new RoundedBoxGeometry(0.018, TH + 0.034, TW, 5, 0.0085), polymer, -(TL / 2 - 0.009), (TH + 0.034) / 2, 0);   // headboard
  tAdd(new RoundedBoxGeometry(0.016, TH, TW, 5, 0.0075), polymer, TL / 2 - 0.008, TH / 2, 0);
  // quilted cushion: three soft pads
  for (let i = 0; i < 3; i++) tAdd(new RoundedBoxGeometry((TL - 0.05) / 3 - 0.004, 0.024, TW - 0.04, 6, 0.011), cushion, -(TL - 0.05) / 3 + i * (TL - 0.05) / 3, 0.026, 0);
  const rail = tAdd(new RoundedBoxGeometry(TL - 0.06, 0.004, 0.012, 2, 0.0018), railMat, 0.004, TH + 0.002, TW / 2 - 0.008);
  const lineMat = new THREE.MeshBasicMaterial({ color: signal, transparent: true, opacity: 0 });
  const lengthLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.0012, 0.0012), lineMat); trayBody.add(lengthLine);
  const HEAD_X = -(TL / 2 - 0.018);
  lengthLine.position.set(HEAD_X, TH + 0.0055, TW / 2 - 0.008);
  const slider = new THREE.Group(); trayBody.add(slider);
  add(slider, new RoundedBoxGeometry(0.012, 0.058, TW - 0.05, 3, 0.005), graphite, 0, 0.012 + 0.029 + 0.012, 0);
  add(slider, new RoundedBoxGeometry(0.02, 0.01, 0.02, 2, 0.003), aluminium, 0, TH + 0.004, TW / 2 - 0.008);
  const clickMat = new THREE.MeshBasicMaterial({ color: warm, transparent: true, opacity: 0, depthWrite: false });
  const click = new THREE.Mesh(new THREE.BoxGeometry(TL + 0.01, 0.0015, TW + 0.01), clickMat); click.position.y = 0.0005; tray.add(click);
  tray.position.set(0, 0.058, TRAY.z);

  // growth marks for the finale
  const marks = MARKS.map((cm, i) => {
    const y = cmToY(cm), now = i === MARKS.length - 1;
    const ringMat = new THREE.MeshBasicMaterial({ color: now ? signal : warm, transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(MAST.r + 0.0003, 0.0007, 8, 128), ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(MAST.x, y, MAST.z); device.add(ring);
    const haloMat = new THREE.MeshBasicMaterial({ color: now ? signal : warm, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(MAST.r + 0.0008, 0.0024, 8, 128), haloMat); halo.rotation.x = Math.PI / 2; halo.position.copy(ring.position); device.add(halo);
    return { ringMat, haloMat, i };
  });

  /* ---- Assembly: where each part starts, and when it docks ------------------- */
  const PARTS = [
    { g: mastG, from: [0.0, 0.42, 0.0], rot: [0, 0, 0.09], at: [0.02, 0.13] },
    { g: carriage, from: [0.0, 0.52, 0.12], rot: [0, 0.9, 0], at: [0.08, 0.2], base: [MAST.x, CARRIAGE_Y, MAST.z] },
    { g: muac, from: [-0.42, 0.06, 0.1], rot: [0, -0.8, 0.2], at: [0.12, 0.22] },
    { g: sensorG, from: [0.42, 0.1, 0.06], rot: [0, 0.8, -0.2], at: [0.15, 0.25] },
  ];
  const docked = PARTS.map(() => false);
  const flashes = PARTS.map(() => 0);

  /* ---- Light and lens ---------------------------------------------------------- */
  const key = windowLight(scene, { hi });
  const KEY_I = key.intensity;
  const lens = createLens(renderer, hi && params.get('post') !== '0');

  /* ---- Callouts ---------------------------------------------------------------- */
  const mk = (cls, html) => { const el = document.createElement('div'); el.className = 'annot ' + cls; el.innerHTML = html; annot.appendChild(el); return el; };
  const at = (obj, x, y, z) => () => obj.localToWorld(new THREE.Vector3(x, y, z));
  const CALLS = [
    { el: mk('annot--call', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Height</b><span>head unit, from above</span></span>'), p: at(carriage, 0, 0, 0.2), r: [0.3, 0.55], side: 1 },
    { el: mk('annot--call', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Temperature &middot; pulse &middot; oxygen</b><span>fingertip sensor</span></span>'), p: at(sensorG, MAST.x + 0.052, SY + 0.028, MAST.z + 0.014), r: [0.34, 0.55], side: 1 },
    { el: mk('annot--call', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Arm circumference</b><span>MUAC tape, drawn from the side</span></span>'), p: at(muac, MAST.x - 0.06, MY, MAST.z + 0.01), r: [0.38, 0.55], side: -1 },
    { el: mk('annot--call', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Weight</b><span>the platform is the scale</span></span>'), p: at(platform, 0.19, 0.056, 0.15), r: [0.42, 0.55], side: 1 },
    { el: mk('annot--call annot--now', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Length 55.1 cm</b><span>lying down, along the rail</span></span>'), p: at(slider, 0, TRAY.H + 0.012, TRAY.W / 2 - 0.008), r: [0.72, 0.86], side: 1 },
    { el: mk('annot--call', '<i class="annot__dot"></i><i class="annot__lead"></i><span class="annot__t"><b>Weight 4.9 kg</b><span>the tray tares itself</span></span>'), p: at(trayBody, -0.12, TRAY.H, TRAY.W / 2), r: [0.745, 0.86], side: -1 },
  ];
  const note = mk('annot--pct', 'Design concept &middot; component placement illustrative');

  /* ---- Camera path --------------------------------------------------------------- */
  function keys(aspect) {
    if (aspect < 0.8) return [
      { at: 0.0, p: [-0.3, 0.86, 5.4], t: [0.05, -0.1], fov: 36, s: [0.0, 0.3] },
      { at: 0.28, p: [-0.7, 0.86, 4.6], t: [0.05, -0.1], fov: 36, s: [0.0, 0.3] },
      { at: 0.5, p: [0.75, 0.9, 4.4], t: [0.0, -0.13], fov: 36, s: [0.0, 0.3] },
      { at: 0.62, p: [-0.3, 0.5, 2.1], t: [0.06, 0.0], fov: 38, s: [0.0, 0.2] },
      { at: 0.84, p: [-0.3, 0.5, 2.1], t: [0.06, 0.0], fov: 38, s: [0.0, 0.2] },
      { at: 0.93, p: [-0.7, 0.86, 5.1], t: [0.05, -0.1], fov: 36, s: [0.0, 0.3] },
      { at: 1.0, p: [-0.7, 0.86, 5.1], t: [0.05, -0.1], fov: 36, s: [0.0, 0.3] },
    ];
    return [
      { at: 0.0, p: [-0.35, 0.86, 4.5], t: [0.08, -0.1], fov: 28, s: [-0.34, 0.02] },
      { at: 0.28, p: [-1.0, 0.86, 3.55], t: [0.06, -0.1], fov: 27, s: [-0.36, 0.02] },
      { at: 0.5, p: [0.95, 0.92, 3.3], t: [0.0, -0.13], fov: 27, s: [-0.32, 0.02] },
      { at: 0.62, p: [-0.5, 0.5, 1.62], t: [0.07, 0.02], fov: 30, s: [-0.26, -0.32] },
      { at: 0.84, p: [-0.5, 0.5, 1.62], t: [0.07, 0.02], fov: 30, s: [-0.26, -0.32] },
      { at: 0.93, p: [-1.1, 0.86, 3.75], t: [0.06, -0.1], fov: 27, s: [-0.36, 0.0] },
      { at: 1.0, p: [-1.1, 0.86, 3.75], t: [0.06, -0.1], fov: 27, s: [-0.36, 0.0] },
    ];
  }
  let K = keys(1.6);
  const cs = { p: new THREE.Vector3(), t: new THREE.Vector2(), fov: 27, s: new THREE.Vector2() };
  function sampleCam(p) {
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) if (p >= K[i].at && p <= K[i + 1].at) { a = K[i]; b = K[i + 1]; break; }
    if (p >= K[K.length - 1].at) a = b;
    const t = a === b ? 0 : ease(clamp((p - a.at) / (b.at - a.at)));
    cs.p.set(lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t));
    cs.t.set(lerp(a.t[0], b.t[0], t), lerp(a.t[1], b.t[1], t));
    cs.fov = lerp(a.fov, b.fov, t); cs.s.set(lerp(a.s[0], b.s[0], t), lerp(a.s[1], b.s[1], t));
  }

  let W = 1, H2 = 1;
  function resize() {
    W = stage.clientWidth; H2 = stage.clientHeight;
    renderer.setSize(W, H2, false); camera.aspect = W / H2; K = keys(camera.aspect);
    const pr = renderer.getPixelRatio(); lens.setSize(Math.round(W * pr), Math.round(H2 * pr));
  }
  resize(); new ResizeObserver(resize).observe(stage);

  const ptr = { x: 0, sx: 0 };
  if (!reduced && matchMedia('(hover: hover)').matches) addEventListener('pointermove', e => { ptr.x = e.clientX / innerWidth * 2 - 1; }, { passive: true });

  /* ---- Frame ---------------------------------------------------------------------- */
  const v3 = new THREE.Vector3();
  const toScreen = (v) => { v3.copy(v).project(camera); return [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H2]; };
  const place = (el, x, y, o) => {
    if (o <= 0.001) { if (el._o !== 0) { el.style.opacity = 0; el._o = 0; } return; }
    el.style.opacity = o.toFixed(3); el._o = o; el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  };
  let pd = 0, last = performance.now(), t0 = last, lastPd = -1, shadowTick = 0;

  function frame(now, forcedT, forcedP) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = forcedT ?? (now - t0) / 1000;
    let target = forcedP ?? (SR.stationProgress || 0);
    if (reduced && forcedP == null) target = target < 0.2 ? 0.3 : target < 0.56 ? 0.45 : target < 0.88 ? 0.8 : 1;
    pd = forcedP != null || reduced ? target : pd + (target - pd) * (1 - Math.exp(-dt * 5));

    /* assembly: parts float apart at the start and dock one after another */
    PARTS.forEach((P, i) => {
      const k = smooth(P.at[0], P.at[1], pd), e = back(k);
      const drift = (1 - k) * (reduced ? 0 : 1);
      const bx = P.base ? P.base[0] : 0, by = P.base ? P.base[1] : 0, bz = P.base ? P.base[2] : 0;
      P.g.position.set(bx + P.from[0] * (1 - e), by + P.from[1] * (1 - e) + Math.sin(t * 0.9 + i) * 0.006 * drift, bz + P.from[2] * (1 - e));
      P.g.rotation.set(P.rot[0] * (1 - e), P.rot[1] * (1 - e) + Math.sin(t * 0.5 + i) * 0.04 * drift, P.rot[2] * (1 - e));
      if (k >= 1 && !docked[i]) { docked[i] = true; flashes[i] = 1; }
      if (k < 0.98) docked[i] = false;
      flashes[i] = Math.max(0, flashes[i] - dt * 2.2);
    });
    shadows.forEach(s => { s.material.opacity = 0.85; });
    slitMat.opacity = flashes[1] * 0.9 + smooth(0.2, 0.3, pd) * 0.18;
    puckLed.material.opacity = flashes[3] + smooth(0.3, 0.4, pd) * (0.4 + 0.3 * Math.sin(t * 2.4));

    /* morning: the light comes up as the station comes together */
    const dawn = reduced ? 1 : smooth(0.0, 0.26, pd);
    if (!reduced) key.drift(t);
    key.intensity = KEY_I * (0.62 + 0.38 * dawn);
    key.position.x += (1 - dawn) * -1.1;
    scene.environmentIntensity = 0.4 + 0.1 * dawn;

    /* the infant tray: descends, clicks home, then the footboard finds the baby's length */
    const k1 = smooth(0.54, 0.64, pd), k2 = smooth(0.66, 0.76, pd);
    tray.visible = pd > 0.5;
    tray.position.y = 0.058 + (1 - back(k1)) * 0.5;
    tray.rotation.z = (1 - k1) * 0.14; tray.rotation.x = (1 - k1) * -0.06;
    clickMat.opacity = Math.max(0, Math.sin(smooth(0.635, 0.68, pd) * Math.PI)) * 0.9;
    const measured = HEAD_X + 0.009 + TRAY.baby / 100;
    const sx = lerp(TRAY.L / 2 - 0.03, measured, ease(k2));
    slider.position.x = sx;
    lengthLine.scale.x = Math.max(0.0001, sx - HEAD_X); lengthLine.position.x = HEAD_X + (sx - HEAD_X) / 2;
    lineMat.opacity = smooth(0.7, 0.76, pd);

    /* finale: a child's marks rise up the mast */
    marks.forEach(m => {
      const a = smooth(0.87 + m.i * 0.018, 0.92 + m.i * 0.018, pd);
      m.ringMat.opacity = a; m.haloMat.opacity = a * (m.i === MARKS.length - 1 ? 0.5 : 0.22);
    });

    /* camera */
    sampleCam(pd);
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 2));
    const fl = reduced ? 0 : 1;
    camera.position.set(cs.p.x + Math.sin(t * 0.21) * 0.006 * fl + ptr.sx * 0.05, cs.p.y + Math.sin(t * 0.17 + 1.3) * 0.004 * fl, cs.p.z);
    camera.lookAt(cs.t.x, camera.position.y, cs.t.y);
    camera.fov = cs.fov; camera.updateProjectionMatrix();
    applyShift(camera, cs.s.x, cs.s.y);
    scene.updateMatrixWorld();

    const moving = Math.abs(pd - lastPd) > 1e-4; lastPd = pd;
    renderer.shadowMap.needsUpdate = moving || (shadowTick = (shadowTick + 1) % 6) === 0 || forcedT != null;
    lens.render(scene, camera, t);

    /* callouts */
    for (const c of CALLS) {
      const o = smooth(c.r[0], c.r[0] + 0.03, pd) * (1 - smooth(c.r[1] - 0.02, c.r[1], pd));
      if (o <= 0.001) { place(c.el, 0, 0, 0); continue; }
      const [x, y] = toScreen(c.p());
      const w = c.el._w ||= c.el.offsetWidth, h = c.el._h ||= c.el.offsetHeight;
      c.el.classList.toggle('is-left', c.side < 0);
      place(c.el, c.side < 0 ? x - w : x, y - h / 2, o);
    }
    { const [x, y] = toScreen(new THREE.Vector3(0.3, 0, 0.3)); place(note, Math.min(x, W - 260), Math.min(y + 30, H2 - 70), smooth(0.3, 0.34, pd) * (1 - smooth(0.84, 0.88, pd))); }
  }

  /* ---- Run -------------------------------------------------------------------------- */
  if (still) {
    const [st, sp] = still.split(',').map(Number);
    frame(performance.now(), st, sp);
    canvas.style.transition = 'none'; canvas.classList.add('is-ready');
    window.SR.stationStill = (t, p) => frame(performance.now(), t, p);
    return;
  }
  const runner = createLoop({ renderer, stage, frame: now => frame(now), onResize: resize,
    // the canvas fades up out of the paper as the station arrives (site.css): weigh by its opacity
    weight: () => clamp(((window.SR?.stationEnter ?? 1) - 0.08) * 1.9, 0, 1) });
  return warmUp(renderer, scene, camera, () => frame(performance.now(), 0, SR.stationProgress || 0), lens).then(() => {
    canvas.classList.add('is-ready'); last = performance.now(); runner.start();
    window.SR.stationStill = (t, p) => frame(performance.now(), t, p);
    window.SR.stationProbe = () => ({ pd, docked: docked.slice(), tray: tray.position.y });
  });
}
