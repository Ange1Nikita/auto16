/**
 * Frontend config.
 *
 * 1. YANDEX_API_KEY — получите на https://developer.tech.yandex.ru/services/3
 *    (бесплатный лимит 25 000 запросов/день для JS API + Geocoder).
 *    Если оставить пустым — на месте карты будет placeholder.
 *
 * 2. API_BASE — URL FastAPI бэкенда. На дев-машине обычно localhost:8000.
 */
window.SOFTIP_AUTOPER_CONFIG = {
  YANDEX_API_KEY: '0177e3f2-0e40-49e0-92ec-eb2448437cb6',
  API_BASE: 'http://localhost:8000',   // FastAPI server
  CALLBACK_DELAY_MS: 1500,             // задержка для имитации сетевого запроса
};
