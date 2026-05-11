/**
 * Админка диспетчера. Single page.
 *  - Login → JWT в localStorage
 *  - Список заявок с фильтрами и поиском
 *  - Drawer карточки заявки: смена статуса, водитель, заметки, история
 *  - Экспорт CSV
 *  - Auto-refresh каждые 30 сек
 */

const CFG = (window.SOFTIP_AUTOPER_CONFIG ||= {});
CFG.API_BASE = CFG.API_BASE || (location.hostname === 'localhost' ? 'http://localhost:8000' : '');

const TOKEN_KEY = 'avtoperevozki:token';

const STATUS_LABELS = {
  new: 'Новая',
  in_work: 'В работе',
  driver_assigned: 'Водитель назначен',
  completed: 'Завершена',
  cancelled: 'Отменена'
};

const STATE = {
  user: null,
  orders: [],
  statusFilter: '',
  search: '',
  refreshTimer: null,
};

/* ========== UTILS ========== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtRub(n) {
  return (Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
}

function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function token() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function api(path, opts = {}) {
  const t = token();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${CFG.API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function toast(msg, kind = 'default') {
  const region = $('.toast-region');
  if (!region) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'success' ? ' toast--success' : kind === 'danger' ? ' toast--danger' : '');
  t.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  region.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ========== VIEWS ========== */
function showLogin() {
  $('[data-view="login"]').hidden = false;
  $('[data-view="app"]').hidden = true;
  if (STATE.refreshTimer) { clearInterval(STATE.refreshTimer); STATE.refreshTimer = null; }
}

function showApp() {
  $('[data-view="login"]').hidden = true;
  $('[data-view="app"]').hidden = false;
  if (STATE.user) {
    $('[data-user-name]').textContent = STATE.user.full_name || STATE.user.username;
    $('[data-user-initials]').textContent = initials(STATE.user.full_name || STATE.user.username);
  }
  loadAll();
  // Auto-refresh
  if (STATE.refreshTimer) clearInterval(STATE.refreshTimer);
  STATE.refreshTimer = setInterval(loadAll, 30_000);
}

