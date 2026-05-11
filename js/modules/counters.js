export function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function format(n, decimals = 0) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function animate(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.countSuffix || '';
    const duration = parseInt(el.dataset.countDuration || '1500', 10);
    if (reduce) { el.textContent = format(target) + suffix; return; }
    const start = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 4);
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = format(target * easeOut(t)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  counters.forEach(el => io.observe(el));
}
