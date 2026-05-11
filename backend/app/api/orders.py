"""
Заявки на перевозку: создание (публично), список / карточка / редактирование (только диспетчер).
"""
import csv
import io
import asyncio
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.order import Order, OrderStatus, OrderStatusHistory
from app.models.user import User
from app.schemas import (
    OrderCreate, OrderUpdate, OrderOut, OrderListItem, OrderStats
)
from app.services.auth import get_current_user
from app.services.notifications import notify_new_order

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _to_out(order: Order) -> dict:
    """Готовит OrderOut с status_label и историей."""
    d = {
        c.name: getattr(order, c.name)
        for c in order.__table__.columns
    }
    d["status_label"] = OrderStatus.LABELS.get(order.status, order.status)
    d["history"] = [
        {
            "id": h.id, "status": h.status, "note": h.note,
            "changed_by": h.changed_by, "created_at": h.created_at
        } for h in order.history
    ]
    return d


def _to_list_item(order: Order) -> dict:
    return {
        "id": order.id,
        "from_address": order.from_address,
        "to_address": order.to_address,
        "distance_km": order.distance_km,
        "estimated_price": order.estimated_price,
        "tariff": order.tariff,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "status": order.status,
        "status_label": OrderStatus.LABELS.get(order.status, order.status),
        "driver_name": order.driver_name,
        "created_at": order.created_at,
    }


# ---------------- ПУБЛИЧНЫЕ ----------------

@router.post("", response_model=OrderOut, status_code=201)
async def create_order(
    payload: OrderCreate,
    background: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    """Создание заявки клиентом с лендинга. Без авторизации."""
    if payload.from_address.strip().lower() == payload.to_address.strip().lower():
        raise HTTPException(status_code=400, detail="Адреса отправления и назначения совпадают")

    order = Order(
        **payload.model_dump(),
        client_ip=(request.client.host if request.client else None),
        user_agent=(request.headers.get("user-agent", "") or "")[:500],
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # История: создание
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.NEW, note="Создана", changed_by="client"))
    db.commit()
    db.refresh(order)

    # Уведомление в Telegram (фоном — клиент не ждёт)
    background.add_task(_run_notify, order.id)

    return _to_out(order)


def _run_notify(order_id: int) -> None:
    """Запускаем notify в текущем event loop FastAPI через asyncio."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        o = db.get(Order, order_id)
        if o:
            asyncio.run(notify_new_order(o))
    finally:
        db.close()


# ---------------- ДЛЯ ДИСПЕТЧЕРА ----------------

@router.get("", response_model=List[OrderListItem])
def list_orders(
    status: Optional[str] = None,
    tariff: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if tariff:
        query = query.filter(Order.tariff == tariff)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Order.customer_name.ilike(like)) |
            (Order.customer_phone.ilike(like)) |
            (Order.from_address.ilike(like)) |
            (Order.to_address.ilike(like))
        )
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)

    items = query.order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    return [_to_list_item(o) for o in items]


@router.get("/stats", response_model=OrderStats)
def stats(
    date_from: Optional[datetime] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = db.query(Order)
    if date_from:
        base = base.filter(Order.created_at >= date_from)

    total = base.count()
    by_status = dict(
        base.with_entities(Order.status, func.count(Order.id)).group_by(Order.status).all()
    )
    revenue_q = base.filter(Order.status == OrderStatus.COMPLETED).with_entities(
        func.coalesce(func.sum(Order.estimated_price), 0),
        func.coalesce(func.avg(Order.estimated_price), 0),
    ).first()
    revenue = int(revenue_q[0] or 0)
    avg = int(revenue_q[1] or 0)

    return OrderStats(
        total=total,
        by_status={k: v for k, v in by_status.items()},
        revenue=revenue,
        avg_price=avg,
    )


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return _to_out(order)


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    payload: OrderUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    changes = payload.model_dump(exclude_unset=True)
    status_changed = "status" in changes and changes["status"] != order.status

    for k, v in changes.items():
        setattr(order, k, v)

    if status_changed:
        db.add(OrderStatusHistory(
            order_id=order.id,
            status=changes["status"],
            note=f"Статус изменён на «{OrderStatus.LABELS.get(changes['status'], changes['status'])}»",
            changed_by=user.username,
        ))

    db.commit()
    db.refresh(order)
    return _to_out(order)


@router.get("/export/csv")
def export_csv(
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Экспорт заявок в CSV. Возвращает поток."""
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    orders = query.order_by(desc(Order.created_at)).all()

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow([
        "ID", "Дата", "Откуда", "Куда", "Дистанция (км)", "Тариф",
        "Стоимость", "Клиент", "Телефон", "Связь", "Статус", "Водитель", "Комментарий"
    ])
    for o in orders:
        writer.writerow([
            o.id,
            o.created_at.strftime("%d.%m.%Y %H:%M"),
            o.from_address,
            o.to_address,
            o.distance_km,
            o.tariff,
            o.estimated_price,
            o.customer_name,
            o.customer_phone,
            o.contact_way,
            OrderStatus.LABELS.get(o.status, o.status),
            o.driver_name or "",
            o.comment or "",
        ])

    buf.seek(0)
    return StreamingResponse(
        # BOM чтобы Excel правильно открыл UTF-8
        iter(["﻿" + buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="orders-{datetime.utcnow().strftime("%Y%m%d-%H%M")}.csv"'},
    )
