/**
 * Обратный звонок — модальное окно по кнопке [data-callback-btn].
 */
import { isValidPhone } from './forms.js';

const CFG = window.SOFTIP_AUTOPER_CONFIG || {};

export function initCallback() {
  const trigger = document.querySelector('[data-callback-btn]');
  const modal = document.querySelector('[data-callback-modal]');
  if (!trigger || !modal) return;

  const form = modal.querySelector('[data-callback-form]');
  const success = modal.querySelector('[data-callback-success]');

  function open() {
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(() => modal.querySelector('input[name="name"]')?.focus(), 100);
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    // Сброс через 300ms (после закрытия)
    setTimeout(() => {
      form.reset();
      Array.from(modal.querySelector('.modal__content').children).forEach(c => {
        if (c.matches('[data-callback-form]')) c.hidden = false;
      });
      success.hidden = true;
    }, 300);
  }

  trigger.addEventListener('click', open);
  modal.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name') || '').toString().trim();
    const phone = (data.get('phone') || '').toString().trim();
    if (!name) return alert('Укажите имя');
    if (!isValidPhone(phone)) return alert('Введите телефон полностью');

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.dataset.loading = 'true';

    try {
      await fetch(`${CFG.API_BASE}/api/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: name, customer_phone: phone })
      }).catch(() => {/* fallback на мок */});
      // Через паузу показываем success
      await new Promise(r => setTimeout(r, CFG.CALLBACK_DELAY_MS || 800));
      form.hidden = true;
      success.hidden = false;
      // Авто-закрытие через 2.5с
      setTimeout(close, 2500);
    } finally {
      submitBtn.dataset.loading = 'false';
    }
  });
}
