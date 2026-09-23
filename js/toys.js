/* ==========================================================================
   Sanrakshya — the rest of the toy shelf.

   The giraffe (height) lives in giraffe-scene.js. Here: the rabbit (eating
   well) with a wooden carrot it can actually eat, and the owl (learning,
   milestones) who turns its head further than seems reasonable. Both are
   design-shop wooden toys like the giraffe, both face the lens, and both
   share one small rig: look at something, blink, react to a tap, a hold, and
   the two hidden words in the headline.
   ========================================================================== */
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const spring = (x, v, t, w, z, dt) => { const a = w * w * (t - x) - 2 * z * w * v; v += a * dt; return [x + v * dt, v]; };

/* Look-at for a toy that faces +z: yaw about y, pitch about x, in the root's space. */
function aim(root, headPivot, target) {
  const local = root.worldToLocal(target.clone());
  const h = root.worldToLocal(new THREE.Vector3().setFromMatrixPosition(headPivot.matrixWorld));
  const d = local.sub(h);
  return { yaw: Math.atan2(d.x, d.z), pitch: -Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}

function rig(extra = {}) {
  return { yaw: 0, yawV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0, blink: 0, nextBlink: 1.6, nod: 0, hop: 0, hopV: 0, over: false, ...extra };
}
function blinkTick(s, t, dt, reduced, speed = 7) {
  if (!reduced && t > s.nextBlink) { s.blink = 1; s.nextBlink = t + 2.2 + Math.random() * 3.8; }
  s.blink = Math.max(0, s.blink - dt * speed);
  return Math.sin(s.blink * Math.PI);
}

/* ---- Rabbit ----------------------------------------------------------------- */
export function buildRabbit({ part, coatMaterial, plain, bead, walnut, contactShadowMesh }) {
  const root = new THREE.Group();
  // plush agouti fur: fawn back, cream belly facing forward, fine ticking and a velvet sheen
  const wood = coatMaterial({ type: 1, seed: 31, axis: [0, 1, -0.3], c0: 0x9f7552, c1: 0xefe2cf, belly: [0, -0.35, 1], fur: 620, bump: 0.0007, roughness: 0.9, sheen: 1 });
  const light = coatMaterial({ type: 1, seed: 33, axis: [0, 0, 1], c0: 0xf0e4d2, c1: 0xfaf3e8, belly: [0, 0, 1], fur: 700, bump: 0.0006, roughness: 0.92, sheen: 1 });
  const pink = plain({ color: 0xe8a39a, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const fluff = coatMaterial({ type: 1, seed: 35, c0: 0xf7f1e7, c1: 0xffffff, fur: 900, bump: 0.0012, roughness: 1, sheen: 1, sheenColor: 0xffffff });
  const orange = plain({ color: 0xe0762c, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const leaf = plain({ color: 0x6f9a4a, roughness: 0.55, clearcoat: 0.2 });
  const S1 = (r = 1) => new THREE.SphereGeometry(r, 32, 22);

  const bodyG = new THREE.Group(); root.add(bodyG);
  part(S1(), wood, bodyG, 0, 0.082, -0.006).scale.set(0.068, 0.083, 0.072);
  for (const s of [-1, 1]) {
    part(S1(), wood, bodyG, s * 0.05, 0.045, -0.02).scale.set(0.04, 0.043, 0.056);                 // haunches
    const f = part(new THREE.CapsuleGeometry(0.014, 0.036, 8, 16), light, bodyG, s * 0.036, 0.012, 0.046);
    f.rotation.x = Math.PI / 2; f.scale.set(1, 1, 0.72);                                               // long feet
  }
  const paws = new THREE.Group(); bodyG.add(paws);
  for (const s of [-1, 1]) part(S1(0.016), wood, paws, s * 0.02, 0.106, 0.058);                    // front paws, around the carrot
  part(S1(0.025), fluff, bodyG, 0, 0.06, -0.078);                                                     // cotton tail

  // the carrot, held in the paws; it gets shorter from the tip as it is eaten
  const CARROT_Y = 0.084, CARROT_Z = 0.064;
  const carrot = new THREE.Group(); carrot.position.set(0, CARROT_Y, CARROT_Z); carrot.rotation.set(-2.9, 0, 0.06); bodyG.add(carrot);
  const cbody = new THREE.Group(); carrot.add(cbody);
  const cone = new THREE.ConeGeometry(0.0125, 0.072, 20, 6); cone.rotateX(Math.PI); cone.translate(0, -0.036, 0);
  part(cone, orange, cbody);
  for (let i = 0; i < 3; i++) {
    const l = part(new THREE.CapsuleGeometry(0.0038, 0.026, 4, 8), leaf, carrot, 0, 0.016, 0);
    l.rotation.set((i - 1) * 0.1, 0, (i - 1) * 0.45); l.translateY(0.004);
  }

  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.152, 0.012); headPivot.rotation.order = 'YXZ'; bodyG.add(headPivot);
  const head = new THREE.Group(); headPivot.add(head);
  part(S1(), wood, head, 0, 0.03, 0).scale.set(0.052, 0.047, 0.05);
  const cheeks = [-1, 1].map(s => { const c = part(S1(0.021), wood, head, s * 0.02, 0.017, 0.027); c.scale.set(1, 0.85, 0.85); return c; });
  const muzzle = part(S1(0.016), light, head, 0, 0.014, 0.043);
  const nose = part(S1(0.0055), pink, head, 0, 0.025, 0.057);
  const eyes = [-1, 1].map(s => part(S1(0.0078), bead, head, s * 0.026, 0.04, 0.037));
  const ears = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.017, 0.068, -0.006); p.rotation.set(-0.15, 0, -s * 0.13); head.add(p);
    const eg = new THREE.CapsuleGeometry(0.0135, 0.07, 8, 18); eg.translate(0, 0.049, 0);
    part(eg, wood, p).scale.set(1, 1, 0.42);
    const ig = new THREE.CapsuleGeometry(0.0078, 0.054, 6, 14); ig.translate(0, 0.046, 0);
    part(ig, pink, p, 0, 0, 0.0047).scale.set(1, 1, 0.35);
    p.userData = { s, base: p.rotation.clone() };
    return p;
  });

  const shadow = contactShadowMesh(0.22, 0.2, { inner: 0.62, blur: 22, round: 0.5, opacity: 0.6 }); root.add(shadow);

  // crumbs: a few orange flecks fall from each bite and settle on the floor
  const crumbGeo = new THREE.IcosahedronGeometry(0.0022, 0);
  const crumbs = Array.from({ length: 8 }, () => { const c = part(crumbGeo, orange, root); c.visible = false; c.userData = { v: new THREE.Vector3(), life: 0 }; return c; });
  let crumbI = 0;
  const tipW = new THREE.Vector3();
  const drop = () => {
    carrot.localToWorld(tipW.set(0, -0.072 * st.left, 0)); root.worldToLocal(tipW);
    for (let k = 0; k < 2; k++) {
      const c = crumbs[crumbI++ % crumbs.length];
      c.position.copy(tipW); c.visible = true; c.scale.setScalar(0.7 + Math.random() * 0.8);
      c.userData.v.set((Math.random() - 0.5) * 0.12, 0.05 + Math.random() * 0.05, 0.05 + Math.random() * 0.06); c.userData.life = 1.6;
    }
  };

  const st = rig({ bite: 0, left: 1, leftV: 0, goal: 1, lastBite: -9, eating: false, nextBite: 0, twitch: 0, nextTwitch: 2, earT: [0, 0], nextEar: 3,
    feed: 0, feedV: 0, chew: 0, wasActive: false, autoFrom: -9, autoTo: -9 });
  // one bite: a quick dip to the tip, a snip off the carrot, then a burst of fast chewing
  const BITE = 0.62;
  const bite = () => { st.bite = 1; st.chew = 1; st.goal = Math.max(0.16, st.goal - 0.1); setTimeout(drop, 90); };

  return {
    root, head, headPivot, prop: carrot, height: 0.26,
    update({ t, dt, target, reduced, active }) {
      // when its turn comes it takes a few bites by itself, so the eating is seen, not only found
      if (active && !st.wasActive && !reduced) { st.autoFrom = t + 1.6; st.autoTo = t + 1.6 + BITE * 4; }
      st.wasActive = !!active;
      const eating = st.eating || (t > st.autoFrom && t < st.autoTo);
      const a = aim(root, headPivot, eating ? carrot.localToWorld(tipW.set(0, -0.06, 0)) : target);
      // the dip: fast in, a touch slower out
      const bp = 1 - st.bite, down = st.bite > 0 ? 0.3 * (bp < 0.3 ? Math.sin(bp / 0.3 * Math.PI / 2) : Math.cos((bp - 0.3) / 0.7 * Math.PI / 2)) : 0;
      [st.yaw, st.yawV] = spring(st.yaw, st.yawV, clamp(a.yaw, -1.0, 1.0), 8, 0.72, dt);
      [st.pitch, st.pitchV] = spring(st.pitch, st.pitchV, clamp(a.pitch, -0.5, 0.35) + down, 9, 0.7, dt);
      [st.roll, st.rollV] = spring(st.roll, st.rollV, st.over ? 0.16 : 0, 6, 0.5, dt);
      if (reduced) { st.yaw = a.yaw; st.pitch = a.pitch; }
      st.nod = Math.max(0, st.nod - dt * 0.8);
      const nod = Math.sin((1 - st.nod) * Math.PI * 4) * 0.2 * st.nod;
      // chewing: rabbits chew fast, about five times a second, the whole muzzle working side to side
      st.chew = Math.max(0, st.chew - dt / 1.1);
      const chewing = reduced ? 0 : Math.min(1, st.chew * 3), cw = Math.sin(t * 31);
      headPivot.rotation.set(st.pitch + nod + cw * 0.018 * chewing, st.yaw + Math.sin(t * 15.5) * 0.02 * chewing, st.roll);
      muzzle.scale.set(1 + cw * 0.06 * chewing, 1 - Math.abs(cw) * 0.1 * chewing, 1);
      cheeks.forEach((c, i) => c.scale.set(1 + (i ? cw : -cw) * 0.07 * chewing, 0.85 + Math.abs(cw) * 0.05 * chewing, 0.85));

      // eating: a bite every BITE seconds while it is asked to; the carrot grows back when left alone
      if (eating && t > st.nextBite) { bite(); st.nextBite = t + BITE; st.lastBite = t; }
      st.bite = Math.max(0, st.bite - dt / 0.26);
      if (!eating && t > st.lastBite + 2.2) st.goal = 1;
      [st.left, st.leftV] = spring(st.left, st.leftV, st.goal, 14, 0.85, dt);
      cbody.scale.set(1, Math.max(0.05, st.left), 1);
      // the paws feed what is left up to the mouth, and lower it again when it is done
      [st.feed, st.feedV] = spring(st.feed, st.feedV, eating ? 1 : 0, 7, 0.8, dt);
      const rise = (1 - st.left) * 0.068 * st.feed + st.feed * 0.006;
      carrot.position.set(0, CARROT_Y + rise, CARROT_Z + st.feed * 0.004);
      carrot.rotation.x = -2.9 - st.feed * 0.08;
      paws.position.y = rise * 0.9;
      // crumbs fall, bounce once, and settle
      for (const c of crumbs) {
        if (!c.visible) continue;
        const u = c.userData; u.life -= dt;
        if (c.position.y > 0.002) { u.v.y -= 9.8 * 0.35 * dt; c.position.addScaledVector(u.v, dt); }
        if (c.position.y <= 0.002) { c.position.y = 0.002; if (u.v.y < -0.05) u.v.y *= -0.25; else u.v.set(0, 0, 0); u.v.x *= 0.6; u.v.z *= 0.6; }
        if (u.life < 0.4) c.scale.multiplyScalar(0.92);
        if (u.life <= 0) c.visible = false;
      }

      // nose: a twitch now and then, like it has just smelled something good, and all the time while it chews
      if (!reduced && t > st.nextTwitch) { st.twitch = 1; st.nextTwitch = t + 2 + Math.random() * 3; }
      st.twitch = Math.max(0, st.twitch - dt * 1.6, chewing * 0.8);
      const tw = Math.sin(t * 34) * 0.12 * st.twitch;
      nose.scale.set(1 + tw, 1 - tw, 1);

      const lid = Math.max(blinkTick(st, t, dt, reduced), chewing * 0.22);        // eyes soften, contentedly, while it chews
      for (const e of eyes) e.scale.y = 1 - 0.85 * lid;

      // ears: lag behind the head, flick at random, go up when something is interesting
      if (!reduced && t > st.nextEar) { st.earT[Math.random() < 0.5 ? 0 : 1] = 1; st.nextEar = t + 2.5 + Math.random() * 4; }
      ears.forEach((p, i) => {
        st.earT[i] = Math.max(0, st.earT[i] - dt * 3.5);
        const flick = Math.sin(st.earT[i] * Math.PI) * 0.35;
        const perk = st.over && !eating ? 0.12 : 0, relaxed = -st.feed * 0.14;     // ears lie back a little while it eats
        p.rotation.x = p.userData.base.x - st.yawV * 0.02 + perk + relaxed - st.hop * 0.8;
        p.rotation.z = p.userData.base.z - p.userData.s * (flick - perk) - st.yawV * 0.03;
      });

      // hop: a small jump with squash on landing
      [st.hop, st.hopV] = spring(st.hop, st.hopV, 0, 14, 0.25, dt);
      const lift = Math.max(0, st.hop);
      bodyG.position.y = lift * 0.05;
      bodyG.scale.set(1 + Math.min(0, st.hop) * -0.15, 1 + Math.min(0, st.hop) * 0.3 + (reduced ? 0 : Math.sin(t * 1.9) * 0.006), 1);
      shadow.material.opacity = 0.6 * (1 - lift * 0.6);
    },
    tap() { st.hopV += 9; },
    hold(on) { st.eating = on; if (on) st.nextBite = 0; },
    word(on) { st.eating = on; st.over = on; if (on) st.nextBite = 0; },
    nod() { st.nod = 1; },
    over(on) { st.over = on; },
    get carrotLeft() { return st.left; },
    messages: {
      tap: ['<b>Crunch.</b>', '<b>Veggies first.</b><span>Dessert negotiations later.</span>', '<b>Every bite counts.</b>', '<b>Balanced plate, happy tummy.</b>'],
      word: '<b>Nom.</b><span>Meal plans shaped around their growth.</span>',
      line2: '<b>Energy, protein, iron, calcium.</b><span>Daily intake, read against what they need.</span>',
      held: '<b>That was most of the carrot.</b><span>Don&rsquo;t worry, it grows back.</span>',
    },
  };
}

/* ---- Owl -------------------------------------------------------------------- */
export function buildOwl({ part, coatMaterial, plain, bead, walnut, contactShadowMesh }) {
  const root = new THREE.Group();
  // feathers: scalloped plumage, a streaked cream belly, a radiating facial disc
  const plumage = coatMaterial({ type: 2, cell: 0.15, seed: 41, axis: [0, -1, 0], c0: 0x5e4129, c1: 0xb99268, fur: 900, bump: 0.0008, roughness: 0.74, sheen: 0.6 });
  const belly = coatMaterial({ type: 3, seed: 43, axis: [0, -1, 0], c0: 0xf1e4cc, c1: 0x8a6241, fur: 900, bump: 0.0006, roughness: 0.8, sheen: 0.7 });
  const disc = coatMaterial({ type: 4, seed: 45, axis: [0, 0, 1], c0: 0xf4e9d6, c1: 0xa57c52, fur: 800, bump: 0.0005, roughness: 0.8, sheen: 0.7 });
  const amber = plain({ color: 0xe6a032, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const S1 = (r = 1) => new THREE.SphereGeometry(r, 32, 22);

  const bodyG = new THREE.Group(); root.add(bodyG);
  part(S1(), plumage, bodyG, 0, 0.092, 0).scale.set(0.07, 0.09, 0.066);
  part(S1(), belly, bodyG, 0, 0.084, 0.04).scale.set(0.051, 0.066, 0.03);
  for (const s of [-1, 1]) part(S1(), walnut, bodyG, s * 0.022, 0.008, 0.046).scale.set(0.013, 0.007, 0.015);   // feet
  const wings = [-1, 1].map(s => {
    const p = new THREE.Group(); p.position.set(s * 0.061, 0.135, -0.004); bodyG.add(p);
    part(S1(), plumage, p, 0, -0.046, 0).scale.set(0.017, 0.058, 0.046);
    p.userData.s = s; return p;
  });

  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.166, 0); headPivot.rotation.order = 'YXZ'; bodyG.add(headPivot);
  const head = new THREE.Group(); headPivot.add(head);
  part(S1(), plumage, head, 0, 0.034, 0).scale.set(0.066, 0.056, 0.06);
  const eyes = [];
  for (const s of [-1, 1]) {
    const d = part(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 40), disc, head, s * 0.024, 0.036, 0.05);
    d.rotation.set(Math.PI / 2, 0, 0); d.rotation.y = 0; d.rotateZ(-s * 0.28);
    const eye = new THREE.Group(); eye.position.set(s * 0.025, 0.037, 0.055); eye.rotation.y = s * 0.28; head.add(eye);
    const iris = part(new THREE.CylinderGeometry(0.0145, 0.0145, 0.004, 36), amber, eye); iris.rotation.x = Math.PI / 2;
    part(S1(0.0088), bead, eye, 0, 0, 0.0028).scale.set(1, 1, 0.55);
    eyes.push(eye);
  }
  const beak = new THREE.ConeGeometry(0.0072, 0.019, 16); beak.rotateX(Math.PI);
  part(beak, walnut, head, 0, 0.022, 0.063).rotation.x = -0.35;
  for (const s of [-1, 1]) { const tuft = part(new THREE.ConeGeometry(0.012, 0.032, 16), plumage, head, s * 0.041, 0.078, -0.004); tuft.rotation.z = -s * 0.5; }

  const shadow = contactShadowMesh(0.2, 0.18, { inner: 0.62, blur: 22, round: 0.5, opacity: 0.6 }); root.add(shadow);

  const st = rig({ spin: 0, spinning: false, twist: 0, twistV: 0, twistT: 0, flap: 0 });
  st.nextBlink = 1.8;

  return {
    root, head, headPivot, height: 0.27,
    update({ t, dt, target, reduced }) {
      const a = aim(root, headPivot, target);
      // owls turn their heads further than anyone: a wide range, quick, with a little overshoot
      // slow and deliberate: an owl's head is heavy; it turns smoothly and settles without bounce
      [st.yaw, st.yawV] = spring(st.yaw, st.yawV, clamp(a.yaw, -1.25, 1.25), 3.1, 0.95, dt);
      [st.pitch, st.pitchV] = spring(st.pitch, st.pitchV, clamp(a.pitch, -0.45, 0.35), 3.4, 0.95, dt);
      [st.roll, st.rollV] = spring(st.roll, st.rollV, st.over ? 0.26 : 0, 2.6, 0.9, dt);    // the curious head tilt
      if (reduced) { st.yaw = a.yaw; st.pitch = a.pitch; }
      if (st.spinning) st.spin += dt * 1.5;
      [st.twist, st.twistV] = spring(st.twist, st.twistV, st.spinning ? st.twist : st.twistT, 2.4, 0.92, dt);
      if (st.spinning) st.twist = st.spin;
      st.nod = Math.max(0, st.nod - dt * 0.8);
      const nod = Math.sin((1 - st.nod) * Math.PI * 4) * 0.2 * st.nod;
      headPivot.rotation.set(st.pitch + nod, st.yaw + st.twist, st.roll);

      const lid = blinkTick(st, t, dt, reduced, 4.2);                       // owls blink slowly
      for (const e of eyes) e.scale.y = 1 - 0.9 * lid;

      st.flap = Math.max(0, st.flap - dt * 1.3);
      wings.forEach(p => { p.rotation.z = p.userData.s * (Math.sin(t * 22) * 0.55 * st.flap + st.flap * 0.4) + (reduced ? 0 : p.userData.s * Math.sin(t * 1.6) * 0.02); });
      [st.hop, st.hopV] = spring(st.hop, st.hopV, 0, 13, 0.28, dt);
      const lift = Math.max(0, st.hop);
      bodyG.position.y = lift * 0.045;
      bodyG.scale.set(1, 1 + Math.min(0, st.hop) * 0.25 + (reduced ? 0 : Math.sin(t * 1.5) * 0.007), 1);
      shadow.material.opacity = 0.6 * (1 - lift * 0.6);
    },
    tap() { st.hopV += 8; st.flap = 1; },
    hold(on) {
      if (on) { st.spinning = true; st.spin = st.twist; }
      else { st.spinning = false; st.twist = ((st.twist + Math.PI) % (Math.PI * 2)) - Math.PI; st.twistT = 0; }   // unwinds the short way
    },
    word(on) { st.over = on; st.twistT = on ? 2.4 : 0; if (on) st.blink = 1; },
    nod() { st.nod = 1; },
    over(on) { st.over = on; },
    messages: {
      tap: ['<b>Hoo!</b>', '<b>First words, first steps.</b><span>All remembered.</span>', '<b>Clever one.</b>'],
      word: '<b>Hoo&rsquo;s learning? Everyone.</b>',
      line2: '<b>Physical, cognitive, language, social, emotional.</b><span>Every milestone, remembered.</span>',
      held: '<b>Owls turn their heads 270&deg;.</b><span>Toddlers, thankfully, don&rsquo;t.</span>',
    },
  };
}
