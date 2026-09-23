/* Sanrakshya — How it works: the phone story, plus the shared word-rise and letter-hop type */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------------ */
  /* Reveal on view                                                      */
  /* ------------------------------------------------------------------ */
  const reveal = [
    ...document.querySelectorAll('.how__head > *'),
  ];
  reveal.forEach((el, i) => { el.classList.add('rv'); if (el.parentElement.matches('.how__head')) el.style.setProperty('--d', `${[...el.parentElement.children].indexOf(el) * 0.1}s`); });
  const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  reveal.forEach(el => rio.observe(el));

  /* ------------------------------------------------------------------ */
  /* How: the step in the middle of the screen drives the phones          */
  /* ------------------------------------------------------------------ */
  const steps = [...document.querySelectorAll('.how__step')];
  const stage = document.querySelector('.how__stage');
  const rail = [...document.querySelectorAll('.how__rail i')];
  const keepLines = [...document.querySelectorAll('.how__keep [data-k]')];
  let active = -1, app = null;

  function setStep(i) {
    if (i === active) return;
    active = i;
    stage.dataset.step = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    rail.forEach((r, k) => r.classList.toggle('on', k === i));
    app?.setStep(i);
  }
  const onKeep = (k) => keepLines.forEach((l, n) => l.classList.toggle('on', n === k));
  const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+e.target.dataset.step); }), { rootMargin: matchMedia('(max-width: 900px)').matches ? '-68% 0px -26% 0px' : '-45% 0px -45% 0px' });   // on phones the text lives below the phone
  steps.forEach(s => sio.observe(s));

  // the phones (and the real screens they play) are prepared in idle time after the hero,
  // or at the latest as the reader approaches
  let appLoading = null;
  const loadApp = () => appLoading ||= import('./app-scene.js')
    .then(m => m.initApp({ stage, glCanvas: stage.querySelector('.how__gl'), flat: stage.querySelector('.phone-flat__screen'), onKeep }))
    .then(a => { app = a; if (active > 0) app.setStep(active); })
    .catch(err => console.warn('[how] phone unavailable', err));
  window.SR = window.SR || {}; window.SR.loadApp = loadApp;
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); loadApp(); } }, { rootMargin: '100% 0px' }).observe(stage);

  /* ------------------------------------------------------------------ */
  /* Type that behaves like the hero: words rise in, letters hop          */
  /* ------------------------------------------------------------------ */
  function splitWords(el) {
    const out = [];
    (function walk(node) {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span'); w.className = 'rw';
            const inner = document.createElement('span'); inner.className = 'rw__i';
            for (const ch of part) { const c = document.createElement('span'); c.className = 'hc'; c.textContent = ch; inner.append(c); }
            w.append(inner); frag.append(w); out.push(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && n.tagName !== 'svg') walk(n);
      }
    })(el);
    return out;
  }
  const risers = [...document.querySelectorAll('[data-rise]')];
  risers.forEach(el => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    splitWords(el).forEach((w, i) => { w.style.setProperty('--wd', `${i * 0.055}s`); w.firstChild.setAttribute('aria-hidden', 'true'); });
    el.classList.add('rise');
  });
  const wio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; el.classList.add('rise-in'); wio.unobserve(el);
    setTimeout(() => el.classList.add('rise-done'), 1300 + el.querySelectorAll('.rw').length * 55);
  }), { rootMargin: '0px 0px -15% 0px' });
  risers.forEach(el => wio.observe(el));

  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    document.querySelectorAll('[data-hop]').forEach(el => {
      if (!el.querySelector('.hc')) el.querySelectorAll('dt').forEach(dt => splitWords(dt));
      let last = null;
      el.addEventListener('pointermove', e => {
        const c = e.target.closest('.hc'); if (!c || c === last) return; last = c;
        const sib = [c.previousElementSibling, c.nextElementSibling];
        const hop = (x, h) => { if (!x) return; x.style.setProperty('--h', h); x.classList.add('is-hop'); clearTimeout(x._t); x._t = setTimeout(() => x.classList.remove('is-hop'), 170); };
        hop(c, 0.1); sib.forEach(x => hop(x, 0.045));
      });
      el.addEventListener('pointerleave', () => { last = null; });
    });
  }

  setStep(0);
})();
