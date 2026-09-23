/* Sanrakshya — For parents: the row in the middle of the screen comes alive; on a
   desktop, pointing at a row does the same. */
(() => {
  const rows = [...document.querySelectorAll('.perk')];
  if (!rows.length) return;
  let on = -1, pointer = false;
  const set = (i) => { if (i === on) return; on = i; rows.forEach((r, k) => r.classList.toggle('on', k === i)); };
  const io = new IntersectionObserver(es => { if (pointer) return; es.forEach(e => { if (e.isIntersecting) set(rows.indexOf(e.target)); }); },
    { rootMargin: '-44% 0px -44% 0px' });
  rows.forEach(r => io.observe(r));
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    rows.forEach((r, i) => r.addEventListener('pointerenter', () => { pointer = true; set(i); }));
    document.querySelector('.perks').addEventListener('pointerleave', () => { pointer = false; });
  }
})();
