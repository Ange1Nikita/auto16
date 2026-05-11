export function initStickyCta() {
  const cta = document.querySelector('.sticky-cta');
  if (!cta) return;

  // Появляется, когда пользователь прокрутил больше одной высоты экрана —
  // т.е. ушёл от первого блока с hero-формой, где CTA уже есть на виду.
  const THRESHOLD = 120;
  const update = () => cta.classList.toggle('is-visible', window.scrollY > THRESHOLD);
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(() => { update(); ticking = false; }); ticking = true; }
  }, { passive: true });
  update();
}
