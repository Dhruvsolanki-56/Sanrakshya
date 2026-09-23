/* Sanrakshya — For paediatricians (the growth chart) + Public health (the field).
   Both are driven by the scroll position alone, updated in the same frame Lenis
   moves the page, and both touch only transforms, opacity and one 2D canvas. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 900px)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Geometry is read once (and on resize), never inside a scroll frame: other scroll handlers
  // write styles in the same frame, and a layout read after them would force a full layout.
  // p runs 0..1 over the part of the pin that the next chapter has not yet started to cover.
  const geo = new Map();
  const measureGeo = () => document.querySelectorAll('.clinic, .scale').forEach(el => geo.set(el, {
    top: el.offsetTop, h: el.offsetHeight, vh: innerHeight, tail: window.SR?.overlapOf ? SR.overlapOf(el) : 0,
  }));
  const progress = (el, y) => {
    const g = geo.get(el);
    return {
      enter: clamp(1 - (g.top - y) / g.vh),
      p: clamp((y - g.top) / (g.h - g.vh - g.tail)),
      near: y + g.vh > g.top - g.vh && y < g.top + g.h,
    };
  };
  const setBeats = (list, b) => list.forEach((li, i) => { li.classList.toggle('on', i === b); li.classList.toggle('done', i < b); });

  /* ======================================================================
     FOR PAEDIATRICIANS: the WHO height-for-age chart (boys, 2 to 5 years),
     filled in by the station. Four chapters: plotted, read against WHO,
     flagged, back to the parents.
     ====================================================================== */
  const clinic = document.querySelector('.clinic');
  const cStage = clinic.querySelector('.clinic__stage');
  const tabs = [...clinic.querySelectorAll('.cap__i')];
  const bars = tabs.map(t => t.querySelector('.cap__bar i'));
  const sheet = clinic.querySelector('.sheet');
  const chart = sheet.querySelector('svg.chart');
  const NC = tabs.length;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; };

  // WHO height-for-age, boys: median and SD (cm) at 6-month steps from 24 to 60 months
  const WHO = [[24, 87.8, 3.07], [30, 91.9, 3.31], [36, 96.1, 3.58], [42, 99.9, 3.83], [48, 103.3, 4.08], [54, 106.7, 4.31], [60, 110.0, 4.55]];
  const who = (m) => {
    let k = 0; while (k < WHO.length - 2 && m > WHO[k + 1][0]) k++;
    const [m0, a0, s0] = WHO[k], [m1, a1, s1] = WHO[k + 1], t = (m - m0) / (m1 - m0);
    return [a0 + (a1 - a0) * t, s0 + (s1 - s0) * t];
  };
  const PCT = [['97th', 1.881], ['85th', 1.036], ['50th', 0], ['15th', -1.036], ['3rd', -1.881]];
  const CX0 = 40, CX1 = 548, CY0 = 392, CY1 = 14, H0 = 78, H1 = 124;
  const cx = m => CX0 + (m - 24) / 36 * (CX1 - CX0), cy = h => CY0 - (h - H0) / (H1 - H0) * (CY0 - CY1);
  const curve = z => { let d = ''; for (let m = 24; m <= 60.001; m += 1) { const [md, sd] = who(m); d += `${d ? 'L' : 'M'}${cx(m).toFixed(1)} ${cy(md + z * sd).toFixed(1)}`; } return d; };
  // the printed grid: a line every month and every centimetre, heavier every 6 months and 5 cm
  const grid = chart.querySelector('.chart__grid'), axes = chart.querySelector('.chart__axes');
  for (let m = 24; m <= 60; m++) el('line', { x1: cx(m), x2: cx(m), y1: CY1, y2: CY0, class: m % 6 ? '' : 'maj' }, grid);
  for (let h = H0; h <= H1; h++) el('line', { x1: CX0, x2: CX1, y1: cy(h), y2: cy(h), class: h % 5 ? '' : 'maj' }, grid);
  for (let m = 24; m <= 60; m += 12) el('text', { x: cx(m), y: CY0 + 14, 'text-anchor': 'middle' }, axes).textContent = `${m / 12} years`;
  for (let h = 80; h <= H1; h += 5) { const t = el('text', { x: CX0 - 8, y: cy(h) + 3, 'text-anchor': 'end' }, axes); t.textContent = h; }
  el('text', { x: CX0 - 8, y: CY1 - 2, 'text-anchor': 'end', class: 't' }, axes).textContent = 'cm';
  const pctG = chart.querySelector('.chart__pct');
  PCT.forEach(([name, z]) => {
    el('path', { d: curve(z), class: z === 0 ? 'm' : '' }, pctG);
    const [md, sd] = who(60);
    el('text', { x: CX1 + 6, y: cy(md + z * sd) + 3 }, pctG).textContent = name;
  });
  let band = curve(1.036), back = ''; for (let m = 60; m >= 23.999; m -= 1) { const [md, sd] = who(m); back += `L${cx(m).toFixed(1)} ${cy(md - 1.036 * sd).toFixed(1)}`; }
  chart.querySelector('.chart__band').setAttribute('d', band + back + 'Z');

  // the illustrative child: a little above the median at two, drifting to the 23rd percentile
  const VIS = [[24, .30, 'Mar'], [27, .28, 'Jun'], [30, .22, 'Sep'], [33, .05, 'Dec'], [36, -.25, 'Mar'], [39, -.55, 'Jun'], [42, -.74, 'Sep']];
  const P = VIS.map(([m, z, mon]) => { const [md, sd] = who(m); return [cx(m), cy(md + z * sd), mon, md + z * sd]; });
  const kid = chart.querySelector('.chart__kid');
  kid.setAttribute('d', 'M' + P.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L'));
  const ptsG = chart.querySelector('.chart__pts');
  const pts = P.map(([x, y, mon, h]) => {
    const g = el('g', {}, ptsG);
    el('circle', { cx: x, cy: y, r: 3.2 }, g);
    const t = el('text', { x, y: y - 9, 'text-anchor': 'middle' }, g); t.textContent = mon;
    g.setAttribute('aria-label', `${h.toFixed(1)} cm`);
    return g;
  });
  // the reading of the latest point, and the crayon ring around the last three
  const [lx, ly] = P[P.length - 1];
  const rl = chart.querySelector('.chart__read line'), rt = chart.querySelector('.chart__read text');
  rl.setAttribute('x1', lx); rl.setAttribute('x2', lx); rl.setAttribute('y1', ly + 8); rl.setAttribute('y2', CY0);
  rt.setAttribute('x', lx + 8); rt.setAttribute('y', ly + 52); rt.textContent = '23rd percentile, from 62nd';
  const ring = (rx, ry, turn, wob) => {
    const [ax, ay] = P[4], cxr = (ax + lx) / 2 + 2, cyr = (ay + ly) / 2 + 1;
    let d = ''; const n = 34;
    for (let i = 0; i <= n; i++) {
      const a = -2.3 + (i / n) * Math.PI * 2 * turn, r = 1 + Math.sin(i * 1.7) * wob;
      d += `${d ? 'L' : 'M'}${(cxr + Math.cos(a) * rx * r).toFixed(1)} ${(cyr + Math.sin(a) * ry * r).toFixed(1)}`;
    }
    return d;
  };
  const flag = chart.querySelectorAll('.chart__flag path');
  flag[0].setAttribute('d', ring(46, 24, 1.12, 0.03));
  flag[1].setAttribute('d', ring(41, 20, 0.55, 0.05));

  let activeTab = -1;
  const setTab = (i) => {
    if (i === activeTab) return;
    activeTab = i;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; t.classList.toggle('done', k < i); });
    sheet.classList.toggle('is-pct', i >= 1);
    sheet.classList.toggle('is-flag', i >= 2);
    sheet.classList.toggle('is-note', i >= 3);
  };
  function clinicUpdate(y) {
    const { enter, p, near } = progress(clinic, y);
    if (!near) return;
    cStage.style.setProperty('--enter', enter.toFixed(3));
    const c = Math.min(NC - 1, Math.floor(p * NC)), t = p * NC - c;
    // the readings are plotted as the first chapter plays; later chapters are moments
    const k = reduced ? 1 : clamp((p * NC) / 0.8);
    sheet.style.setProperty('--kid', k.toFixed(3));
    pts.forEach((g, i) => g.classList.toggle('on', k >= i / (pts.length - 1) - 0.001));
    bars.forEach((b, i) => { b.style.transform = `scaleX(${(i < c ? 1 : i === c ? clamp(t / 0.9) : 0).toFixed(3)})`; });
    setTab(c);
  }
  // the index is also a tablist: choosing a chapter scrolls to it
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    const g = geo.get(clinic), y = g.top + (g.h - g.vh - g.tail) * ((i + 0.55) / NC);
    window.SR?.lenis ? SR.lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }));
  clinic.querySelector('.cap').addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const n = (activeTab + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + NC) % NC;
    tabs[n].focus(); tabs[n].click();
  });
  // the crayon spiral in the margin: tapped, it is drawn again in the next crayon
  const doodle = sheet.querySelector('.sheet__doodle'), CRAYONS = ['#2c6be0', '#2f9e5f', '#ef6a2b'];
  let dc = 0;
  doodle.addEventListener('click', () => {
    dc = (dc + 1) % CRAYONS.length;
    doodle.style.setProperty('--dc', CRAYONS[dc]);
    doodle.classList.remove('redraw'); void doodle.getBBox(); doodle.classList.add('redraw');
  });

  /* ======================================================================
     PUBLIC HEALTH: the field
     ====================================================================== */
  const scaleEl = document.querySelector('.scale');
  const sStage = scaleEl.querySelector('.scale__stage');
  const cv = scaleEl.querySelector('.scale__field');
  const labelsEl = scaleEl.querySelector('.scale__labels');
  const sBeats = [...scaleEl.querySelectorAll('.beats li')];
  const g = cv.getContext('2d');
  const N = mobile ? 650 : 1500;
  const CL = [
    { name: 'Paediatric clinic', x: 0.58, y: 0.3, w: 1.1 }, { name: 'School', x: 0.8, y: 0.24, w: 1.4, hot: true },
    { name: 'Anganwadi centre', x: 0.9, y: 0.58, w: 1.0 }, { name: 'Community camp', x: 0.66, y: 0.66, w: 1.2, hot: true },
    { name: 'Home visits', x: 0.52, y: 0.82, w: 0.7 }, { name: 'Clinic', x: 0.84, y: 0.86, w: 0.8 },
  ];
  const MCL = [                                          // phones: the field sits under the copy
    { x: 0.25, y: 0.55 }, { x: 0.72, y: 0.52, hot: true }, { x: 0.5, y: 0.68 }, { x: 0.22, y: 0.82, hot: true }, { x: 0.78, y: 0.84 }, { x: 0.5, y: 0.93 },
  ];
  if (mobile) CL.forEach((c, i) => Object.assign(c, MCL[i]));
  let rnd = 7; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const totalW = CL.reduce((a, c) => a + c.w, 0);
  const dots = [];
  for (let i = 0; i < N; i++) {
    let pick = R() * totalW, c = 0; while (pick > CL[c].w) { pick -= CL[c].w; c++; }
    dots.push({ gx: R(), gy: R(), c, ox: gauss(), oy: gauss(), rank: R(), delay: R(), hot: CL[c].hot ? R() < 0.22 : R() < 0.02 });
  }
  const labels = CL.map(c => { const el = document.createElement('span'); el.className = 'scale__label' + (c.hot ? ' hot' : ''); el.textContent = c.name; labelsEl.appendChild(el); return el; });

  let W = 1, H = 1, dpr = 1, lastP = -1;
  const sizeField = () => {
    dpr = Math.min(devicePixelRatio, 2); W = sStage.clientWidth; H = sStage.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); lastP = -1;
  };
  sizeField(); addEventListener('resize', sizeField);
  const INK = [42, 38, 34], SIG = [212, 72, 30];
  // the one child: the same record as on the chart, where the field begins
  const ORIGIN = mobile ? { x: 0.5, y: 0.66 } : { x: 0.64, y: 0.46 };
  const oneLbl = scaleEl.querySelector('.scale__one');

  function drawField(p) {
    const x0 = mobile ? 0.04 : 0.08, x1 = 0.97, y0 = mobile ? 0.46 : 0.08, y1 = 0.95;
    // the ripple: the field fills outward from the one child
    const ox = ORIGIN.x * W, oy = ORIGIN.y * H, reach = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
    const front = (reduced ? (p > 0.12 ? 1 : 0) : smooth(0.12, 0.36, p)) * reach * 1.02;
    const risk = smooth(0.62, 0.74, p);
    const spread = (mobile ? 5.5 : 7.5) * Math.sqrt(N / 1500);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // halos where risk gathers
    if (risk > 0) CL.forEach(c => {
      if (!c.hot) return;
      const cx = c.x * W, cy = c.y * H, r = 70 * Math.sqrt(c.w);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.4);
      gr.addColorStop(0, `rgba(212,72,30,${0.14 * risk})`); gr.addColorStop(1, 'rgba(212,72,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 1.4, 0, Math.PI * 2); g.fill();
    });
    const paths = { dim: new Path2D(), ink: new Path2D(), hot: new Path2D() };
    const rad = mobile ? 1.5 : 1.7;
    for (const d of dots) {
      const k = reduced ? (p > 0.36 ? 1 : 0) : ease(clamp((p - 0.38 - d.delay * 0.1) / 0.18));
      const c = CL[d.c];
      const gx = (x0 + d.gx * (x1 - x0)) * W, gy = (y0 + d.gy * (y1 - y0)) * H;
      const cx = c.x * W + d.ox * spread * Math.sqrt(c.w) * 3.2, cy = c.y * H + d.oy * spread * Math.sqrt(c.w) * 2.4;
      const x = gx + (cx - gx) * k, yv = gy + (cy - gy) * k;
      if (Math.hypot(gx - ox, gy - oy) > front) continue;
      const which = d.hot && risk > 0.5 ? 'hot' : 'ink';
      paths[which].moveTo(x + rad, yv); paths[which].arc(x, yv, rad, 0, Math.PI * 2);
    }
    g.fillStyle = 'rgba(42,38,34,.14)'; g.fill(paths.dim);
    g.fillStyle = 'rgba(42,38,34,.78)'; g.fill(paths.ink);
    g.fillStyle = `rgb(${SIG.join(',')})`; g.fill(paths.hot);
    // the one child, ringed, carried into the paediatric clinic with everyone else
    const k0 = reduced ? (p > 0.36 ? 1 : 0) : ease(clamp((p - 0.38) / 0.18));
    const kx = ox + (CL[0].x * W + 6 - ox) * k0, ky = oy + (CL[0].y * H - 4 - oy) * k0;
    g.fillStyle = `rgb(${SIG.join(',')})`; g.beginPath(); g.arc(kx, ky, mobile ? 3.4 : 4.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(${SIG.join(',')},${(0.55 - 0.3 * k0).toFixed(2)})`; g.lineWidth = 1;
    g.beginPath(); g.arc(kx, ky, (mobile ? 9 : 12) + 10 * (1 - smooth(0, 0.12, p)), 0, Math.PI * 2); g.stroke();
    oneLbl.style.transform = `translate3d(${(kx + 18).toFixed(0)}px, ${(ky - 5).toFixed(0)}px, 0)`;
    oneLbl.classList.toggle('on', p < 0.34);
    // labels under each cluster once the dots have gathered
    const show = p > 0.54;
    CL.forEach((c, i) => {
      labels[i].style.transform = `translate(-50%, 0) translate3d(${(c.x * W).toFixed(0)}px, ${(c.y * H + 36 * Math.sqrt(c.w) + 22).toFixed(0)}px, 0)`;
      labels[i].classList.toggle('on', show && !mobile);
    });
  }

  function scaleUpdate(y) {
    const { enter, p, near } = progress(scaleEl, y);
    if (!near) return;
    sStage.style.setProperty('--enter', enter.toFixed(3));
    sStage.style.setProperty('--sp', p.toFixed(3));
    const q = Math.round(p * 400) / 400;                  // redraw only when the picture would change
    if (q !== lastP && enter > 0.05) { lastP = q; drawField(p); }
    setBeats(sBeats, p < 0.14 ? 0 : p < 0.38 ? 1 : p < 0.62 ? 2 : 3);
  }

  /* ---- one scroll hook for both ------------------------------------------ */
  measureGeo();
  new ResizeObserver(() => { measureGeo(); kick(); }).observe(document.body);
  let raf = 0;
  const update = () => { raf = 0; const y = scrollY; clinicUpdate(y); scaleUpdate(y); };
  const kick = () => { raf ||= requestAnimationFrame(update); };
  // Lenis: update in the same frame it moves the page. Native scroll catches jumps (keys, anchors, restore).
  window.SR?.lenis?.on('scroll', update);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  document.fonts?.ready.then(() => { measureGeo(); kick(); });
  kick();
})();