/* ========== LOGIN ========== */
$('[data-login-form]').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = $('[data-login-error]');
  errEl.hidden = true;
  const fd = new FormData(e.target);
  try {
    const data = await fetch(`${CFG.API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: fd.get('username'),
        password: fd.get('password')
      })
    });
    if (!data.ok) {
      const j = await data.json().catch(() => ({}));
      throw new Error(j.detail || 'Ошибка авторизации');
    }
    const json = await data.json();
    setToken(json.access_token);
    STATE.user = json.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

$('[data-logout]').addEventListener('click', () => {
  clearToken();
  STATE.user = null;
  showLogin();
});

/* ========== STATUS FILTER + SEARCH ========== */
$$('[data-status-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('[data-status-filter]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    STATE.statusFilter = btn.dataset.statusFilter;
    loadOrders();
  });
});

let searchTimer;
$('[data-search]').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    STATE.search = e.target.value.trim();
    loadOrders();
  }, 300);
});

$('[data-refresh]').addEventListener('click', () => loadAll());

$('[data-export]').addEventListener('click', async () => {
  const t = token();
  const url = new URL(`${CFG.API_BASE}/api/orders/export/csv`);
  if (STATE.statusFilter) url.searchParams.set('status', STATE.statusFilter);

  // Fetch с авторизацией → blob → скачивание
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    toast('Не удалось экспортировать', 'danger');
  }
});

/* ========== LOAD DATA ========== */
async function loadAll() {
  try {
    const [stats, _orders] = await Promise.all([loadStats(), loadOrders()]);
  } catch (e) { console.error(e); }
}

async function loadStats() {
  const s = await api('/api/orders/stats');
  $('[data-stat-total]').textContent = s.total;
  $('[data-stat-new]').textContent = s.by_status.new || 0;
  $('[data-stat-inwork]').textContent = (s.by_status.in_work || 0) + (s.by_status.driver_assigned || 0);
  $('[data-stat-completed]').textContent = s.by_status.completed || 0;
  $('[data-stat-revenue]').textContent = fmtRub(s.revenue);
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (STATE.statusFilter) params.set('status', STATE.statusFilter);
  if (STATE.search) params.set('q', STATE.search);
  const orders = await api('/api/orders?' + params.toString());
  STATE.orders = orders;
  renderOrders();
}

function renderOrders() {
  const tbody = $('[data-orders-list]');
  if (!STATE.orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-table__empty">Заявок не найдено</td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.orders.map(o => `
    <tr data-order-id="${o.id}">
      <td class="admin-table__id">#${String(o.id).padStart(4, '0')}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>
        <div class="admin-table__route">
          <span class="admin-table__route-line admin-table__route-line--from" title="${escapeHtml(o.from_address)}">↑ ${escapeHtml(o.from_address)}</span>
          <span class="admin-table__route-line admin-table__route-line--to" title="${escapeHtml(o.to_address)}">↓ ${escapeHtml(o.to_address)}</span>
        </div>
      </td>
      <td>
        <div>${escapeHtml(o.customer_name)}</div>
        <div class="t-caption t-muted t-num">${escapeHtml(o.customer_phone)}</div>
      </td>
      <td class="admin-table__amount">${fmtRub(o.estimated_price)}<br><span class="t-caption t-muted">${o.distance_km} км</span></td>
      <td>${escapeHtml(tariffLabel(o.tariff))}</td>
      <td><span class="status-pill status-${o.status}">${escapeHtml(o.status_label)}</span></td>
      <td>${o.driver_name ? escapeHtml(o.driver_name) : '—'}</td>
    </tr>
  `).join('');

  $$('tr[data-order-id]', tbody).forEach(tr => {
    tr.addEventListener('click', () => openDrawer(+tr.dataset.orderId));
  });
}

function tariffLabel(slug) {
  return {
    standard: 'Стандарт',
    comfort: 'Комфорт',
    comfort_plus: 'Комфорт+',
    compact_van: 'Компактвэн',
    minivan: 'Минивэн',
    business: 'Бизнес',
    premium: 'Премиум',
    // обратная совместимость со старыми именами
    econom: 'Стандарт',
  }[slug] || slug;
}

/* ========== DRAWER ========== */
async function openDrawer(orderId) {
  const drawer = $('[data-drawer]');
  drawer.hidden = false;
  $('[data-drawer-id]').textContent = `#${String(orderId).padStart(4, '0')}`;
  $('[data-drawer-body]').innerHTML = '<div class="t-muted" style="padding: 32px; text-align: center;">Загрузка…</div>';

  try {
    const order = await api(`/api/orders/${orderId}`);
    renderDrawer(order);
  } catch (e) {
    $('[data-drawer-body]').innerHTML = `<div class="t-muted" style="padding: 32px; text-align: center;">Не удалось загрузить</div>`;
  }
}

function renderDrawer(o) {
  const body = $('[data-drawer-body]');
  body.innerHTML = `
    <div class="detail-section">
      <div class="detail-section__title">Маршрут</div>
      <div class="detail-row">
        <span class="detail-row__label">Откуда</span>
        <span class="detail-row__value">${escapeHtml(o.from_address)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Куда</span>
        <span class="detail-row__value">${escapeHtml(o.to_address)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Расстояние</span>
        <span class="detail-row__value detail-row__value--num">${o.distance_km} км · ~${o.duration_min} мин</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section__title">Расчёт</div>
      <div class="detail-row">
        <span class="detail-row__label">Тариф</span>
        <span class="detail-row__value">${escapeHtml(tariffLabel(o.tariff))} · ${o.rate_per_km} ₽/км</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Стоимость</span>
        <span class="detail-row__value detail-row__value--num"><strong>${fmtRub(o.estimated_price)}</strong></span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section__title">Клиент</div>
      <div class="detail-row">
        <span class="detail-row__label">Имя</span>
        <span class="detail-row__value">${escapeHtml(o.customer_name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Телефон</span>
        <span class="detail-row__value detail-row__value--num"><a href="tel:${escapeHtml(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Способ связи</span>
        <span class="detail-row__value">${escapeHtml(o.contact_way)}</span>
      </div>
      ${o.comment ? `
        <div class="detail-row">
          <span class="detail-row__label">Комментарий</span>
          <span class="detail-row__value">${escapeHtml(o.comment)}</span>
        </div>` : ''}
    </div>

    <div class="detail-section">
      <div class="detail-section__title">Статус</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="status-pill status-${o.status}">${escapeHtml(o.status_label)}</span>
      </div>
      <div class="detail-status-actions">
        ${statusActions(o)}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section__title">Водитель</div>
      <div class="field">
        <input class="input" type="text" placeholder="ФИО водителя" value="${escapeHtml(o.driver_name || '')}" data-driver-name>
      </div>
      <div class="field">
        <input class="input" type="tel" placeholder="Телефон водителя" value="${escapeHtml(o.driver_phone || '')}" data-driver-phone>
      </div>
      <button class="btn btn--brand btn--sm" data-save-driver>Сохранить</button>
    </div>

    <div class="detail-section">
      <div class="detail-section__title">Внутренняя заметка</div>
      <textarea class="textarea" placeholder="Заметка для команды (клиент не видит)" data-internal-note rows="3">${escapeHtml(o.internal_note || '')}</textarea>
      <button class="btn btn--ghost btn--sm" data-save-note>Сохранить заметку</button>
    </div>

    <div class="detail-section">
      <div class="detail-section__title">История</div>
      <div class="timeline">
        ${(o.history || []).map(h => `
          <div class="timeline-item">
            <div class="timeline-item__dot"></div>
            <div>
              <div class="timeline-item__title">${escapeHtml(h.note || STATUS_LABELS[h.status] || h.status)}</div>
              <div class="timeline-item__meta">${fmtDate(h.created_at)}${h.changed_by ? ' · ' + escapeHtml(h.changed_by) : ''}</div>
            </div>
          </div>
        `).join('') || '<div class="t-muted t-body-sm">История пуста</div>'}
      </div>
    </div>
  `;

  // Bind status-action buttons
  $$('[data-set-status]', body).forEach(b => {
    b.addEventListener('click', async () => {
      await updateOrder(o.id, { status: b.dataset.setStatus });
    });
  });
  $('[data-save-driver]', body)?.addEventListener('click', async () => {
    await updateOrder(o.id, {
      driver_name: $('[data-driver-name]', body).value.trim(),
      driver_phone: $('[data-driver-phone]', body).value.trim(),
    });
  });
  $('[data-save-note]', body)?.addEventListener('click', async () => {
    await updateOrder(o.id, { internal_note: $('[data-internal-note]', body).value });
  });
}

function statusActions(o) {
  const transitions = {
    new: ['in_work', 'cancelled'],
    in_work: ['driver_assigned', 'cancelled'],
    driver_assigned: ['completed', 'cancelled'],
    completed: [],
    cancelled: ['new'],
  };
  const targets = transitions[o.status] || [];
  if (!targets.length) return '<span class="t-caption t-muted">Финальный статус</span>';
  return targets.map(t => `
    <button class="btn btn--${t === 'cancelled' ? 'ghost' : 'brand'} btn--sm" data-set-status="${t}">
      → ${STATUS_LABELS[t]}
    </button>
  `).join('');
}

async function updateOrder(id, patch) {
  try {
    const updated = await api(`/api/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    toast('Сохранено', 'success');
    renderDrawer(updated);
    loadAll();
  } catch (e) {
    toast('Ошибка сохранения', 'danger');
  }
}

$$('[data-drawer-close]').forEach(b => b.addEventListener('click', () => {
  $('[data-drawer]').hidden = true;
}));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('[data-drawer]').hidden) {
    $('[data-drawer]').hidden = true;
  }
});

/* ========== INIT ========== */
async function init() {
  if (!token()) return showLogin();
  try {
    STATE.user = await api('/api/auth/me');
    showApp();
  } catch {
    showLogin();
  }
}

init();
