"""
POST /api/callback — заказ обратного звонка (публично).
GET  /api/callback — список (для диспетчера).
PATCH /api/callback/{id} — пометить обработанным.
"""
import asyncio
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.callback import Callback
from app.models.user import User
from app.schemas import CallbackCreate, CallbackOut
from app.services.auth import get_current_user
from app.services.notifications import notify_callback

router = APIRouter(prefix="/api/callback", tags=["callback"])


@router.post("", response_model=CallbackOut, status_code=201)
def create_callback(
    payload: CallbackCreate,
    background: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    cb = Callback(
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        client_ip=(request.client.host if request.client else None),
    )
    db.add(cb)
    db.commit()
    db.refresh(cb)

    background.add_task(_notify, cb.customer_name, cb.customer_phone)
    return cb


def _notify(name: str, phone: str):
    asyncio.run(notify_callback(name, phone))


@router.get("", response_model=List[CallbackOut])
def list_callbacks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Callback).order_by(desc(Callback.created_at)).limit(200).all()


@router.patch("/{callback_id}", response_model=CallbackOut)
def mark_processed(
    callback_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cb = db.get(Callback, callback_id)
    if not cb:
        raise HTTPException(404)
    cb.is_processed = True
    cb.processed_at = datetime.utcnow()
    cb.processed_by = user.username
    db.commit()
    db.refresh(cb)
    return cb
