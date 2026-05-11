export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let ticking = false;
  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 60);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}
