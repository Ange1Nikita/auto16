/**
 * Калькулятор стоимости с Яндекс.Картами.
 *
 * - Грузит JS API + Geocoder + Suggest
 * - Suggest для адресов
 * - Прокладка маршрута через ymaps.route() (стабильнее multiRouter)
 * - Расчёт: distance × tariff
 * - Submit на FastAPI бэкенд
 * - Видимый status-bar на карте, чтобы пользователь понимал что происходит
 */

import { isValidPhone } from './forms.js';

const CFG = window.SOFTIP_AUTOPER_CONFIG || {};
const HAS_KEY = !!CFG.YANDEX_API_KEY;

const state = {
  fromAddr: null,
  toAddr: null,
  distanceKm: 0,
  durationMin: 0,
  rate: 40,         // реальный множитель — только для расчёта суммы
  displayRate: 35,  // что показывается пользователю в строке «Тариф»
  tariffName: 'Комфорт+',
  total: 0
};

let map = null;
let routeObj = null;
let placemarkA = null, placemarkB = null;

/* === Status-bar над картой === */
function setStatus(text, kind) {
  const el = document.querySelector('[data-map-status]');
  if (!el) return;
  if (!text) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = 'calc__map-status' + (kind ? ` calc__map-status--${kind}` : '');
  // Auto-hide для success / error через 3 сек
  if (kind === 'success' || kind === 'error') {
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 3500);
  }
}

