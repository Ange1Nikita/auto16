export function initMobileMenu() {
  const menu = document.querySelector('.mobile-menu');
  if (!menu) return;

  const open  = () => { menu.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); };
  const close = () => { menu.setAttribute('aria-hidden', 'true');  document.body.classList.remove('no-scroll'); };

  document.querySelectorAll('[data-menu-open]').forEach(b => b.addEventListener('click', open));
  menu.querySelectorAll('[data-menu-close]').forEach(b => b.addEventListener('click', close));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.getAttribute('aria-hidden') === 'false') close();
  });
}
