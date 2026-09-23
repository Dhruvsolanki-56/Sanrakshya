/* Sanrakshya — the close of the page: the spec sheet reveal, questions that open
   smoothly, the contact form, and the doorframe at the foot of the page. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const once = (els, fn, margin = '0px 0px -12% 0px') => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), { rootMargin: margin });
    els.forEach(el => io.observe(el));
  };

  /* ---- Spec sheet: each row's hairline draws, then its words rise ---------- */
  const rows = [...document.querySelectorAll('.spec__list > div')];
  rows.forEach((r, i) => r.style.setProperty('--d', `${(i % 3) * 0.09}s`));
  reduced ? rows.forEach(r => r.classList.add('in')) : once(rows, r => r.classList.add('in'));

  /* ---- Questions: open and close with the height eased, one at a time ----- */
  const qs = [...document.querySelectorAll('.q')];
  const setOpen = (q, open) => {
    const a = q.querySelector('.q__a');
    if (reduced || !a.animate) { q.open = open; q.classList.toggle('is-open', open); return; }
    q._anim?.cancel();
    if (open) {
      q.open = true;
      const h = a.scrollHeight;
      q.classList.add('is-open');
      q._anim = a.animate({ height: ['0px', `${h}px`] }, { duration: 620, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    } else {
      const h = a.offsetHeight;
      q.classList.remove('is-open');
      q._anim = a.animate({ height: [`${h}px`, '0px'] }, { duration: 420, easing: 'cubic-bezier(.65, 0, .35, 1)' });
      q._anim.onfinish = () => { q.open = false; };
    }
  };
  qs.forEach(q => q.querySelector('summary').addEventListener('click', e => {
    e.preventDefault();
    const open = !q.classList.contains('is-open');
    if (open) qs.forEach(o => o !== q && o.classList.contains('is-open') && setOpen(o, false));
    setOpen(q, open);
  }));

  /* ---- Contact ------------------------------------------------------------- */
  const form = document.querySelector('.contact .form');
  const status = form.querySelector('.form__status');
  const msgLabel = form.querySelector('[data-msg-label]');
  const PROMPTS = {
    parent: 'What would you like to know?',
    clinic: 'Tell us about your practice',
    programme: 'Tell us about your programme',
  };
  const pick = (who) => {
    const r = form.querySelector(`input[name="audience"][value="${who}"]`);
    if (r) { r.checked = true; msgLabel.textContent = PROMPTS[who]; }
  };
  form.addEventListener('change', e => { if (e.target.name === 'audience') pick(e.target.value); });
  // the buttons around the page that lead here say who is asking
  document.querySelectorAll('a[href="#contact"][data-audience]').forEach(a => a.addEventListener('click', () => pick(a.dataset.audience)));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = [...form.querySelectorAll('[required]')].filter(f => !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value)));
    form.querySelectorAll('.field').forEach(f => f.classList.toggle('is-bad', bad.some(b => f.contains(b))));
    status.classList.remove('is-bad');
    if (bad.length) { status.textContent = 'Please add your name and a valid email.'; status.classList.add('is-bad'); bad[0].focus(); return; }
    const endpoint = form.dataset.endpoint;
    if (!endpoint) { status.textContent = 'Sending isn’t available yet. Please try again soon.'; status.classList.add('is-bad'); return; }
    status.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (!res.ok) throw new Error(res.status);
      form.classList.add('is-sent');
      status.textContent = 'Thank you. We’ll be in touch soon.';
    } catch {
      status.textContent = 'That didn’t send. Please try again in a moment.'; status.classList.add('is-bad');
    }
  });

  /* ---- The doorframe: pencil marks drawn bottom to top as you arrive. The top one is
     today's. Come back another day and the last visit is marked too, a little lower. -- */
  const door = document.querySelector('.door');
  if (door) {
    const svg = door.querySelector('.door__marks'), NS = 'http://www.w3.org/2000/svg';
    const day = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const today = day(new Date());
    let visits = [];
    try { visits = JSON.parse(localStorage.getItem('sr-visits') || '[]').filter(v => typeof v === 'string'); } catch {}
    const before = visits.filter(v => v !== today).slice(-1)[0];
    try { localStorage.setItem('sr-visits', JSON.stringify([...visits.filter(v => v !== today), today].slice(-4))); } catch {}
    const MARKS = [[0.66, '9 mo'], [0.72, '1 yr'], [0.78, '18 mo'], [0.84, '2 yrs']];
    if (before) MARKS.push([0.9, before]);
    MARKS.push([before ? 0.96 : 0.91, today, true]);
    MARKS.forEach(([f, label, now], i) => {
      const y = 420 - f * 420, w = now ? 70 : 58 + (i % 2) * 6;
      const g = document.createElementNS(NS, 'g');
      if (now) g.setAttribute('class', 'now');
      g.style.setProperty('--d', `${(i * 0.22 + (now ? 0.3 : 0)).toFixed(2)}s`);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M0 ${y.toFixed(1)} c${(w * 0.3).toFixed(1)} -1.2 ${(w * 0.6).toFixed(1)} 1.1 ${w} -0.4`);
      path.setAttribute('pathLength', '1');
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', w + 8); t.setAttribute('y', (y + 5).toFixed(1));
      t.setAttribute('transform', `rotate(${(-2 + (i % 3)).toFixed(1)} ${w + 8} ${y.toFixed(1)})`);
      t.textContent = label;
      g.append(path, t); svg.append(g);
    });
    reduced ? door.classList.add('in') : once([door], d => d.classList.add('in'), '0px 0px -10% 0px');
    // the name in crayon, written by a small hand when the footer arrives
    const sign = document.querySelector('.foot__sign');
    if (sign && window.SRCrayon) {
      const w = Math.min(320, sign.clientWidth || 320);
      const pen = SRCrayon.write(sign, { width: w });
      reduced ? pen.finish() : once([sign], () => setTimeout(() => pen.play(2600), 300), '0px 0px -12% 0px');
    }
    // the toy nods when someone taps it
    const toy = door.querySelector('.door__toy');
    toy.addEventListener('click', () => { toy.classList.remove('nod'); void toy.offsetWidth; toy.classList.add('nod'); });
  }
})();
