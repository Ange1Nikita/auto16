# Автоперевозки — лендинг + калькулятор + диспетчерская

Полнофункциональный проект:
- **Лендинг** с интерактивным калькулятором заказа (Яндекс.Карты)
- **REST API** на FastAPI с SQLite
- **Админка диспетчера** для приёма и обработки заявок
- **Telegram-уведомления** о новых заявках

## Структура

```
Автоперевозки/
├── frontend/                ← Лендинг + Админка (статика)
│   ├── index.html              лендинг
│   ├── css/                    дизайн-система
│   ├── js/                     модули фронта
│   │   ├── config.js           ⚠ настроить ключ Yandex Maps
│   │   ├── main.js
│   │   └── modules/
│   └── admin/                  админка диспетчера
│       ├── index.html
│       ├── admin.css
│       └── admin.js
│
├── backend/                 ← FastAPI + SQLite
│   ├── app/
│   │   ├── main.py             entry point
│   │   ├── core/               config, database, security
│   │   ├── models/             SQLAlchemy
│   │   ├── schemas/            Pydantic
│   │   ├── api/                REST endpoints
│   │   └── services/           auth, notifications, seed
│   ├── requirements.txt
│   └── .env.example            ⚠ скопировать в .env и заполнить
│
└── README.md
```

---

## Быстрый старт

### 1. Бэкенд (FastAPI + SQLite)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Настройка
copy .env.example .env
# (отредактировать .env: SECRET_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)

# Запуск
uvicorn app.main:app --reload --port 8000
```

Сервер доступен на `http://localhost:8000`:
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

При первом запуске автоматически создаётся:
- `avtoperevozki.db` (SQLite)
- Дефолтный админ: `admin / admin` (поменяйте в `.env`)

### 2. Фронтенд (статический сайт)

В отдельном терминале:

```powershell
cd frontend
python -m http.server 8080
```

- **Лендинг:** <http://localhost:8080/>
- **Диспетчерская:** <http://localhost:8080/admin/>

При первом входе в админку используйте `admin / admin`.

---

## Настройка Яндекс.Карт

Калькулятор использует Yandex Maps JS API + Geocoder.

1. Зайдите на <https://developer.tech.yandex.ru/services/3>
2. Создайте приложение → выберите тарифы:
   - **JavaScript API и HTTP Геокодер** (бесплатно до 25 000 запросов/день)
3. Получите API-ключ
4. Откройте `frontend/js/config.js` и вставьте его:

```js
window.SOFTIP_AUTOPER_CONFIG = {
  YANDEX_API_KEY: 'ваш-ключ-сюда',
  API_BASE: 'http://localhost:8000',
};
```

Без ключа — на месте карты будет placeholder, но сам калькулятор будет работать с упрощённой имитацией расстояния (для демо).

---

## Настройка Telegram-уведомлений

При новой заявке диспетчерам приходит сообщение:

> 🚗 Новая заявка #1234
> От: Краснодар, ул. Северная 1
> До: Сочи, аэропорт
> Расстояние: 285 км · ~4 ч 20 мин
> Тариф: comfort (32 ₽/км)
> Стоимость: 9 120 ₽
> ...

### Создание бота

1. Откройте `@BotFather` в Telegram → `/newbot` → получите токен
2. Создайте группу диспетчеров → добавьте бота
3. Узнайте `chat_id` группы:
   - Добавьте `@RawDataBot` в группу — он покажет `chat.id` (часто отрицательное число)
4. Заполните в `.env`:

```
TELEGRAM_BOT_TOKEN=123456:AAAAA...
TELEGRAM_CHAT_ID=-1001234567890
```

5. Перезапустите бэкенд

---

## API endpoints

| Метод  | URL                                | Назначение                          | Авторизация |
|--------|------------------------------------|-------------------------------------|-------------|
| POST   | `/api/orders`                      | Создать заявку (с лендинга)         | —           |
| POST   | `/api/callback`                    | Заказ обратного звонка              | —           |
| POST   | `/api/auth/login`                  | Логин диспетчера → JWT             | —           |
| GET    | `/api/auth/me`                     | Текущий пользователь                | Bearer      |
| GET    | `/api/orders`                      | Список заявок (фильтры, поиск)      | Bearer      |
| GET    | `/api/orders/{id}`                 | Карточка заявки + история           | Bearer      |
| PATCH  | `/api/orders/{id}`                 | Обновить статус, водителя, заметку  | Bearer      |
| GET    | `/api/orders/stats`                | Статистика по статусам и выручке    | Bearer      |
| GET    | `/api/orders/export/csv`           | Экспорт заявок в CSV (для Excel)    | Bearer      |
| GET    | `/api/callback`                    | Список запросов обратного звонка    | Bearer      |
| PATCH  | `/api/callback/{id}`               | Пометить как обработанный           | Bearer      |