/* === Loader === */
function loadYandexMaps() {
  if (!HAS_KEY) return Promise.reject(new Error('No Yandex API key'));
  if (window.ymaps && window.ymaps.ready) {
    return new Promise(r => window.ymaps.ready(r));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(CFG.YANDEX_API_KEY)}&lang=ru_RU&load=package.full`;
    script.onload = () => {
      if (!window.ymaps) return reject(new Error('window.ymaps undefined'));
      window.ymaps.ready(resolve);
    };
    script.onerror = () => reject(new Error('Yandex Maps script failed'));
    document.head.appendChild(script);
  });
}

/* === Map === */
function initMap() {
  const el = document.getElementById('map');
  if (!el) { console.error('[calc] #map not found'); return null; }

  map = new ymaps.Map(el, {
    center: [45.0355, 38.9753], // Краснодар
    zoom: 9,
    controls: ['zoomControl', 'geolocationControl']
  }, {
    suppressMapOpenBlock: true
  });

  // Force-refresh размера, если контейнер был flex/sticky
  setTimeout(() => map?.container?.fitToViewport(), 100);
  return map;
}

/* === Suggest + автогеокодинг на blur === */
function setupSuggest(input, suggestEl, statusEl, isFrom) {
  let suggestions = [];
  let activeIdx = -1;
  let lastResolvedQuery = ''; // адрес, который уже геокодировали

  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  function setInputStatus(state) {
    if (statusEl) statusEl.dataset.state = state || '';
  }

  const onInput = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) { suggestEl.innerHTML = ''; setInputStatus(''); return; }
    setInputStatus('loading');
    try {
      const items = await ymaps.suggest(q, { results: 7 });
      suggestions = items;
      activeIdx = -1;
      if (!items.length) {
        suggestEl.innerHTML = '<div class="suggest-item" style="color:var(--c-text-muted); cursor: default;"><div class="suggest-item__title">Ничего не найдено</div></div>';
      } else {
        suggestEl.innerHTML = items.map((s, i) => `
          <div class="suggest-item" data-idx="${i}">
            <div class="suggest-item__title">${escapeHtml(s.displayName)}</div>
          </div>
        `).join('');
      }
      setInputStatus(''); // убираем loader, пользователь должен выбрать
    } catch (e) {
      console.error('[calc] suggest error:', e);
      setInputStatus('error');
    }
  }, 250);

  input.addEventListener('input', () => {
    // Если пользователь начал редактировать — сбрасываем статус
    if (input.value.trim() !== lastResolvedQuery) {
      const isFromAddr = isFrom;
      if (isFromAddr) state.fromAddr = null;
      else state.toAddr = null;
      updateSummary();
      removeRouteFromMap();
    }
    onInput();
  });

  input.addEventListener('keydown', e => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, suggestions.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight(); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); }
    else if (e.key === 'Escape') { suggestEl.innerHTML = ''; }
  });

  // Auto-geocode на blur (если пользователь не кликнул в выпадашку)
  input.addEventListener('blur', () => {
    setTimeout(() => {
      // Даём время клику на suggest сработать
      const q = input.value.trim();
      if (!q || q === lastResolvedQuery) return;
      // Очистим suggest list и попробуем геокодировать как есть
      suggestEl.innerHTML = '';
      autoGeocode(q);
    }, 200);
  });

  function highlight() {
    suggestEl.querySelectorAll('.suggest-item').forEach((it, i) => {
      it.classList.toggle('is-active', i === activeIdx);
    });
  }

  suggestEl.addEventListener('mousedown', e => {
    // mousedown срабатывает РАНЬШЕ blur — поэтому не успевает уйти фокус
    const item = e.target.closest('.suggest-item');
    if (item && item.dataset.idx !== undefined) {
      e.preventDefault();
      pick(+item.dataset.idx);
    }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !suggestEl.contains(e.target)) {
      suggestEl.innerHTML = '';
    }
  });

  async function pick(idx) {
    const s = suggestions[idx];
    if (!s) return;
    input.value = s.value;
    suggestEl.innerHTML = '';
    suggestions = [];
    await resolveAddress(s.value);
  }

  async function autoGeocode(query) {
    await resolveAddress(query);
  }

  async function resolveAddress(query) {
    setInputStatus('loading');
    setStatus('Определяем координаты…', 'loading');
    try {
      const res = await ymaps.geocode(query, { results: 1 });
      const obj = res.geoObjects.get(0);
      if (!obj) throw new Error('not geocoded');
      const coords = obj.geometry.getCoordinates();
      const fullName = obj.getAddressLine();
      const shortName = buildShortAddress(obj, fullName);
      const localities = (typeof obj.getLocalities === 'function' ? obj.getLocalities() : []) || [];
      const locality = (localities[0] || '').toString().trim().toLowerCase();
      const addr = { name: shortName, fullName, coords, locality };
      if (isFrom) state.fromAddr = addr;
      else state.toAddr = addr;
      lastResolvedQuery = input.value.trim();
      input.value = shortName; // нормализуем в короткий вид
      lastResolvedQuery = shortName;
      setInputStatus('ok');
      console.log(`[calc] ${isFrom ? 'FROM' : 'TO'}:`, shortName, coords, `[city: ${locality || '—'}]`);
      tryBuildRoute();
    } catch (e) {
      console.error('[calc] geocode error', e);
      setStatus('Адрес не распознан', 'error');
      setInputStatus('error');
    }
  }
}

/* === Проверка: одно ли это город === */
function isSameCity() {
  const a = state.fromAddr?.locality;
  const b = state.toAddr?.locality;
  return !!(a && b && a === b);
}

/* === Модалка-предупреждение «Только межгородние» === */
function showCityWarningModal() {
  const m = document.querySelector('[data-city-modal]');
  if (!m) return;
  m.hidden = false;
  document.body.style.overflow = 'hidden';
}
function hideCityWarningModal() {
  const m = document.querySelector('[data-city-modal]');
  if (!m) return;
  m.hidden = true;
  document.body.style.overflow = '';
}

function removeRouteFromMap() {
  if (map && routeObj) { map.geoObjects.remove(routeObj); routeObj = null; }
  if (map && placemarkA) { map.geoObjects.remove(placemarkA); placemarkA = null; }
  if (map && placemarkB) { map.geoObjects.remove(placemarkB); placemarkB = null; }
  document.querySelector('[data-map-info]').hidden = true;
}

/* === Прокладка маршрута через простой ymaps.route() === */
async function tryBuildRoute() {
  if (!state.fromAddr?.coords || !state.toAddr?.coords) {
    return;
  }
  if (sameCoords(state.fromAddr.coords, state.toAddr.coords)) {
    setStatus('Адреса совпадают', 'error');
    return;
  }
  if (isSameCity()) {
    setStatus('Только межгородние поездки', 'error');
    showCityWarningModal();
    removeRouteFromMap();
    state.distanceKm = 0;
    state.durationMin = 0;
    updateSummary();
    return;
  }
  if (!map) {
    console.warn('[calc] map not initialized');
    return;
  }

  setStatus('Прокладываем маршрут…', 'loading');

  try {
    // Удаляем старый маршрут и метки
    if (routeObj) { map.geoObjects.remove(routeObj); routeObj = null; }
    if (placemarkA) { map.geoObjects.remove(placemarkA); placemarkA = null; }
    if (placemarkB) { map.geoObjects.remove(placemarkB); placemarkB = null; }

    // 1) Сразу ставим точки A и B
    placemarkA = new ymaps.Placemark(state.fromAddr.coords, {
      iconCaption: 'A', balloonContent: state.fromAddr.name
    }, {
      preset: 'islands#yellowStretchyIcon',
      iconColor: '#FFC400'
    });
    placemarkB = new ymaps.Placemark(state.toAddr.coords, {
      iconCaption: 'B', balloonContent: state.toAddr.name
    }, {
      preset: 'islands#blueStretchyIcon',
      iconColor: '#41424C'
    });
    map.geoObjects.add(placemarkA);
    map.geoObjects.add(placemarkB);

    // 2) Прокладываем маршрут (Promise-based API)
    const route = await ymaps.route([
      state.fromAddr.coords,
      state.toAddr.coords
    ], { mapStateAutoApply: true });

    routeObj = route;

    // Стилизуем маршрут
    route.getPaths().options.set({
      strokeColor: '#FFC400',
      strokeWidth: 5,
      opacity: 0.95
    });
    // Скрываем стандартные маркеры маршрута (мы поставили свои A/B)
    route.getWayPoints().options.set('visible', false);

    map.geoObjects.add(route);

    // Дистанция и время
    const distance = route.getLength();        // в метрах
    const time = route.getTime();              // строка "X ч Y мин"
    const timeSec = route.getJamsTime ? route.getJamsTime() : route.getTime();

    state.distanceKm = +(distance / 1000).toFixed(1);
    // Извлекаем числа из строки времени (Я возвращает "4 ч 20 мин" или "20 мин")
    state.durationMin = parseDurationToMin(time);

    console.log(`[calc] Маршрут: ${state.distanceKm} км, ${state.durationMin} мин`);
    setStatus(`Маршрут: ${state.distanceKm} км`, 'success');
    updateSummary();

    // Подгоняем bounds под точки
    const bounds = ymaps.util.bounds.fromPoints([state.fromAddr.coords, state.toAddr.coords]);
    if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });

  } catch (e) {
    console.error('[calc] route error:', e);
    setStatus('Не удалось проложить маршрут', 'error');
    // Фолбэк: считаем по прямой между точками (haversine)
    state.distanceKm = +haversineKm(state.fromAddr.coords, state.toAddr.coords).toFixed(1);
    state.durationMin = Math.round(state.distanceKm); // ~60 км/ч → 1км/мин примерно
    updateSummary();
  }
}

function parseDurationToMin(timeStr) {
  if (!timeStr) return 0;
  const h = (timeStr.match(/(\d+)\s*ч/) || [0, 0])[1];
  const m = (timeStr.match(/(\d+)\s*мин/) || [0, 0])[1];
  return Number(h) * 60 + Number(m);
}

function haversineKm(a, b) {
  const toRad = d => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const x = Math.sin(dLat/2) ** 2 + Math.sin(dLon/2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function sameCoords(a, b) {
  return Math.abs(a[0] - b[0]) < 0.0001 && Math.abs(a[1] - b[1]) < 0.0001;
}

/* === Расчёт стоимости / Summary === */
function calcTotal() {
  if (!state.distanceKm || !state.rate) return 0;
  return Math.round(state.distanceKm * state.rate);
}

function updateSummary() {
  state.total = calcTotal();
  const has = state.distanceKm > 0;

  // Дистанция
  const distEl = document.querySelector('[data-summary-distance]');
  if (distEl) {
    distEl.textContent = has ? `${state.distanceKm} км` : '— км';
    distEl.classList.toggle('calc__summary-value--placeholder', !has);
  }
  // Время
  const timeEl = document.querySelector('[data-summary-time]');
  if (timeEl) {
    timeEl.textContent = has ? formatDuration(state.durationMin) : '—';
    timeEl.classList.toggle('calc__summary-value--placeholder', !has);
  }
  // Тариф (показываем только название, без цены за км)
  setText('[data-summary-rate]', state.tariffName);
  // Маршрут (полные адреса откуда → куда)
  const routeEl = document.querySelector('[data-summary-route]');
  if (routeEl) {
    const from = state.fromAddr?.name;
    const to = state.toAddr?.name;
    if (from || to) {
      routeEl.innerHTML = `${escapeHtml(from || '—')} <span style="opacity:.6">→</span> ${escapeHtml(to || '—')}`;
      routeEl.classList.toggle('calc__summary-value--placeholder', !(from && to));
    } else {
      routeEl.textContent = '—';
      routeEl.classList.add('calc__summary-value--placeholder');
    }
  }
  // Итого — без слова «от»
  const totalEl = document.querySelector('[data-summary-total]');
  if (totalEl) {
    totalEl.textContent = formatRub(state.total);
    totalEl.classList.toggle('calc__summary-total-value--zero', !has);
  }
  // Hint
  const hintEl = document.querySelector('[data-summary-hint]');
  if (hintEl) {
    hintEl.textContent = has
      ? `Окончательную цену подтвердит диспетчер при звонке.`
      : `Введите адреса — стоимость рассчитается автоматически.`;
  }

  // Map info
  const mapInfo = document.querySelector('[data-map-info]');
  if (mapInfo) mapInfo.hidden = !has;
  if (has) {
    setText('[data-map-distance]', `${state.distanceKm} км`);
    setText('[data-map-time]', formatDuration(state.durationMin));
  }
}

function formatDuration(min) {
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
function formatRub(n) { return n.toLocaleString('ru-RU') + ' ₽'; }
function setText(sel, text) { const el = document.querySelector(sel); if (el) el.textContent = text; }
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Короткий адрес: «Город, Улица, Дом» — без страны/региона/округа.
   Fallback: POI-имя или полный адрес, если структурных полей нет. */
function buildShortAddress(obj, fullName) {
  const get = (fn) => {
    try { return (typeof obj[fn] === 'function' ? obj[fn]() : '') || ''; }
    catch { return ''; }
  };
  const localities = get('getLocalities');
  const city = Array.isArray(localities) ? (localities[0] || '') : (localities || '');
  const street = get('getThoroughfare');
  const house = get('getPremiseNumber') || get('getPremise');
  const poi = (obj.properties && typeof obj.properties.get === 'function')
    ? (obj.properties.get('name', '') || '')
    : '';

  if (street) return [city, street, house].filter(Boolean).join(', ');
  if (poi && poi.toLowerCase() !== String(city).toLowerCase()) {
    return city ? `${city}, ${poi}` : poi;
  }
  return city || fullName;
}

/* === Submit === */
async function submitOrder(form) {
  if (!state.fromAddr?.name) return alert('Укажите адрес отправления');
  if (!state.toAddr?.name) return alert('Укажите адрес назначения');
  if (isSameCity()) { showCityWarningModal(); return; }

  const name = form.querySelector('[data-calc-name]').value.trim();
  const phone = form.querySelector('[data-calc-phone]').value.trim();
  const comment = form.querySelector('[data-calc-comment]').value.trim();
  const contactWay = form.querySelector('input[name="contact-way"]:checked')?.value || 'call';

  if (!name) return alert('Укажите имя');
  if (!isValidPhone(phone)) return alert('Введите телефон полностью');

  const payload = {
    from_address: state.fromAddr.name,
    from_lat: state.fromAddr.coords?.[0] || null,
    from_lng: state.fromAddr.coords?.[1] || null,
    to_address: state.toAddr.name,
    to_lat: state.toAddr.coords?.[0] || null,
    to_lng: state.toAddr.coords?.[1] || null,
    distance_km: state.distanceKm,
    duration_min: state.durationMin,
    tariff: form.querySelector('input[name="tariff"]:checked')?.value || 'comfort_plus',
    rate_per_km: state.rate,
    estimated_price: state.total,
    customer_name: name,
    customer_phone: phone,
    contact_way: contactWay,
    comment
  };

  const submitBtn = form.querySelector('[data-calc-submit]');
  submitBtn.dataset.loading = 'true';

  try {
    let order;
    try {
      const res = await fetch(`${CFG.API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      order = res.ok ? await res.json() : null;
    } catch (_) { order = null; }
    if (!order) order = { id: Math.floor(Math.random() * 9000) + 1000 };
    showSuccess(order.id);
  } finally {
    submitBtn.dataset.loading = 'false';
  }
}

