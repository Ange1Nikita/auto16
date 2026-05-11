"""
Утилита для получения TELEGRAM_CHAT_ID.

Как использовать:
1. Запустить: python get_chat_id.py
2. В Telegram написать боту любое сообщение (например /start)
3. Если нужно отправлять в группу — добавьте бота в группу и напишите там что-нибудь.
4. Скрипт покажет все chat_id из последних обновлений.

После — впишите нужный chat_id в .env (TELEGRAM_CHAT_ID=...) и перезапустите бэкенд.

ВАЖНО: для групп — chat_id обычно отрицательное число (-1001234567890).
       Для личных сообщений — обычное положительное число.
"""
import os
import sys
import urllib.request
import urllib.error
import json


def main():
    # Загружаем токен из .env
    token = ""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("TELEGRAM_BOT_TOKEN="):
                    token = line.split("=", 1)[1].strip()
                    break
    if not token:
        token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("⚠ TELEGRAM_BOT_TOKEN не найден в .env. Добавьте и перезапустите.")
        return 1

    print(f"Использую токен: {token[:10]}...{token[-4:]}")
    print("Запрашиваю последние обновления через getUpdates…\n")

    try:
        with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getUpdates") as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP {e.code}: {e.reason}")
        if e.code == 404:
            print("Похоже, токен неверный.")
        return 1
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return 1

    if not data.get("ok"):
        print(f"❌ Telegram вернул ошибку: {data}")
        return 1

    updates = data.get("result", [])
    if not updates:
        print("📭 Обновлений нет. Откройте Telegram, напишите вашему боту любое сообщение")
        print("   (например /start), и запустите скрипт снова.")
        print(f"\nСсылка на бот: https://t.me/{token.split(':')[0]}")
        print("(если ник не сработал — найдите бота через поиск по имени, которое дали в @BotFather)")
        return 0

    print(f"Найдено обновлений: {len(updates)}\n")
    seen_chats = {}
    for upd in updates:
        msg = upd.get("message") or upd.get("channel_post") or upd.get("edited_message")
        if not msg:
            continue
        chat = msg.get("chat", {})
        chat_id = chat.get("id")
        chat_type = chat.get("type")
        title = chat.get("title") or chat.get("first_name") or chat.get("username") or "—"
        text = (msg.get("text") or "")[:60]
        key = chat_id
        if key in seen_chats:
            continue
        seen_chats[key] = True
        print(f"  chat_id: {chat_id}")
        print(f"  тип:     {chat_type}")
        print(f"  название: {title}")
        print(f"  последнее сообщение: {text}")
        print()

    print("Скопируйте нужный chat_id и впишите в .env:")
    print(f"  TELEGRAM_CHAT_ID=<ваш_id>")
    print("Затем перезапустите backend.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
