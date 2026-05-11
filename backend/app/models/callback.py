"""
Callback — заявка на обратный звонок (только имя + телефон).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime

from app.core.database import Base


class Callback(Base):
    __tablename__ = "callbacks"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(120), nullable=False)
    customer_phone = Column(String(40), nullable=False)
    is_processed = Column(Boolean, default=False)
    client_ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    processed_at = Column(DateTime, nullable=True)
    processed_by = Column(String(120), nullable=True)
