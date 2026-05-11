"""
Создаёт стартового админа при первом запуске.
"""
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User


def ensure_default_admin(db: Session) -> None:
    existing = db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()
    if existing:
        return
    user = User(
        username=settings.DEFAULT_ADMIN_USERNAME,
        password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
        full_name="Администратор",
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    print(f"[seed] Создан стартовый админ: {settings.DEFAULT_ADMIN_USERNAME} / {settings.DEFAULT_ADMIN_PASSWORD}")
