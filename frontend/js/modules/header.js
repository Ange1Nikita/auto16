export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let ticking = false;
  let lastY = 0;
  const HIDE_THRESHOLD = 80;

  function update() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);

    // На мобилке: листаем вниз → шапка прячется,
    // листаем вверх → шапка возвращается. На десктопе класс игнорируется CSS.
    if (y > HIDE_THRESHOLD) {
      if (y > lastY + 4)        header.classList.add('is-hidden');     // скролл вниз
      else if (y < lastY - 4)   header.classList.remove('is-hidden');  // скролл вверх
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}