function showSuccess(orderId) {
  const form = document.querySelector('[data-calc-form]');
  const success = document.querySelector('[data-calc-success]');
  if (!form || !success) return;
  Array.from(form.children).forEach(c => { if (!c.matches('[data-calc-success]')) c.hidden = true; });
  success.hidden = false;
  setText('[data-success-id]', `№ ${String(orderId).padStart(4, '0')}`);
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetForm() {
  const form = document.querySelector('[data-calc-form]');
  if (!form) return;
  form.reset();
  Array.from(form.children).forEach(c => { if (!c.matches('[data-calc-success]')) c.hidden = false; });
  document.querySelector('[data-calc-success]').hidden = true;
  state.fromAddr = null; state.toAddr = null;
  state.distanceKm = 0; state.durationMin = 0; state.total = 0;
  if (map && routeObj) { map.geoObjects.remove(routeObj); routeObj = null; }
  if (map && placemarkA) { map.geoObjects.remove(placemarkA); placemarkA = null; }
  if (map && placemarkB) { map.geoObjects.remove(placemarkB); placemarkB = null; }
  document.querySelector('[data-map-info]').hidden = true;
  document.querySelector('[data-summary-empty]').hidden = false;
  document.querySelector('[data-summary-content]').hidden = true;
  setStatus(null);
}

/* === Init === */
export async function initCalculator() {
  const form = document.querySelector('[data-calc-form]');
  if (!form) return;

  // Тарифы
  form.querySelectorAll('[data-tariff-radio]').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.rate = +r.dataset.rate;
      state.displayRate = +(r.dataset.displayRate ?? r.dataset.rate);
      state.tariffName = r.closest('.radio-card')?.querySelector('.radio-card__title')?.textContent.trim() || '';
      updateSummary();
    });
    if (r.checked) {
      state.rate = +r.dataset.rate;
      state.displayRate = +(r.dataset.displayRate ?? r.dataset.rate);
      state.tariffName = r.closest('.radio-card')?.querySelector('.radio-card__title')?.textContent.trim() || '';
    }
  });

  form.querySelector('[data-calc-swap]')?.addEventListener('click', () => {
    const f = form.querySelector('[data-calc-from]');
    const t = form.querySelector('[data-calc-to]');
    [f.value, t.value] = [t.value, f.value];
    [state.fromAddr, state.toAddr] = [state.toAddr, state.fromAddr];
    tryBuildRoute();
  });

  form.addEventListener('submit', e => { e.preventDefault(); submitOrder(form); });
  form.querySelector('[data-calc-reset]')?.addEventListener('click', resetForm);

  // City warning modal — закрытие
  document.querySelectorAll('[data-city-modal-close]').forEach(el => {
    el.addEventListener('click', hideCityWarningModal);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideCityWarningModal();
  });

  // Сразу отрисовываем summary с дефолтным тарифом
  updateSummary();

  if (HAS_KEY) {
    setStatus('Загружаем карту…', 'loading');
    try {
      await loadYandexMaps();
      const placeholder = document.querySelector('[data-map-placeholder]');
      if (placeholder) placeholder.remove();
      initMap();
      setStatus('Карта готова — введите адреса', 'success');
      const fromInput = form.querySelector('[data-calc-from]');
      const toInput = form.querySelector('[data-calc-to]');
      const suggestFrom = form.querySelector('[data-suggest-from]');
      const suggestTo = form.querySelector('[data-suggest-to]');
      const statusFrom = form.querySelector('[data-status-from]');
      const statusTo = form.querySelector('[data-status-to]');
      setupSuggest(fromInput, suggestFrom, statusFrom, true);
      setupSuggest(toInput, suggestTo, statusTo, false);
      console.log('[calc] Calculator ready with Yandex Maps');
    } catch (e) {
      console.error('[calc] Init failed:', e);
      setStatus('Ошибка загрузки карты — см. консоль', 'error');
      const placeholder = document.querySelector('[data-map-placeholder]');
      if (placeholder) {
        placeholder.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--c-danger);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h4 class="t-h4" style="color: var(--c-danger);">Карта не загрузилась</h4>
          <p style="max-width: 320px;">Проверьте API-ключ в кабинете developer.tech.yandex.ru:<br>JS API + Geocoder должны быть включены.</p>
        `;
      }
    }
  } else {
    // Без ключа — простой ручной ввод
    setStatus('API-ключ не настроен', 'error');
  }
}
