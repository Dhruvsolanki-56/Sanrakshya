/* Sanrakshya — navigation, scroll progress, headline play, and progressive loading of the 3D scenes */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const SR = (window.SR = window.SR || {});
  SR.homeProgress = 0;
  SR.stationProgress = 0;
  SR.reduced = reduced;

  const nav = document.getElementById('nav');
  const menuBtn = nav.querySelector('.nav__menu');
  const menu = document.getElementById('menu');
  const home = document.querySelector('.home');
  const station = document.querySelector('.station');
  const stationStage = station.querySelector('.station__stage');
  const how = document.querySelector('.how'), howStage = how?.querySelector('.how__stage');

  /* ------------------------------------------------------------------ */
  /* Scroll state: section progress, nav compact / hidden / solid          */
  /* ------------------------------------------------------------------ */
  let lastY = scrollY, ticking = false, menuOpen = false;

  // how far before its end a section is overlapped by the next one (its negative margin plus the
  // opaque part of the paper band above it). Pinned stories finish their beats before that point.
  const overlapOf = (el) => {
    const n = el.nextElementSibling; if (!n) return 0;
    return Math.max(0, -parseFloat(getComputedStyle(n).marginTop) || 0) + (n.matches('.clinic, .scale') ? innerHeight * 0.2 : 0);
  };
  let stationTail = 0;
  const measureTail = () => { stationTail = overlapOf(station); };
  measureTail();
  SR.overlapOf = overlapOf;
  addEventListener('resize', measureTail);

  function measure() {
    const y = scrollY;
    const hp = Math.min(1, Math.max(0, y / (home.offsetHeight * 0.8)));
    SR.homeProgress = hp;
    home.style.setProperty('--hp', hp.toFixed(4));

    const sTop = station.offsetTop, span = station.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, (y - sTop) / (span - stationTail)));
    SR.stationProgress = p;
    stationStage.style.setProperty('--p', p.toFixed(4));

    // the handoff: the phone recedes as How ends, the station rises out of the paper as it arrives
    // one clock for both: the phone has lifted away by the time the station reaches mid-screen
    const enter = Math.min(1, Math.max(0, 1 - (sTop - y) / innerHeight));
    SR.stationEnter = enter;
    stationStage.style.setProperty('--enter', enter.toFixed(4));
    stationStage.classList.toggle('is-entering', enter > 0 && enter < 1);
    howStage?.style.setProperty('--exit', Math.min(1, enter / 0.5).toFixed(4));

    if (!menuOpen) {
      const storyEnd = sTop + span;
      nav.dataset.compact = String(y > innerHeight * 0.12);
      nav.dataset.solid = String(y > storyEnd - 10);
      const dy = y - lastY;
      // Only hide once the reader is past the story; inside it the bar is part of the frame.
      if (y > storyEnd + innerHeight * 0.3 && dy > 6) nav.dataset.hidden = 'true';
      else if (dy < -6 || y <= storyEnd) nav.dataset.hidden = 'false';
    }
    lastY = y;
    ticking = false;
  }
  /* Smooth scrolling: Lenis eases the wheel; touch stays native. Everything that reacts
     to scroll listens to Lenis, so it updates in the same frame the page moves. */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
    const tick = (t) => { lenis.raf(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    lenis.on('scroll', measure);
    SR.lenis = lenis;
  } else {
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }, { passive: true });
  }
  addEventListener('resize', measure);
  measure();

  /* ------------------------------------------------------------------ */
  /* Menu                                                                */
  /* ------------------------------------------------------------------ */
  let lastFocus = null;
  function openMenu() {
    menuOpen = true; lastFocus = document.activeElement;
    menu.hidden = false;
    menu.classList.remove('is-closing');
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    menuBtn.setAttribute('aria-expanded', 'true');
    nav.dataset.hidden = 'false'; nav.dataset.solid = 'false';
    document.body.style.overflow = 'hidden'; lenis?.stop();
    setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), reduced ? 0 : 350);
  }
  function closeMenu(focusBack = true) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.add('is-closing');
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = ''; lenis?.start();
    const done = () => { menu.hidden = true; menu.classList.remove('is-closing'); };
    reduced ? done() : setTimeout(done, 520);
    if (focusBack) (lastFocus || menuBtn).focus({ preventScroll: true });
    measure();
  }
  menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(false); });
  addEventListener('keydown', e => {
    if (!menuOpen) return;
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab') {
      const f = [menuBtn, ...menu.querySelectorAll('a')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ------------------------------------------------------------------ */
  /* Cursor proximity: links lean a few pixels toward a nearby pointer    */
  /* ------------------------------------------------------------------ */
  if (finePointer && !reduced) {
    const items = [...nav.querySelectorAll('.nav__links a, .nav__cta, .nav__menu')];
    let raf = 0, px = -1e4, py = -1e4;
    const apply = () => {
      raf = 0;
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
        const reach = Math.max(r.width, 70);
        const k = d < reach ? (1 - d / reach) ** 2 : 0;
        el.style.translate = k ? `${(dx / reach * 5 * k).toFixed(2)}px ${(dy / reach * 3 * k).toFixed(2)}px` : '';
      }
    };
    nav.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; raf ||= requestAnimationFrame(apply); });
    nav.addEventListener('pointerleave', () => { px = py = -1e4; raf ||= requestAnimationFrame(apply); });
  }

  /* ------------------------------------------------------------------ */
  /* Headline play: letters hop under the pointer, like a child's step    */
  /* ------------------------------------------------------------------ */
  const title = document.getElementById('home-title');
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  const chars = [];
  const liveChars = () => [...title.querySelectorAll('.char')];
  (function split(node) {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of n.textContent) {
          if (/\s/.test(ch)) { frag.append(ch); continue; }
          const s = document.createElement('span'); s.className = 'char'; s.textContent = ch; s.setAttribute('aria-hidden', 'true');
          frag.append(s); chars.push(s);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) split(n);
    }
  })(title);
  // a hand-drawn tick under "how well."
  const well = title.querySelector('[data-egg="well"]');
  well.insertAdjacentHTML('beforeend', '<svg class="egg__tick" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 12 C 20 16, 34 17, 46 15 S 80 7, 98 4"/></svg>');

  /* ------------------------------------------------------------------ */
  /* The rotating headline: grow → eat → learn, each with its own toy     */
  /* ------------------------------------------------------------------ */
  const WORDS = [
    { w: 'grow.', l2: 'how well.' },
    { w: 'eat.', l2: 'what they need.' },
    { w: 'learn.', l2: 'every milestone.' },
  ];
  const swapEl = title.querySelector('[data-egg="grow"]');
  const tabs = [...document.querySelectorAll('.toys [role="tab"]')];
  let wordIdx = 0, toySetter = null, autoTimer = 0, pausedUntil = 0, hovering = false, firstWait = true;
  const mkChars = (text) => [...text].map((ch, i) => {
    if (ch === ' ') return document.createTextNode(' ');                  // spaces stay real spaces
    const c = document.createElement('span'); c.className = 'char in'; c.textContent = ch; c.setAttribute('aria-hidden', 'true');
    c.style.setProperty('--d', `${i * 0.035}s`); c.style.setProperty('--i', i); return c;
  });
  // old letters tumble out, new ones spring in: a word being swapped like a wooden block
  function swapWord(el, text) {
    const old = [...el.querySelectorAll('.char')];
    old.forEach((c, i) => { c.style.setProperty('--d', `${i * 0.02}s`); c.style.setProperty('--r', `${(i % 2 ? 1 : -1) * (6 + (i * 7) % 9)}`); c.classList.add('out'); });
    setTimeout(() => {
      old.forEach(c => c.remove());
      [...el.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); });
      const fresh = mkChars(text), tick = el.querySelector('.egg__tick, .crayon');
      fresh.forEach(c => el.insertBefore(c, tick));
      requestAnimationFrame(() => requestAnimationFrame(() => fresh.forEach(c => c.classList?.remove('in'))));
    }, reduced ? 0 : 260 + old.length * 20);
  }
  /* A crayon loop around the word, as a child would circle it: two passes of wax,
     paper tooth showing through, a wobble that is never the same twice. */
  const CRAYON = ['#2f9e5f', '#ef6a2b', '#2c6be0'];                 // green, orange, blue: real crayon pigments
  let crayonN = 0;
  function crayon(el, color, delay = 0) {
    el.querySelector('.crayon')?.remove();
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w) return;
    const px = h * 0.3, py = h * 0.14, W = w + px * 2, H = h * 0.84 + py * 2;
    const cx = W / 2, cy = H / 2, rx = W / 2 - 6, ry = H / 2 - 6;
    let seed = 11 + crayonN * 7.3;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const loop = (turns, start, scale) => {
      const pts = [], n = Math.round(22 * turns);
      for (let k = 0; k <= n; k++) {
        const a = start + (k / n) * turns * Math.PI * 2;
        const r = scale * (1 + (rnd() - 0.5) * 0.07) * (1 - 0.05 * (k / n));       // hands drift inward as the loop closes
        pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r * (1 + (rnd() - 0.5) * 0.05)]);
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let k = 1; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
        d += ` Q${x1.toFixed(1)} ${y1.toFixed(1)} ${((x1 + x2) / 2).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)}`;
      }
      return d;
    };
    const id = 'crayon' + (++crayonN), sw = Math.max(3.5, h * 0.055);
    el.insertAdjacentHTML('beforeend', `<svg class="crayon" aria-hidden="true" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="left:${-px}px;top:${(h - H) / 2 + h * 0.08}px;--cc:${color};--cd:${delay}s">
      <defs><filter id="${id}" x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${crayonN}" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.95" result="tooth"/>
        <feComposite in="SourceGraphic" in2="tooth" operator="in" result="wax"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${crayonN + 3}" result="wob"/>
        <feDisplacementMap in="wax" in2="wob" scale="${(sw * 0.8).toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>
      </filter></defs>
      <g filter="url(#${id})">
        <path class="crayon__a" pathLength="1" stroke-width="${sw.toFixed(1)}" d="${loop(1.12, -2.2 + rnd() * 0.3, 1)}"/>
        <path class="crayon__b" pathLength="1" stroke-width="${(sw * 0.7).toFixed(1)}" d="${loop(0.5, -2.0 + rnd() * 0.4, 0.97)}"/>
      </g></svg>`);
  }
  const crayonFor = (i, delay) => crayon(swapEl, CRAYON[i], delay);

  function setWord(i, fromUser = false) {
    // choosing the toy already on the shelf still means: stay here a while
    if (i === wordIdx) { if (fromUser) { pausedUntil = performance.now() + 30000; tabs.forEach(x => x.classList.remove('run')); schedule(); } return; }
    wordIdx = i;
    swapEl.querySelector('.crayon')?.classList.add('is-out');
    swapWord(swapEl, WORDS[i].w);
    swapEl.dataset.egg = ['grow', 'eat', 'learn'][i];
    setTimeout(() => crayonFor(i, 0.15), reduced ? 0 : 520 + WORDS[i].w.length * 35);
    setTimeout(() => swapWord(well, WORDS[i].l2), reduced ? 0 : 120);
    title.setAttribute('aria-label', `You see them ${WORDS[i].w} We see ${WORDS[i].l2}`);
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.classList.remove('run'); });
    void tabs[i].offsetWidth; if (!fromUser && !reduced) tabs[i].classList.add('run');
    toySetter?.(i);
    if (fromUser) pausedUntil = performance.now() + 30000;
    schedule();
  }
  function schedule() {
    clearTimeout(autoTimer);
    if (reduced) return;
    const wait = Math.max(firstWait ? 6500 : 5000, pausedUntil - performance.now()); firstWait = false;
    autoTimer = setTimeout(() => {
      // never move the shelf while someone is playing with it, or once the hero is out of view
      if (hovering || SR.homeProgress > 0.6 || document.hidden) return schedule();
      setWord((wordIdx + 1) % WORDS.length);
      tabs[wordIdx].classList.add('run');
    }, wait);
  }
  tabs.forEach((t, k) => t.addEventListener('click', () => { setWord(k, true); tabs.forEach(x => x.classList.remove('run')); }));
  tabs[0].addEventListener('keydown', () => {});
  document.querySelector('.toys').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (wordIdx + (e.key === 'ArrowRight' ? 1 : WORDS.length - 1)) % WORDS.length;
    setWord(n, true); tabs[n].focus();
  });
  const heroStage = home.querySelector('.home__stage');
  for (const el of [title, heroStage.querySelector('.home__canvas')]) {
    el.addEventListener('pointerenter', () => { hovering = true; tabs[wordIdx].classList.add('hold'); });
    el.addEventListener('pointerleave', () => { hovering = false; tabs[wordIdx].classList.remove('hold'); });
  }
  // the shelf starts turning, and the first loop is drawn, only once the loader has lifted
  // and the headline has landed
  addEventListener('sr:intro', () => {
    if (!reduced) { tabs[0].classList.add('run', 'first'); schedule(); }
    setTimeout(() => crayonFor(0, 0), reduced ? 0 : 1500);
  }, { once: true });

  if (finePointer && !reduced) {
    const hop = (i, h, r) => {
      const c = liveChars()[i]; if (!c) return;
      c.style.setProperty('--h', h); c.style.setProperty('--r', r);
      c.classList.add('is-hop');
      clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('is-hop'), 170);
    };
    let lastI = -1;
    title.addEventListener('pointermove', e => {
      const el = e.target.closest('.char'); if (!el) return;
      const i = liveChars().indexOf(el); if (i === lastI) return; lastI = i;
      const dir = Math.sign(e.movementX || 1);
      hop(i, 0.09, dir * -4); hop(i - 1, 0.04, 0); hop(i + 1, 0.04, 0);
    });
    title.addEventListener('pointerleave', () => { lastI = -1; });
  }

  /* ------------------------------------------------------------------ */
  /* Anchor scrolling: native, with the nav height accounted for          */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    let y;
    if (id === 'top' || id === '') y = 0;
    else if (id === 'story') y = station.offsetTop + (station.offsetHeight - innerHeight) * 0.97;
    else { const t = document.getElementById(id); if (!t) return; y = t.getBoundingClientRect().top + scrollY - (id === 'station' ? 0 : 20); }
    e.preventDefault();
    if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
    else scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ------------------------------------------------------------------ */
  /* Intro, station reveal, and progressive 3D                           */
  /* ------------------------------------------------------------------ */
  const start = () => { root.classList.add('is-loaded'); dispatchEvent(new Event('sr:intro')); setTimeout(() => root.classList.add('intro-done'), 1900); };

  /* The loader: a crayon writes the name while the page gets ready. It follows what is
     really loading (fonts, the page, then the hero's 3D) but never writes faster than a
     hand would, never waits longer than a few seconds, and on a second visit in the same
     session it hurries. When the name is written the crayon lifts away and the sheet is
     torn off the top of the page. */
  const loader = document.querySelector('.loader');
  const loaderGone = !loader ? Promise.resolve() : new Promise(done => {
    const pct = loader.querySelector('.loader__line span');
    const seen = (() => { try { return sessionStorage.getItem('sr-seen') === '1'; } catch { return false; } })();
    const t0 = performance.now(), HAND = reduced ? 1 : seen ? 1100 : 2700, MAX = seen ? 2600 : 6000;
    const writer = window.SRCrayon?.write(loader.querySelector('.loader__sign'), { width: Math.min(540, innerWidth * 0.8) });
    let target = 0.1, shown = 0, finished = false;
    root.classList.add('is-loading'); SR.lenis?.stop();
    const reach = v => { target = Math.max(target, v); };
    document.fonts?.ready.then(() => reach(0.4));
    if (document.readyState === 'complete') reach(0.62); else addEventListener('load', () => reach(0.62), { once: true });
    addEventListener('sr:hero-ready', () => reach(1), { once: true });
    const finish = () => {
      if (finished) return; finished = true;
      writer?.finish();
      setTimeout(() => {
        loader.classList.add('is-out'); root.classList.remove('is-loading'); SR.lenis?.start();
        try { sessionStorage.setItem('sr-seen', '1'); } catch {}
        done();
        setTimeout(() => loader.remove(), 1300);
      }, reduced ? 0 : 650);
    };
    const tick = (now) => {
      const el = now - t0;
      if (el > MAX) reach(1);
      const goal = target >= 1 ? 1 : Math.min(0.94, Math.max(target, 0.1 + (el / MAX) * 0.9));
      const hand = Math.min(1, el / HAND);                          // the crayon keeps a human pace
      shown += (Math.min(goal, hand) - shown) * (reduced ? 1 : 0.14);
      writer?.setProgress(shown);
      pct.textContent = `${Math.round(shown * 100)}%`;
      if (shown > 0.996) { writer?.setProgress(1); pct.textContent = '100%'; return finish(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const fontsIn = document.fonts?.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]) : Promise.resolve();
  Promise.all([fontsIn, loaderGone]).then(start);

  new IntersectionObserver(([en], io) => {
    if (en.isIntersecting) { station.classList.add('is-in'); io.disconnect(); setTimeout(() => station.classList.add('intro-done'), 1900); }
  }, { threshold: 0.3 }).observe(stationStage);

  function canRun3D() {
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return false;
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
  }
  if (!canRun3D()) return;

  // The giraffe is the hero: it loads right after first paint.
  const goHome = () => import('./giraffe-scene.js')
    .then(m => m.initGiraffe({
      stage: home.querySelector('.home__stage'),
      canvas: home.querySelector('.home__canvas'),
      annot: home.querySelector('.home__annot'),
      hint: home.querySelector('.home__hint'),
      growButton: home.querySelector('.home__grow'),
      words: { grow: swapEl, well },
      onToy: (fn) => { toySetter = fn; fn(wordIdx); },
    }))
    .catch(err => console.warn('[home] 3D unavailable, poster stays.', err));
  ('requestIdleCallback' in window) ? requestIdleCallback(goHome, { timeout: 500 }) : setTimeout(goHome, 150);

  // The station loads only as the reader approaches it.
  const force = new URLSearchParams(location.search).has('still');
  let stationLoading = null;
  const goStation = () => stationLoading ||= import('./station-scene.js')
    .then(m => m.initStation({ stage: stationStage, canvas: station.querySelector('.station__canvas'), annot: station.querySelector('.station__annot') }))
    .catch(err => console.warn('[station] 3D unavailable, poster stays.', err));
  if (force) goStation();
  else new IntersectionObserver(([en], io) => { if (en.isIntersecting) { goStation(); io.disconnect(); } }, { rootMargin: '100% 0px' }).observe(station);

  // After the hero is on screen, prepare what comes next while the reader is still reading:
  // the phones, then the station. Each waits for idle time so nothing competes with a scroll.
  const idleThen = (fn, t = 1500) => new Promise(r => ('requestIdleCallback' in window) ? requestIdleCallback(() => r(fn()), { timeout: t }) : setTimeout(() => r(fn()), 200));
  addEventListener('sr:hero-ready', async () => {
    await idleThen(() => 0, 1200);
    await idleThen(() => SR.loadApp?.());
    await idleThen(goStation);
  }, { once: true });
})();
