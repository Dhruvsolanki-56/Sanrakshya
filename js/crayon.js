/* Sanrakshya — the crayon writer.
   Writes "Sanrakshya" the way a child would: letter by letter, a different crayon for each,
   with a real crayon stick moving along the strokes. Wax is laid down as overlapping dabs
   with uneven pressure, then punched through by the paper's tooth, so it looks rubbed onto
   paper rather than drawn by a computer. Used by the loader and the footer. */
(() => {
  // single-stroke letters, drawn in a 520 x 150 box (baseline 100, x-height 56)
  const L = [
    ['M62 30C52 14 18 16 20 38C22 58 60 58 62 80C64 104 24 106 14 88'],
    ['M112 66C104 54 82 56 80 76C78 96 104 104 112 84', 'M113 58L114 100'],
    ['M130 58L130 100', 'M130 74C136 56 162 54 162 72L162 100'],
    ['M180 58L180 100', 'M180 76C186 60 198 56 208 60'],
    ['M258 66C250 54 228 56 226 76C224 96 250 104 258 84', 'M259 58L260 100'],
    ['M278 16L278 100', 'M306 56L280 80L308 100'],
    ['M350 62C344 54 324 54 324 66C324 78 350 76 350 88C350 102 326 102 320 94'],
    ['M366 16L366 100', 'M366 72C372 56 398 54 398 72L398 100'],
    ['M414 58C414 80 420 88 432 88C442 88 446 76 446 58', 'M446 58L446 118C446 138 420 140 412 126'],
    ['M494 66C486 54 464 56 462 76C460 96 486 104 494 84', 'M495 58L496 100'],
  ];
  const UNDERLINE = 'M18 134C140 124 300 128 506 118';
  const CRAYONS = ['#2f9e5f', '#ef6a2b', '#2c6be0', '#d4481e', '#8a6bb8', '#d9a02c'];
  const BOX_W = 520, BOX_H = 150;

  // a real crayon: a worn tip, a waxy body, and the paper wrapper with its two printed bands
  const STICK = `<svg viewBox="0 0 130 26" aria-hidden="true">
    <defs><linearGradient id="crayon-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/>
      <stop offset=".7" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient></defs>
    <path class="c-wax" d="M1 13C1 11.4 9 7.4 16 5.4L16 20.6C9 18.6 1 14.6 1 13Z"/>
    <rect class="c-wax" x="15" y="5" width="113" height="16" rx="2.4"/>
    <rect x="34" y="4.6" width="80" height="16.8" rx="1.5" class="c-paper"/>
    <rect x="40" y="4.6" width="3" height="16.8" class="c-wax"/><rect x="105" y="4.6" width="3" height="16.8" class="c-wax"/>
    <text x="74" y="16.4" text-anchor="middle" class="c-label">CRAYON</text>
    <rect x="15" y="5" width="113" height="16" rx="2.4" fill="url(#crayon-body)"/>
    <path d="M1 13C1 11.4 9 7.4 16 5.4L16 20.6C9 18.6 1 14.6 1 13Z" fill="url(#crayon-body)"/>
  </svg>`;

  // the paper's tooth: where wax skips over the tiny hollows of the sheet
  function toothFor(w, h, dpr) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cell = Math.max(1, Math.round(dpr));
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const v = rnd(), streak = Math.sin((x * 0.9 + y * 0.35) / (3.2 * dpr)) * 0.12;   // paper grain runs one way
      const a = v + streak > 0.22 ? (v > 0.9 ? 190 : 255) : 0;
      for (let yy = 0; yy < cell && y + yy < h; yy++) for (let xx = 0; xx < cell && x + xx < w; xx++) d[((y + yy) * w + x + xx) * 4 + 3] = a;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function write(host, { width = 300, underline = true, colors = CRAYONS } = {}) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = width, H = width * BOX_H / BOX_W, s = W / BOX_W;
    host.style.position = host.style.position || 'relative';
    const view = document.createElement('canvas'), ink = document.createElement('canvas');
    for (const c of [view, ink]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    view.style.cssText = `display:block;width:${W}px;height:${H}px`;
    view.className = 'crayon-word';
    const stick = document.createElement('div'); stick.className = 'crayon-stick'; stick.innerHTML = STICK;
    host.append(view, stick);
    const g = view.getContext('2d'), gi = ink.getContext('2d'), tooth = toothFor(view.width, view.height, dpr);

    // measure every stroke once, and sample it into points
    const svgNS = 'http://www.w3.org/2000/svg', probe = document.createElementNS(svgNS, 'svg'), path = document.createElementNS(svgNS, 'path');
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'; probe.append(path); document.body.append(probe);
    const strokes = [];
    L.forEach((letter, li) => letter.forEach(d => strokes.push({ d, color: colors[li % colors.length], w: 9.5 })));
    if (underline) strokes.push({ d: UNDERLINE, color: '#d4481e', w: 7.5 });
    let total = 0;
    for (const st of strokes) {
      path.setAttribute('d', st.d);
      const len = path.getTotalLength(), pts = [];
      for (let t = 0; t <= len; t += 0.7) { const p = path.getPointAtLength(t); pts.push([p.x, p.y]); }
      st.pts = pts; st.len = len; st.from = total; total += len + 26;   // + a short lift between strokes
    }
    probe.remove();

    let rnd = 11; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    let drawnTo = 0, si = 0, pi = 0, done = false;
    const dab = (x, y, r, color, a) => { gi.globalAlpha = a; gi.fillStyle = color; gi.beginPath(); gi.arc(x, y, r, 0, Math.PI * 2); gi.fill(); };
    const k = s * dpr;
    // lay wax up to a distance along the whole drawing
    const layTo = (dist) => {
      while (si < strokes.length) {
        const st = strokes[si], local = dist - st.from;
        if (local < 0) break;
        const upto = Math.min(st.pts.length - 1, Math.floor(local / 0.7));
        for (; pi <= upto; pi++) {
          const [x, y] = st.pts[pi], press = 0.82 + 0.18 * Math.sin(pi * 0.07 + si) + (R() - 0.5) * 0.12;
          const r = st.w / 2 * press * k;
          dab(x * k + (R() - 0.5) * r * 0.25, y * k + (R() - 0.5) * r * 0.25, r, st.color, 0.9);
          if (R() < 0.35) dab(x * k + (R() - 0.5) * r * 2.2, y * k + (R() - 0.5) * r * 2.2, r * (0.18 + R() * 0.2), st.color, 0.7);   // stray flecks
        }
        if (pi >= st.pts.length) { si++; pi = 0; } else break;
      }
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, view.width, view.height);
      g.drawImage(ink, 0, 0);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(tooth, 0, 0);
      g.globalCompositeOperation = 'source-over';
    };
    // where the crayon is, and which colour it is
    const tipAt = (dist) => {
      let st = strokes[strokes.length - 1];
      for (const x of strokes) if (dist >= x.from) st = x;
      const local = Math.min(st.len, Math.max(0, dist - st.from));
      const lifting = dist - st.from > st.len;                       // between strokes: travelling to the next
      const [x, y] = st.pts[Math.min(st.pts.length - 1, Math.floor(local / 0.7))];
      return { x: x * s, y: y * s, color: st.color, lifting };
    };
    let wob = 0;
    const setProgress = (p) => {
      const dist = Math.max(drawnTo, Math.min(1, p) * total);
      drawnTo = dist;
      layTo(dist);
      const tip = tipAt(dist); wob += 0.35;
      stick.style.setProperty('--c', tip.color);
      const lift = tip.lifting ? 10 : 0;
      stick.style.transform = `translate3d(${tip.x.toFixed(1)}px, ${(tip.y - lift).toFixed(1)}px, 0) rotate(${(-38 + Math.sin(wob) * 2.5).toFixed(2)}deg)`;
      if (p >= 1 && !done) { done = true; host.classList.add('is-written'); }
    };
    setProgress(0);
    const play = (ms) => new Promise(res => {
      const t0 = performance.now();
      const f = (now) => { const p = Math.min(1, (now - t0) / ms); setProgress(p * p * (3 - 2 * p) * 0.15 + p * 0.85); p < 1 ? requestAnimationFrame(f) : res(); };
      requestAnimationFrame(f);
    });
    const finish = () => setProgress(1);
    return { setProgress, play, finish };
  }

  window.SRCrayon = { write };
})();
