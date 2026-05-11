export function initStickyCta() {
  const cta = document.querySelector('.sticky-cta');
  if (!cta) return;

  const update = () => cta.classList.toggle('is-visible', window.scrollY > 250);
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(() => { update(); ticking = false; }); ticking = true; }
  }, { passive: true });
  update();
}
