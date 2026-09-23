/* Sanrakshya — What Sanrakshya sees: the bento.
   Entrance in a diagonal wave, one window light shared by every card, a small tilt on
   the card under the pointer, and a loop per card that runs only while it is on screen.
   Everything animates transforms, opacity or stroke offsets. */
(() => {
  const bento = document.querySelector('[data-bento]');
  if (!bento) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const cells = [...bento.querySelectorAll('.cell')];
  const cell = name => bento.querySelector(`[data-cell="${name}"]`);

  /* ---- Entrance ---------------------------------------------------------- */
  const wave = () => {
    const b = bento.getBoundingClientRect();
    cells.forEach(c => {
      const r = c.getBoundingClientRect();
      // a wave that runs from the top-left corner towards the bottom-right
      const d = ((r.left - b.left) / b.width) * 0.28 + ((r.top - b.top) / b.height) * 0.42;
      c.style.setProperty('--d', `${d.toFixed(3)}s`);
    });
  };
  wave();
  const eio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const c = e.target; eio.unobserve(c);
    c.classList.add('is-in');
    const d = parseFloat(c.style.getPropertyValue('--d')) || 0;
    setTimeout(() => c.classList.add('is-settled'), (d + 1.5) * 1000);
  }), { rootMargin: '0px 0px -12% 0px' });
  cells.forEach(c => (reduced ? c.classList.add('is-in', 'is-settled') : eio.observe(c)));

  /* ---- One light, one tilt ----------------------------------------------- */
  if (fine && !reduced) {
    let raf = 0, px = 0, py = 0, rects = [];
    const measure = () => { rects = cells.map(c => c.getBoundingClientRect()); };
    const paint = () => {
      raf = 0;
      measure();
      cells.forEach((c, i) => {
        const r = rects[i], x = px - r.left, y = py - r.top;
        c.style.setProperty('--mx', `${x.toFixed(0)}px`);
        c.style.setProperty('--my', `${y.toFixed(0)}px`);
        const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
        c.classList.toggle('is-hover', inside);
        // the card under the pointer tips towards it, never more than two degrees
        c.style.setProperty('--rx', inside ? `${((0.5 - y / r.height) * 2.2).toFixed(2)}deg` : '0deg');
        c.style.setProperty('--ry', inside ? `${((x / r.width - 0.5) * 2.2).toFixed(2)}deg` : '0deg');
      });
    };
    bento.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; bento.classList.add('is-lit'); raf ||= requestAnimationFrame(paint); });
    bento.addEventListener('pointerleave', () => {
      bento.classList.remove('is-lit');
      cells.forEach(c => { c.classList.remove('is-hover'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---- Run a card's loop only while it can be seen ------------------------- */
  const whileVisible = (el, on, off) => new IntersectionObserver(([e]) => (e.isIntersecting ? on() : off()), { threshold: 0.15 }).observe(el);

  /* ======================================================================
     01 THE PACE: an illustrative child drifting 21 mm below their curve over
     18 months, never more than 4 mm at a single visit
     ====================================================================== */
  const pace = cell('pace');
  const fig = pace.querySelector('.pace'), svg = pace.querySelector('.pace__svg');
  const W = 640, H = 260, X0 = 34, X1 = 600, Y0 = 236, Y1 = 26;
  const VISITS = [0, 3, 6, 9, 12, 15, 18], GAP = [0, 3, 6, 10, 14, 17, 21];   // mm behind, at each visit
  const expH = m => 132 * Math.pow(m / 18, 0.86);                                // mm gained on their own curve
  const gapAt = m => { const k = Math.min(5, Math.floor(m / 3)), t = (m - k * 3) / 3; return GAP[k] + (GAP[k + 1] - GAP[k]) * (t * t * (3 - 2 * t)); };
  const X = m => X0 + (m / 18) * (X1 - X0), Y = mm => Y0 - (mm / 150) * (Y0 - Y1);
  const line = f => { let d = ''; for (let m = 0; m <= 18.001; m += 0.25) d += `${d ? 'L' : 'M'}${X(m).toFixed(1)} ${Y(f(m)).toFixed(1)}`; return d; };
  svg.querySelector('.pace__exp').setAttribute('d', line(expH));
  svg.querySelector('.pace__act').setAttribute('d', line(m => expH(m) - gapAt(m)));
  let band = line(m => expH(m) + 7), back = '';
  for (let m = 18; m >= -0.001; m -= 0.25) back += `L${X(m).toFixed(1)} ${Y(Math.max(0, expH(m) - 7)).toFixed(1)}`;
  svg.querySelector('.pace__band').setAttribute('d', band + back + 'Z');
  const NS = 'http://www.w3.org/2000/svg';
  const grid = svg.querySelector('.pace__grid');
  VISITS.forEach(m => {
    const l = document.createElementNS(NS, 'line'); l.setAttribute('x1', X(m)); l.setAttribute('x2', X(m)); l.setAttribute('y1', Y1 - 10); l.setAttribute('y2', Y0); grid.append(l);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', X(m)); t.setAttribute('y', H - 4); t.setAttribute('text-anchor', 'middle'); t.textContent = m ? `${m} mo` : 'Start'; grid.append(t);
  });
  const dotsG = svg.querySelector('.pace__dots');
  const dots = VISITS.map((m, i) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', X(m)); c.setAttribute('cy', Y(expH(m) - GAP[i])); c.setAttribute('r', 4.2); dotsG.append(c); return c; });
  const gapLine = document.createElementNS(NS, 'line'); gapLine.setAttribute('class', 'pace__gap'); svg.append(gapLine);
  const cur = svg.querySelector('.pace__cur');
  const out = { m: pace.querySelector('[data-m]'), g: pace.querySelector('[data-g]'), s: pace.querySelector('[data-s]') };

  let drawn = reduced ? 1 : 0, scrubM = null;
  const read = (m) => {
    const vi = Math.round(m / 3);
    out.m.textContent = Math.round(m);
    out.g.innerHTML = `${Math.round(gapAt(m))}&nbsp;mm`;
    const steps = GAP.slice(1, vi + 1).map((g, i) => g - GAP[i]);
    out.s.innerHTML = `${steps.length ? Math.max(...steps) : 0}&nbsp;mm`;
    gapLine.setAttribute('x1', X(m)); gapLine.setAttribute('x2', X(m));
    gapLine.setAttribute('y1', Y(expH(m))); gapLine.setAttribute('y2', Y(expH(m) - gapAt(m)));
    dots.forEach((d, i) => d.classList.toggle('at', scrubM !== null && i === vi));
  };
  const setDraw = (p) => {
    drawn = p;
    fig.style.setProperty('--draw', p.toFixed(4));
    dots.forEach((d, i) => d.classList.toggle('on', p >= VISITS[i] / 18 - 0.001));
    if (scrubM === null) read(18 * p);
  };
  // the line draws as the card crosses the screen, so the gap opens up under the reader's scroll
  let figTop = 0;
  const measureFig = () => { figTop = fig.getBoundingClientRect().top + scrollY; };
  const onScroll = () => {
    if (reduced) return;
    const p = clamp((scrollY + innerHeight * 0.92 - figTop) / (innerHeight * 0.62));
    if (Math.abs(p - drawn) > 0.0005) setDraw(p);
  };
  measureFig(); setDraw(drawn);
  addEventListener('resize', () => { measureFig(); wave(); onScroll(); });
  window.SR?.lenis?.on('scroll', onScroll);
  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => { measureFig(); onScroll(); }).observe(document.body);
  onScroll();
  // drag or hover across the chart to read any visit
  const scrub = e => {
    const r = svg.getBoundingClientRect();
    const m = clamp(((e.clientX - r.left) / r.width * W - X0) / (X1 - X0)) * 18 * Math.min(1, drawn / 0.999);
    scrubM = m; fig.classList.add('is-scrub');
    cur.setAttribute('x1', X(m)); cur.setAttribute('x2', X(m));
    read(m);
  };
  fig.addEventListener('pointermove', scrub);
  fig.addEventListener('pointerdown', scrub);
  fig.addEventListener('pointerleave', () => { scrubM = null; fig.classList.remove('is-scrub'); read(18 * drawn); });

  /* ======================================================================
     02 SIX SIGNS: the instruments take their readings one after another
     ====================================================================== */
  const six = [...cell('six').querySelectorAll('.six li')];
  const vals = six.map(li => li.querySelector('.six__v'));
  const setVal = (i, v) => { const li = six[i], dec = li.dataset.v.includes('.') ? 1 : 0; vals[i].innerHTML = `${v.toFixed(dec)} <small>${li.dataset.u}</small>`; };
  if (reduced) six.forEach(li => li.classList.add('done'));
  else {
    let si = -1, timer = 0, tw = 0, first = true;
    six.forEach((li, i) => { vals[i].innerHTML = `&ndash; <small>${li.dataset.u}</small>`; });
    const count = (i) => {
      const to = +six[i].dataset.v, t0 = performance.now();
      cancelAnimationFrame(tw);
      const f = (now) => { const k = clamp((now - t0) / 900); setVal(i, to * (1 - Math.pow(1 - k, 3))); if (k < 1) tw = requestAnimationFrame(f); };
      tw = requestAnimationFrame(f);
    };
    const step = () => {
      six[si]?.classList.replace('on', 'done');
      si = (si + 1) % six.length;
      if (si === 0 && !first) six.forEach(li => li.classList.remove('done'));
      first = false;
      six[si].classList.add('on');
      count(si);
    };
    whileVisible(cell('six'), () => { if (!timer) { step(); timer = setInterval(step, 1500); } }, () => { clearInterval(timer); timer = 0; });
  }

  /* ======================================================================
     03 WHO: the percentile fan draws, then the child's line rides through it
     ====================================================================== */
  const who = cell('who'), whoSvg = who.querySelector('svg.who'), ride = who.querySelector('animateMotion');
  let rode = false;
  whileVisible(who, () => {
    who.classList.add('is-play');
    if (!rode) { rode = true; if (!reduced) setTimeout(() => ride.beginElement(), 2600); }
    whoSvg.unpauseAnimations();
  }, () => whoSvg.pauseAnimations());
  if (reduced) who.querySelector('.who__dot').setAttribute('transform', 'translate(262 40)');

  /* ======================================================================
     04 PASSPORT: the front page moves to the back of the deck
     ====================================================================== */
  const cards = [...cell('pass').querySelectorAll('.pass__card')];
  let order = cards.map((_, i) => i);
  const lay = () => order.forEach((ci, p) => { cards[ci].style.setProperty('--p', p); cards[ci].classList.toggle('front', p === 0); });
  lay();
  if (!reduced) {
    let pt = 0;
    const turn = () => {
      if (cell('pass').matches(':hover')) return;
      const front = cards[order[0]];
      front.classList.add('go');
      setTimeout(() => { front.classList.remove('go'); order.push(order.shift()); lay(); }, 520);
    };
    whileVisible(cell('pass'), () => { pt ||= setInterval(turn, 2600); }, () => { clearInterval(pt); pt = 0; });
  }

  /* ======================================================================
     05 PLAIN WORDS: illustrative insights, typed as they are written
     ====================================================================== */
  const txt = cell('words').querySelector('.insight__txt');
  const LINES = [
    'Height has kept to the same curve since spring, and weight is catching up nicely. Nothing to act on. Next measure in four weeks.',
    'Growth has slowed a little across two visits. Worth raising at the next check-up, so it’s been added to your paediatrician’s notes.',
    'Arm circumference is steady and in range this month. Vaccines are up to date; the next one is due in three weeks.',
  ];
  if (reduced) txt.textContent = LINES[0];
  else {
    let li = 0, ci = 0, dir = 1, tt = 0, live = false;
    const tick = () => {
      if (!live) { tt = 0; return; }
      const s = LINES[li];
      if (dir > 0) {
        ci++; txt.textContent = s.slice(0, ci);
        tt = setTimeout(tick, ci >= s.length ? (dir = -1, 4200) : (/[,.;]/.test(s[ci - 1]) ? 240 : 26 + Math.random() * 30));
      } else {
        ci = Math.max(0, ci - 4); txt.textContent = s.slice(0, ci);
        if (!ci) { dir = 1; li = (li + 1) % LINES.length; tt = setTimeout(tick, 500); } else tt = setTimeout(tick, 12);
      }
    };
    whileVisible(cell('words'), () => { live = true; if (!tt) tt = setTimeout(tick, 700); }, () => { live = false; });
  }

  /* ======================================================================
     06 THE PAEDIATRICIAN: a report travels the arc and lands
     ====================================================================== */
  const doc = cell('doc'), loopSvg = doc.querySelector('svg.loop'), pkt = doc.querySelector('.loop__pkt animateMotion');
  let started = false;
  if (reduced) { doc.querySelector('.loop__pkt').setAttribute('transform', 'translate(256 84)'); doc.querySelector('.loop__ok').style.opacity = 1; }
  else whileVisible(doc, () => {
    if (!started) { started = true; pkt.beginElement(); }
    loopSvg.unpauseAnimations(); doc.classList.add('is-play');
  }, () => { loopSvg.pauseAnimations(); doc.classList.remove('is-play'); });
  // before it starts, the packet waits at the parent's side
  if (!reduced) doc.querySelector('.loop__pkt').setAttribute('transform', 'translate(44 84)');
  pkt?.addEventListener('beginEvent', () => doc.querySelector('.loop__pkt').removeAttribute('transform'));
})();
