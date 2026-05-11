"""
Order — основная модель заявки на перевозку.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class OrderStatus:
    NEW = "new"
    IN_WORK = "in_work"
    DRIVER_ASSIGNED = "driver_assigned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    ALL = (NEW, IN_WORK, DRIVER_ASSIGNED, COMPLETED, CANCELLED)
    LABELS = {
        NEW: "Новая",
        IN_WORK: "В работе",
        DRIVER_ASSIGNED: "Водитель назначен",
        COMPLETED: "Завершена",
        CANCELLED: "Отменена",
    }


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    # Маршрут
    from_address = Column(String(500), nullable=False)
    from_lat = Column(Float, nullable=True)
    from_lng = Column(Float, nullable=True)
    to_address = Column(String(500), nullable=False)
    to_lat = Column(Float, nullable=True)
    to_lng = Column(Float, nullable=True)
    distance_km = Column(Float, default=0)
    duration_min = Column(Integer, default=0)

    # Тариф и расчёт
    tariff = Column(String(50), default="comfort")
    rate_per_km = Column(Float, default=0)
    estimated_price = Column(Integer, default=0)

    # Клиент
    customer_name = Column(String(120), nullable=False)
    customer_phone = Column(String(40), nullable=False)
    contact_way = Column(String(20), default="call")
    comment = Column(Text, nullable=True)

    # Статус и метаданные
    status = Column(String(40), default=OrderStatus.NEW, index=True)
    driver_name = Column(String(120), nullable=True)
    driver_phone = Column(String(40), nullable=True)
    internal_note = Column(Text, nullable=True)

    # Безопасность / аналитика
    client_ip = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    history = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.created_at"
    )


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status = Column(String(40))
    note = Column(Text, nullable=True)
    changed_by = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="history")
