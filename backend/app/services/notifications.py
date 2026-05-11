"""
Уведомления о новых заявках. Сейчас — Telegram. Можно добавить SMTP, SMS-шлюз.

Все функции делают best-effort: если канал не настроен — просто молчат.
"""
import logging
import asyncio
import httpx

from app.core.config import settings
from app.models.order import Order, OrderStatus

log = logging.getLogger("notifications")


async def notify_new_order(order: Order) -> None:
    """Шлём уведомление диспетчерам о новой заявке."""
    coros = []
    if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
        coros.append(_send_telegram(_format_order_message(order)))
    if not coros:
        log.info("No notification channels configured; order #%s saved silently", order.id)
        return
    await asyncio.gather(*coros, return_exceptions=True)


async def notify_callback(name: str, phone: str) -> None:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID):
        return
    msg = (
        f"☎️ <b>Запрос обратного звонка</b>\n\n"
        f"<b>Имя:</b> {name}\n"
        f"<b>Телефон:</b> <code>{phone}</code>"
    )
    await _send_telegram(msg)


def _format_order_message(order: Order) -> str:
    label = OrderStatus.LABELS.get(order.status, order.status)
    return (
        f"🚗 <b>Новая заявка #{order.id}</b>\n\n"
        f"<b>От:</b> {order.from_address}\n"
        f"<b>До:</b> {order.to_address}\n"
        f"<b>Расстояние:</b> {order.distance_km} км · ~{order.duration_min} мин\n"
        f"<b>Тариф:</b> {order.tariff} ({order.rate_per_km} ₽/км)\n"
        f"<b>Стоимость:</b> {order.estimated_price} ₽\n\n"
        f"<b>Клиент:</b> {order.customer_name}\n"
        f"<b>Телефон:</b> <code>{order.customer_phone}</code>\n"
        f"<b>Связь:</b> {order.contact_way}\n"
        f"<b>Комментарий:</b> {order.comment or '—'}\n\n"
        f"<b>Статус:</b> {label}"
    )


async def _send_telegram(text: str) -> None:
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            r = await client.post(url, json={
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            })
            if r.status_code != 200:
                log.warning("Telegram returned %s: %s", r.status_code, r.text[:200])
        except Exception as e:
            log.error("Telegram send failed: %s", e)
