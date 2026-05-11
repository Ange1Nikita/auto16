export function initStickyCta() {
  const cta = document.querySelector('.sticky-cta');
  if (!cta) return;

  // Появляется почти сразу при скролле, чтобы клиент всегда видел CTA
  const THRESHOLD = 80;
  const update = () => cta.classList.toggle('is-visible', window.scrollY > THRESHOLD);
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(() => { update(); ticking = false; }); ticking = true; }
  }, { passive: true });
  update();
}
