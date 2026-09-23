/* Sanrakshya — stickers on the wall.

   A small set of nursery stickers, die-cut with a white border, stuck to the
   paper the page is printed on. They slap on as you arrive, lift a corner when
   you hover, flutter when you scroll fast, and can be peeled off and stuck
   somewhere else. The peel is a real fold: the corner is clipped away along a
   45° crease and the paper backing is drawn as that corner reflected across
   the crease, with its shadow falling on the wall. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;

  /* ---- Art (viewBox 0 0 200 200). No outline here: the die-cut is generated. */
  const INK = '#2a2522', BROWN = '#8a5a34';
  const face = (x1, x2, y, r = 6) => `<circle cx="${x1}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x1 + 2}" cy="${y - 2}" r="${r * .32}" fill="#fff"/><circle cx="${x2 + 2}" cy="${y - 2}" r="${r * .32}" fill="#fff"/>`;
  const smile = (x, y, w = 10) => `<path d="M${x - w} ${y}q${w} ${w * .8} ${w * 2} 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const ART = {
    giraffe: `
      <rect x="71" y="30" width="12" height="40" rx="6" fill="#de9a45"/><rect x="117" y="30" width="12" height="40" rx="6" fill="#de9a45"/>
      <circle cx="77" cy="30" r="11" fill="${BROWN}"/><circle cx="123" cy="30" r="11" fill="${BROWN}"/>
      <ellipse cx="48" cy="82" rx="27" ry="12" transform="rotate(-22 48 82)" fill="#de9a45"/><ellipse cx="152" cy="82" rx="27" ry="12" transform="rotate(22 152 82)" fill="#de9a45"/>
      <path d="M100 54c34 0 52 26 52 58 0 22-8 38-20 50-9 9-20 14-32 14s-23-5-32-14c-12-12-20-28-20-50 0-32 18-58 52-58z" fill="#f0b35a"/>
      <path d="M70 80c8-6 19-2 19 7s-10 13-17 9-9-11-2-16z" fill="#c9772f"/><path d="M121 70c9-3 17 3 15 11s-12 10-18 5-5-13 3-16z" fill="#c9772f"/><path d="M138 108c6 0 9 6 6 11s-10 5-12 0 0-11 6-11z" fill="#c9772f"/>
      <ellipse cx="100" cy="144" rx="34" ry="25" fill="#fbe3c0"/>
      <ellipse cx="88" cy="140" rx="4" ry="5" fill="${BROWN}"/><ellipse cx="112" cy="140" rx="4" ry="5" fill="${BROWN}"/>
      ${face(80, 120, 106, 7)}
      <circle cx="64" cy="126" r="7" fill="#f4a9a0"/><circle cx="136" cy="126" r="7" fill="#f4a9a0"/>
      ${smile(100, 156, 9)}`,
    star: `
      <path d="M100 26l21 44 48 6-35 33 9 48-43-23-43 23 9-48-35-33 48-6z" fill="#f4b53f" stroke="#f4b53f" stroke-width="16" stroke-linejoin="round"/>
      <path d="M62 84c6-10 16-14 26-14" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      ${face(84, 116, 108, 6)}
      <circle cx="72" cy="124" r="6" fill="#f08a6a" opacity=".7"/><circle cx="128" cy="124" r="6" fill="#f08a6a" opacity=".7"/>
      ${smile(100, 126, 9)}`,
    rainbow: `
      <path d="M26 142a74 74 0 0 1 148 0" fill="none" stroke="#e0573a" stroke-width="18" stroke-linecap="round"/>
      <path d="M46 142a54 54 0 0 1 108 0" fill="none" stroke="#f4b53f" stroke-width="18" stroke-linecap="round"/>
      <path d="M66 142a34 34 0 0 1 68 0" fill="none" stroke="#8fb48e" stroke-width="18" stroke-linecap="round"/>
      <g fill="#fff6e8"><circle cx="30" cy="150" r="18"/><circle cx="50" cy="156" r="14"/><circle cx="16" cy="158" r="11"/><circle cx="170" cy="150" r="18"/><circle cx="150" cy="156" r="14"/><circle cx="184" cy="158" r="11"/></g>`,
    tape: `
      <g transform="rotate(-16 100 100)">
        <rect x="14" y="70" width="172" height="60" rx="9" fill="#f4b53f"/>
        <path d="M30 70v14M44 70v8M58 70v8M72 70v14M86 70v8M100 70v8M114 70v14M128 70v8M142 70v8M156 70v14M170 70v8" stroke="${INK}" stroke-width="3" opacity=".75"/>
        <text x="100" y="118" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="30" fill="${INK}">96 cm!</text>
      </g>`,
    heart: `
      <path d="M100 168C40 128 22 96 30 68c7-25 38-36 58-18 5 4 9 9 12 14 3-5 7-10 12-14 20-18 51-7 58 18 8 28-10 60-70 100z" fill="#f28d86"/>
      <path d="M50 74c3-9 11-15 20-15" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".75"/>
      ${face(82, 118, 100, 6)}${smile(100, 118, 9)}`,
    rocket: `
      <path d="M100 20c32 22 42 62 30 106H70C58 82 68 42 100 20z" fill="#cfe0f4"/>
      <path d="M100 20c14 10 23 23 28 38H72c5-15 14-28 28-38z" fill="#e0573a"/>
      <circle cx="100" cy="84" r="17" fill="#fff6e8"/><circle cx="100" cy="84" r="11" fill="#86aedc"/><circle cx="96" cy="80" r="3.5" fill="#fff"/>
      <path d="M70 108l-26 26 4 18 26-14z" fill="#e0573a"/><path d="M130 108l26 26-4 18-26-14z" fill="#e0573a"/>
      <path d="M82 126h36l-8 28c-3 8-17 8-20 0z" fill="#f4b53f"/><path d="M92 128h16l-4 18c-2 5-6 5-8 0z" fill="#e0573a"/>`,
    moon: `
      <path d="M126 26a76 76 0 1 0 50 122 62 62 0 0 1-50-122z" fill="#ffe39a"/>
      <path d="M72 104q9 7 18 0M100 112q9 7 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="74" cy="122" r="6" fill="#f4a9a0" opacity=".8"/>
      <text x="146" y="62" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="34" fill="#6f95c8">z</text>
      <text x="166" y="38" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="24" fill="#6f95c8">z</text>`,
    sprout: `
      <path d="M62 122h76l-10 50a9 9 0 0 1-9 7H81a9 9 0 0 1-9-7z" fill="#e0573a"/>
      <rect x="54" y="110" width="92" height="22" rx="7" fill="#c94a30"/>
      <path d="M100 110V70" stroke="#5e8c5b" stroke-width="7" stroke-linecap="round"/>
      <path d="M100 80c-6-26-30-36-52-30 4 23 28 36 52 30z" fill="#8fb48e"/>
      <path d="M100 70c6-30 33-40 56-32-4 25-31 38-56 32z" fill="#78a677"/>
      ${face(86, 114, 150, 4.5)}`,
    banana: `
      <path d="M36 62c6 66 70 104 130 76 9-4 7-16-3-15-47 8-92-20-108-66-3-8-20-5-19 5z" fill="#f7cf4f"/>
      <path d="M52 76c14 36 50 58 96 56" fill="none" stroke="#e2a92e" stroke-width="5" stroke-linecap="round"/>
      <path d="M34 60l-6-14 16 6z" fill="${BROWN}" stroke="${BROWN}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="166" cy="130" r="5" fill="${BROWN}"/>`,
    blocks: `
      <path d="M100 28l64 31-64 31-64-31z" fill="#f4b53f"/>
      <path d="M36 59l64 31v78l-64-31z" fill="#86aedc"/>
      <path d="M164 59l-64 31v78l64-31z" fill="#e0573a"/>
      <text transform="matrix(1 .48 0 1 0 0)" x="68" y="98" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-size="46" fill="#fff6e8">A</text>
      <text transform="matrix(1 -.48 0 1 0 0)" x="132" y="190" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-size="46" fill="#fff6e8">C</text>`,
    steps: `
      <circle cx="100" cy="100" r="74" fill="#8fb48e"/>
      <circle cx="100" cy="100" r="62" fill="none" stroke="#fff6e8" stroke-width="2.5" stroke-dasharray="3 6"/>
      <text x="100" y="92" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="30" fill="#fff6e8">First</text>
      <text x="100" y="124" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="30" fill="#fff6e8">steps!</text>
      <g fill="#fff6e8"><ellipse cx="86" cy="146" rx="6" ry="9"/><ellipse cx="112" cy="140" rx="6" ry="9"/></g>`,
  };

  /* ---- Where they go ----------------------------------------------------------
     x: % of the section width. y: anchored to an element so stickers never land on
     text however it wraps: top of `at` + ay × its height + dy px. */
  const PLACES = mobile ? {
    why: [
      { a: 'tape', x: 24, at: '.why__head', ay: 0, dy: -40, r: -6, s: 150 },
      { a: 'star', x: 84, at: '.why__title', ay: 0.1, r: -12, s: 96 },
    ],
    how: [
      { a: 'rocket', x: 84, at: '.how__head', ay: 0.04, r: 14, s: 124 },
    ],
  } : {
    why: [
      { a: 'tape', x: 46, at: '.why__head', ay: 0, dy: -60, r: -4, s: 150 },
      { a: 'star', x: 91, at: '.why__head', ay: 0.05, r: -12, s: 104 },
    ],
    how: [
      { a: 'rocket', x: 80, at: '.how__title', ay: 0.35, r: 14, s: 124 },
      { a: 'heart', x: 50, at: '#how-share', ay: 0.72, r: 10, s: 100 },
    ],
  };

  const html = (a) => `<svg viewBox="-12 -12 224 224" aria-hidden="true"><g class="die">${ART[a]}</g><g class="art">${ART[a]}</g></svg>`;
  const flap = (a) => `<svg viewBox="-12 -12 224 224" aria-hidden="true"><g class="die">${ART[a]}</g></svg>`;

  const all = [];
  for (const layer of document.querySelectorAll('.stickers')) {
    const set = PLACES[layer.dataset.set] || [];
    set.forEach((p, i) => {
      const size = Math.round(p.s * (mobile ? 0.7 : 1.18));
      const el = document.createElement('div');
      el.className = 'stk';
      el.style.cssText = `left:${p.x}%;--s:${size}px`;
      el._place = () => {
        const at = layer.parentElement.querySelector(p.at);
        if (!at) return;
        const lr = layer.getBoundingClientRect(), ar = at.getBoundingClientRect();
        el.style.top = `${ar.top - lr.top + ar.height * p.ay + (p.dy || 0)}px`;
      };
      el.innerHTML = `<div class="stk__body"><div class="stk__front">${html(p.a)}</div><div class="stk__flapwrap"><div class="stk__flap">${flap(p.a)}</div></div></div>`;
      layer.appendChild(el);
      all.push({
        el, body: el.firstChild, front: el.querySelector('.stk__front'), flap: el.querySelector('.stk__flap'), wrap: el.querySelector('.stk__flapwrap'),
        size, rot: p.r, place: el._place, rotV: 0, rotT: p.r,
        d: size * 0.95, dV: 0, dT: size * 0.95,          // fold distance from the corner, px
        sc: 1.14, scV: 0, scT: 1.14, lift: 0, liftT: 0,
        x: 0, y: 0, shown: false, hover: false, drag: null, wind: 0, delay: i * 0.12,
      });
    });
  }
  if (!all.length) return;
  const placeAll = () => all.forEach(k => k.place());
  placeAll();
  document.fonts?.ready.then(placeAll);
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(placeAll, 150); });

  /* ---- Render ------------------------------------------------------------------ */
  function paint(k) {
    const s = k.size, d = Math.max(0, Math.min(s * 1.4, k.d));
    // front: corner cut off along the crease x + y = 2s - d
    k.front.style.clipPath = `polygon(0 0, ${s}px 0, ${s}px ${s - d}px, ${s - d}px ${s}px, 0 ${s}px)`;
    // backing: that same corner, reflected across the crease
    const C = 2 * s - d;
    k.flap.style.clipPath = `polygon(${s - d}px ${s}px, ${s}px ${s - d}px, ${s}px ${s}px)`;
    k.flap.style.transform = `matrix(0, -1, -1, 0, ${C}, ${C})`;
    k.wrap.style.opacity = d > 0.5 ? 1 : 0;
    k.body.style.transform = `translate3d(${k.x}px, ${k.y - k.lift * 6}px, 0) rotate(${k.rot}deg) scale(${k.sc})`;
    k.el.style.setProperty('--lift', k.lift.toFixed(3));
  }
  all.forEach(paint);

  /* ---- Springs ------------------------------------------------------------------ */
  let raf = 0, last = 0;
  const step = (x, v, t, w, z, dt) => { const a = w * w * (t - x) - 2 * z * w * v; v += a * dt; return [x + v * dt, v]; };
  function tick(now) {
    const dt = Math.min(0.033, (now - (last || now)) / 1000 || 0.016); last = now;
    let busy = false;
    for (const k of all) {
      if (!k.shown) continue;
      const peelT = k.drag ? k.size * 0.3 : k.hover ? k.size * 0.17 : 0;
      k.dT = peelT + k.wind * k.size * 0.12;
      k.wind *= Math.exp(-dt * 3);
      [k.d, k.dV] = step(k.d, k.dV, k.dT, k.drag ? 14 : 9, 0.55, dt);
      [k.sc, k.scV] = step(k.sc, k.scV, k.scT, 16, 0.5, dt);
      [k.rot, k.rotV] = step(k.rot, k.rotV, k.rotT, 10, 0.45, dt);
      k.lift += ((k.drag ? 1 : 0) - k.lift) * (1 - Math.exp(-dt * 10));
      if (reduced) { k.d = k.dT; k.sc = k.scT; k.rot = k.rotT; }
      paint(k);
      if (Math.abs(k.d - k.dT) + Math.abs(k.dV) + Math.abs(k.sc - k.scT) * 50 + Math.abs(k.rot - k.rotT) + Math.abs(k.rotV) > 0.05 || k.drag || k.wind > 0.02) busy = true;
    }
    raf = busy ? requestAnimationFrame(tick) : 0;
    if (!busy) last = 0;
  }
  const wake = () => { raf ||= requestAnimationFrame(tick); };

  /* ---- Warm the GPU: the first paint of a filtered, clipped sticker compiles its shaders,
     which cost a visible hitch mid-scroll. Paint one copy of each, nearly invisible, while
     the reader is still in the hero, then take them away. ---------------------------- */
  const warm = () => {
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:0;bottom:0;width:240px;height:240px;opacity:.01;pointer-events:none;z-index:-1;overflow:hidden';
    for (const k of all) {
      const c = k.el.cloneNode(true); c.classList.add('is-on'); c.style.cssText += ';left:50%;top:50%;--lift:.4';
      c.querySelector('.stk__flapwrap') && (c.querySelector('.stk__flapwrap').style.opacity = 1);
      box.append(c);
    }
    document.body.append(box);
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => box.remove(), 300)));
  };
  addEventListener('sr:hero-ready', () => (window.requestIdleCallback || setTimeout)(warm), { once: true });

  /* ---- Arrival: slapped on, smoothed flat from one corner ----------------------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const k = all.find(q => q.el === e.target); io.unobserve(e.target);
    setTimeout(() => { k.shown = true; k.el.classList.add('is-on'); k.scT = 1; k.rotT = k.rot - 6; k.rot += 8; setTimeout(() => { k.rotT = k.rotT + 6; wake(); }, 120); wake(); }, reduced ? 0 : k.delay * 1000);
  }), { rootMargin: '0px 0px -8% 0px' });
  all.forEach(k => io.observe(k.el));

  /* ---- Hover, drag to peel off and re-stick --------------------------------------- */
  for (const k of all) {
    k.el.addEventListener('pointerenter', () => { k.hover = true; wake(); });
    k.el.addEventListener('pointerleave', () => { k.hover = false; wake(); });
    k.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      k.el.setPointerCapture(e.pointerId);
      k.drag = { sx: e.clientX - k.x, sy: e.clientY - k.y, px: e.clientX, moved: 0 };
      k.el.classList.add('is-drag'); k.scT = 1.06; wake();
    });
    k.el.addEventListener('pointermove', (e) => {
      if (!k.drag) return;
      const vx = e.clientX - k.drag.px; k.drag.px = e.clientX;
      k.drag.moved += Math.abs(vx);
      k.x = e.clientX - k.drag.sx; k.y = e.clientY - k.drag.sy;
      k.rotT = k.rotT + Math.max(-2, Math.min(2, vx * 0.15));        // it swings a little as it is carried
      wake();
    });
    const drop = () => {
      if (!k.drag) return;
      const tap = k.drag.moved < 4;
      k.drag = null; k.el.classList.remove('is-drag');
      k.scT = 1; k.sc = tap ? 0.96 : 1.08;                              // pressed back onto the wall
      if (tap) { k.dV += k.size * 3; k.rotV += 60; }                      // a tap flicks the corner
      wake();
    };
    k.el.addEventListener('pointerup', drop);
    k.el.addEventListener('pointercancel', drop);
  }

  /* ---- Scroll wind: fast scrolling lifts the corners a touch ----------------------- */
  if (!reduced) {
    let ly = scrollY, lt = performance.now();
    addEventListener('scroll', () => {
      const now = performance.now(), v = Math.abs(scrollY - ly) / Math.max(8, now - lt);
      ly = scrollY; lt = now;
      if (v > 1.2) { for (const k of all) if (k.shown) k.wind = Math.min(1, Math.max(k.wind, (v - 1.2) * 0.35)); wake(); }
    }, { passive: true });
  }
})();
