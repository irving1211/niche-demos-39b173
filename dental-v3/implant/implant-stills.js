/* The implant take-apart as four pre-rendered stills (no WebGL, a very weak device, or the live 3D could not hold 20 ms frames).
   The stills are renders of the same three.js scene (qa/make-stills.cjs): 0 assembled, 1 the post starting to come out, 2 taken apart with the four labels,
   3 coming back together. The same button steps through them: see the parts -> put it back together -> see it again. Reduced motion: no stepping delay. */
const root = document.querySelector('[data-imp]');
if (root && !root.classList.contains('stills-ready')) {
  root.classList.add('stills', 'stills-ready');
  const stage = root.querySelector('[data-imp-stage]'), btn = root.querySelector('[data-imp-btn]'), lblEl = root.querySelector('[data-imp-lbl]'), statusEl = root.querySelector('[data-imp-status]');
  const TXT = JSON.parse(root.dataset.txt);
  const lang = document.documentElement.lang === 'es' ? 'es' : 'en';
  const base = root.dataset.stills;
  const FILES = [base + 'still-0.webp', base + `still-${lang}-1.webp`, base + `still-${lang}-2.webp`, base + `still-${lang}-3.webp`];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const img = document.createElement('img');
  img.className = 'imp-still'; img.alt = ''; img.decoding = 'async'; img.setAttribute('data-imp-still', '');
  stage.append(img);
  let at = RM ? 2 : 0, busy = false;
  const cache = FILES.map((f) => { const i = new Image(); i.decoding = 'async'; i.src = f; return i; });
  const set = (n) => { at = n; img.src = FILES[n]; };
  const ui = (k, disabled, status) => {
    lblEl.textContent = TXT[k]; btn.setAttribute('aria-disabled', disabled ? 'true' : 'false'); btn.classList.toggle('back', k === 'back');
    if (status != null) statusEl.textContent = status;
  };
  img.addEventListener('load', () => root.classList.add('gl-on'), { once: true });
  set(at);
  if (at === 2) ui('back', false, TXT.sApart); else ui('apart', false, '');
  const wait = (ms) => new Promise((ok) => setTimeout(ok, RM ? 0 : ms));
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (at === 0) { busy = true; ui('back', true); set(1); await wait(700); set(2); ui('back', false, TXT.sApart); busy = false; }
    else if (at === 2) { busy = true; ui('again', true); set(3); await wait(700); set(0); ui('again', false, TXT.sTogether); busy = false; }
  });
  window.IMP_STILLS = { cache };
}
