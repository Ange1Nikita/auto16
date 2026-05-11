/**
 * Секция «Наш парк»: рендер сетки машин + фильтрация по классу + lightbox с галереей.
 *
 * Данные берутся из FLEET ниже. Фото лежат в /assets/cars/{slug}/{1..N}.jpg
 */

const FLEET = [
  // Стандарт — от 25 ₽/км
  { slug: 'polo',     name: 'VW Polo',          tariff: 'standard',     tariffLabel: 'Стандарт',   desc: 'Седан · 4 двери · АКПП', photos: 2, seats: 4, luggage: 'средний' },
  { slug: 'rio',      name: 'Kia Rio',          tariff: 'standard',     tariffLabel: 'Стандарт',   desc: 'Седан · 4 двери · АКПП', photos: 2, seats: 4, luggage: 'средний' },
  { slug: 'vesta',    name: 'Lada Vesta',       tariff: 'standard',     tariffLabel: 'Стандарт',   desc: 'Седан · отечественный', photos: 3, seats: 4, luggage: 'средний' },

  // Комфорт — от 30 ₽/км
  { slug: 'elantra',  name: 'Hyundai Elantra',  tariff: 'comfort',      tariffLabel: 'Комфорт',    desc: 'Седан · просторный салон', photos: 1, seats: 4, luggage: 'большой' },
  { slug: 'sonata',   name: 'Hyundai Sonata',   tariff: 'comfort',      tariffLabel: 'Комфорт',    desc: 'Седан · комфортный', photos: 1, seats: 4, luggage: 'большой' },
  { slug: 'passat',   name: 'VW Passat',        tariff: 'comfort',      tariffLabel: 'Комфорт',    desc: 'Седан · европейское качество', photos: 3, seats: 4, luggage: 'большой' },

  // Комфорт+ — от 35 ₽/км
  { slug: 'k5',       name: 'Kia K5',           tariff: 'comfort_plus', tariffLabel: 'Комфорт+',   desc: 'Премиум-седан · кожа · LED', photos: 5, seats: 4, luggage: 'большой' },

  // Компактвэн — от 40 ₽/км
  { slug: 'zafira',   name: 'Opel Zafira',      tariff: 'compact_van',  tariffLabel: 'Компактвэн', desc: 'Компактвэн · 5–7 мест · трансформер', photos: 3, seats: 7, luggage: 'XL' },

  // Минивэн — от 45 ₽/км
  { slug: 'palisade', name: 'Hyundai Palisade', tariff: 'minivan',      tariffLabel: 'Минивэн',    desc: 'Внедорожник · до 8 мест', photos: 2, seats: 8, luggage: 'XL' },

  // Бизнес — от 50 ₽/км
  { slug: 'bmw-5',    name: 'BMW 5 серии',      tariff: 'business',     tariffLabel: 'Бизнес',     desc: '5-серия · спортивный комфорт', photos: 4, seats: 3, luggage: 'премиум' },
  { slug: 'a6',       name: 'Audi A6',          tariff: 'business',     tariffLabel: 'Бизнес',     desc: 'A6 · технологичный салон', photos: 3, seats: 3, luggage: 'премиум' },
  { slug: 'glc',      name: 'Mercedes GLC',     tariff: 'business',     tariffLabel: 'Бизнес',     desc: 'Кроссовер · просторный', photos: 1, seats: 4, luggage: 'премиум' },

  // Премиум — от 100 ₽/км
  { slug: 'e-class',  name: 'Mercedes E-class', tariff: 'premium',      tariffLabel: 'Премиум',    desc: 'E-класс · флагманский премиум-седан', photos: 5, seats: 3, luggage: 'премиум' },
];

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function carPhoto(slug, idx) {
  return `assets/cars/${slug}/${idx}.jpg`;
}