Все детали — в Swagger UI на `/docs`.

---

## Поток работы

1. **Клиент заходит на лендинг** → жмёт «Рассчитать»
2. **Калькулятор**:
   - Вводит адреса → автокомплит через Yandex Suggest
   - Выбирает класс авто (тариф)
   - На карте строится маршрут, считается расстояние и стоимость
   - Заполняет имя/телефон → отправляет
3. **Бэкенд**:
   - Сохраняет в `orders` со статусом `new`
   - Шлёт уведомление в Telegram (фоном)
   - Возвращает фронту id заявки
4. **Диспетчер видит в админке**:
   - В шапке счётчик новых
   - Таблица с фильтрами по статусу/тарифу + поиск
   - Открывает карточку → меняет статус, назначает водителя, оставляет заметку
   - Статусы: `Новая → В работе → Водитель назначен → Завершена / Отменена`
5. **CSV-экспорт** для отчётности

---

## Безопасность

- Пароли — bcrypt (passlib)
- Токены — JWT (python-jose), 8 часов по умолчанию
- CORS настраивается через `CORS_ORIGINS` в `.env`
- IP клиента и user-agent сохраняются в `orders` для аналитики
- Согласие на ПДн (152-ФЗ) — обязательный чекбокс перед отправкой
- В проде:
  - Поменять `SECRET_KEY` и пароль `admin`
  - Подключить HTTPS
  - Добавить rate-limit и капчу на публичные endpoint'ы
  - Перевести БД на PostgreSQL (изменить `DATABASE_URL`)

---

## Что реализовано

- ✅ Лендинг: Hero, преимущества, тарифы (4 класса), отзывы, контакты, финальный CTA
- ✅ Калькулятор с Яндекс.Картами (suggest, маршрут, расчёт)
- ✅ 4 класса авто с разными тарифами
- ✅ Форма заявки с валидацией + обратный звонок
- ✅ FastAPI бэкенд с SQLite, JWT-авторизацией, REST
- ✅ Админка диспетчера: список заявок, фильтры, поиск, drawer-карточка, смена статусов, водитель, заметки, история, экспорт CSV
- ✅ Telegram-уведомления о новых заявках и обратных звонках
- ✅ Адаптивная вёрстка mobile-first
- ✅ Sticky CTA на мобильном
- ✅ Reduced-motion и a11y

## Что добавить в проде

- 🔲 reCAPTCHA / hCaptcha на формах
- 🔲 SMTP-уведомления (заготовка в `notifications.py`)
- 🔲 SMS-шлюз (например, SMSC.ru)
- 🔲 Доменное имя + HTTPS
- 🔲 PostgreSQL вместо SQLite
- 🔲 Кастомный логотип и фотоконтент
- 🔲 Реальные отзывы клиентов
- 🔲 Политика обработки ПДн и оферта (страницы)
- 🔲 Sitemap.xml и robots.txt
- 🔲 Микроразметка LocalBusiness/Service для SEO

---

## Разработка

### Создать миграцию БД (когда добавите Alembic)

```powershell
cd backend
alembic init alembic
alembic revision --autogenerate -m "init"
alembic upgrade head
```

Сейчас структура создаётся автоматом через `Base.metadata.create_all()` при старте — для прототипа этого достаточно.

### Добавить нового диспетчера

Через Python REPL:

```python
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User

db = SessionLocal()
db.add(User(
    username='dispatcher_1',
    password_hash=hash_password('strong_password_123'),
    full_name='Иван Иванов',
    role='dispatcher',
    is_active=True,
))
db.commit()
```

Или сделать `POST /api/users` endpoint (не реализован — добавить при необходимости).

---

## Лицензия

Proprietary. Заказчик: ООО «Автоперевозки».
