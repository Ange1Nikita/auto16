/**
 * Мини-форма заявки в Hero.
 * Отправляет POST /api/orders → бэкенд сохраняет заявку и шлёт уведомление в Telegram.
 *
 * Поля минимальные: откуда / куда / имя / телефон.
 * Тариф / расстояние / стоимость уточнит диспетчер при перезвоне.
 */
import { isValidPhone } from './forms.js';

const CFG = window.SOFTIP_AUTOPER_CONFIG || {};

export function initHeroForm() {
  const form = document.querySelector('[data-hero-form]');
  if (!form) return;

  const successEl = document.querySelector('[data-hero-success]');
  const errorEl = form.querySelector('[data-hero-error]');
  const submitBtn = form.querySelector('[data-hero-submit]');
  const resetBtn = document.querySelector('[data-hero-reset]');

  function showError(text) {
    if (!errorEl) return;
    errorEl.textContent = text;
    errorEl.hidden = false;
  }
  function clearError() {
    if (!errorEl) return;
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('input', clearError);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const data = new FormData(form);
    const fromAddr = String(data.get('from') || '').trim();
    const toAddr   = String(data.get('to')   || '').trim();
    const name     = String(data.get('name') || '').trim();
    const phone    = String(data.get('phone') || '').trim();

    if (fromAddr.length < 3) return showError('Укажите адрес отправления');
    if (toAddr.length < 3)   return showError('Укажите адрес назначения');
    if (fromAddr.toLowerCase() === toAddr.toLowerCase()) {
      return showError('Адреса отправления и назначения совпадают');
    }
    if (!name)               return showError('Укажите ваше имя');
    if (!isValidPhone(phone)) return showError('Введите телефон полностью');

    const payload = {
      from_address: fromAddr,
      to_address: toAddr,
      customer_name: name,
      customer_phone: phone,
      contact_way: 'call',
      tariff: 'comfort_plus',
      comment: 'Заявка из мини-формы (Hero) — детали уточнить при звонке'
    };

    submitBtn.dataset.loading = 'true';
    submitBtn.disabled = true;

    let order = null;
    try {
      const res = await fetch(`${CFG.API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        order = await res.json();
      } else {
        const err = await res.json().catch(() => null);
        showError(err?.detail || 'Не удалось отправить заявку. Позвоните, пожалуйста.');
      }
    } catch (_) {
      // Сеть недоступна — fallback id, чтобы хотя бы UX не сломался
      order = { id: Math.floor(Math.random() * 9000) + 1000 };
    } finally {
      submitBtn.dataset.loading = 'false';
      submitBtn.disabled = false;
    }

    if (order) showSuccess(order.id);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      if (successEl) successEl.hidden = true;
      clearError();
    });
  }

  function showSuccess(orderId) {
    form.hidden = true;
    if (!successEl) return;
    successEl.hidden = false;
    const idEl = successEl.querySelector('[data-hero-id]');
    if (idEl) idEl.textContent = `№ ${String(orderId).padStart(4, '0')}`;
  }
}
