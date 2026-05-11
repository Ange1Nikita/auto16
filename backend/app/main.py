"""
FastAPI app entrypoint.
Запуск: uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.services.seed import ensure_default_admin

# Импорт моделей чтобы они зарегистрировались в Base.metadata
from app.models import Order, OrderStatusHistory, User, Callback  # noqa

# API routers
from app.api.auth import router as auth_router
from app.api.orders import router as orders_router
from app.api.callback import router as callback_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()
    yield
    # Shutdown — ничего


app = FastAPI(
    title="Автоперевозки API",
    description="REST API для лендинга пассажирских перевозок и админки диспетчера.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],   # для dev: разрешаем всё
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(orders_router)
app.include_router(callback_router)


@app.get("/")
def root():
    return {
        "service": "Автоперевозки API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
