export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  // is-scrolled — переключаем по факту того, видна ли ещё .hero под шапкой.
  // Это надёжнее порога scrollY: за границей hero фон всегда светлый,
  // на hero — всегда тёмный, поэтому шапка получает корректный контраст
  // в любой момент скролла, без «белый на белом».
  const hero = document.querySelector('.hero');
  if (hero) {
    const headerH = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-h')
    ) || 72;
    const io = new IntersectionObserver(
      ([entry]) => header.classList.toggle('is-scrolled', !entry.isIntersecting),
      { rootMargin: `-${headerH}px 0px 0px 0px`, threshold: 0 }
    );
    io.observe(hero);
  } else {
    // На страницах без hero (если будут) — сразу плотная шапка.
    header.classList.add('is-scrolled');
  }

  // Mobile auto-hide: листаем вниз → шапка прячется, вверх → возвращается.
  // На десктопе CSS игнорирует .is-hidden.
  let ticking = false;
  let lastY = 0;
  const HIDE_THRESHOLD = 80;
  function updateHide() {
    const y = window.scrollY;
    if (y > HIDE_THRESHOLD) {
      if (y > lastY + 4)        header.classList.add('is-hidden');
      else if (y < lastY - 4)   header.classList.remove('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(updateHide); ticking = true; }
  }, { passive: true });
  updateHide();
}