function renderFleetCards() {
  const grid = document.querySelector('[data-fleet-grid]');
  if (!grid) return;

  grid.innerHTML = FLEET.map(car => `
    <div class="fleet-card" data-car-slug="${car.slug}" data-car-tariff="${car.tariff}">
      <div class="fleet-card__photo">
        <img src="${carPhoto(car.slug, 1)}" alt="${escapeHtml(car.name)}" loading="lazy">
        <span class="fleet-card__class">${escapeHtml(car.tariffLabel)}</span>
        ${car.photos > 1 ? `
          <span class="fleet-card__photo-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            ${car.photos}
          </span>` : ''}
      </div>
      <div class="fleet-card__body">
        <div class="fleet-card__name">${escapeHtml(car.name)}</div>
        <div class="fleet-card__desc">${escapeHtml(car.desc)}</div>
        <div class="fleet-card__features">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${car.seats} мест
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            ${escapeHtml(car.luggage)}
          </span>
        </div>
      </div>
    </div>
  `).join('');

  // Bind клики на карточки → открыть lightbox
  grid.querySelectorAll('[data-car-slug]').forEach(card => {
    card.addEventListener('click', () => {
      const slug = card.dataset.carSlug;
      const car = FLEET.find(c => c.slug === slug);
      if (car) openLightbox(car);
    });
  });
}

/* Filters */
function bindFilters() {
  const buttons = document.querySelectorAll('[data-fleet-filter]');
  const cards = () => document.querySelectorAll('.fleet-card');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      const filter = btn.dataset.fleetFilter;
      cards().forEach(card => {
        const match = filter === 'all' || card.dataset.carTariff === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });
}

/* === LIGHTBOX === */
const LB_STATE = {
  car: null,
  index: 0,
  photos: []
};

function openLightbox(car) {
  LB_STATE.car = car;
  LB_STATE.index = 0;
  LB_STATE.photos = Array.from({ length: car.photos }, (_, i) => carPhoto(car.slug, i + 1));

  const lb = document.querySelector('[data-lightbox]');
  document.querySelector('[data-lightbox-title]').textContent = `${car.name} · ${car.tariffLabel}`;
  renderLightbox();
  lb.hidden = false;
  document.body.classList.add('no-scroll');
}

function closeLightbox() {
  const lb = document.querySelector('[data-lightbox]');
  lb.hidden = true;
  document.body.classList.remove('no-scroll');
}

function renderLightbox() {
  const { photos, index } = LB_STATE;
  const img = document.querySelector('[data-lightbox-img]');
  const counter = document.querySelector('[data-lightbox-counter]');
  const prev = document.querySelector('[data-lightbox-prev]');
  const next = document.querySelector('[data-lightbox-next]');
  const thumbs = document.querySelector('[data-lightbox-thumbs]');

  img.src = photos[index];
  img.style.animation = 'none';
  // Перезапуск анимации
  // eslint-disable-next-line
  img.offsetHeight;
  img.style.animation = '';

  counter.textContent = `${index + 1} / ${photos.length}`;
  prev.disabled = index === 0;
  next.disabled = index === photos.length - 1;

  thumbs.innerHTML = photos.map((src, i) => `
    <div class="lightbox__thumb ${i === index ? 'is-active' : ''}" data-thumb-idx="${i}">
      <img src="${src}" alt="">
    </div>
  `).join('');
  thumbs.querySelectorAll('[data-thumb-idx]').forEach(t => {
    t.addEventListener('click', () => {
      LB_STATE.index = +t.dataset.thumbIdx;
      renderLightbox();
    });
  });

  // Скрыть thumbs если только одно фото
  thumbs.style.display = photos.length > 1 ? '' : 'none';
}

function lbPrev() {
  if (LB_STATE.index > 0) { LB_STATE.index--; renderLightbox(); }
}
function lbNext() {
  if (LB_STATE.index < LB_STATE.photos.length - 1) { LB_STATE.index++; renderLightbox(); }
}

function bindLightbox() {
  document.querySelector('[data-lightbox-close]')?.addEventListener('click', closeLightbox);
  document.querySelector('[data-lightbox-prev]')?.addEventListener('click', lbPrev);
  document.querySelector('[data-lightbox-next]')?.addEventListener('click', lbNext);

  // Клик по фону закрывает
  document.querySelector('[data-lightbox]')?.addEventListener('click', e => {
    if (e.target.matches('[data-lightbox]') || e.target.classList.contains('lightbox__main')) {
      closeLightbox();
    }
  });

  // Стрелки + ESC
  document.addEventListener('keydown', e => {
    const lb = document.querySelector('[data-lightbox]');
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbPrev();
    else if (e.key === 'ArrowRight') lbNext();
  });
}

export function initFleet() {
  if (!document.querySelector('[data-fleet-grid]')) return;
  renderFleetCards();
  bindFilters();
  bindLightbox();
}
