from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.models.order import OrderStatus


class OrderCreate(BaseModel):
    from_address: str = Field(..., min_length=3, max_length=500)
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_address: str = Field(..., min_length=3, max_length=500)
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    distance_km: float = 0
    duration_min: int = 0
    tariff: str = "comfort"
    rate_per_km: float = 0
    estimated_price: int = 0
    customer_name: str = Field(..., min_length=1, max_length=120)
    customer_phone: str = Field(..., min_length=10, max_length=40)
    contact_way: str = "call"
    comment: Optional[str] = None

    @field_validator("from_address", "to_address")
    @classmethod
    def addresses_not_equal(cls, v: str) -> str:
        return v.strip()

    @field_validator("contact_way")
    @classmethod
    def valid_contact_way(cls, v: str) -> str:
        if v not in {"call", "whatsapp", "telegram"}:
            return "call"
        return v


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    internal_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in OrderStatus.ALL:
            raise ValueError(f"invalid status, must be one of {OrderStatus.ALL}")
        return v


class OrderHistoryItem(BaseModel):
    id: int
    status: str
    note: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderListItem(BaseModel):
    id: int
    from_address: str
    to_address: str
    distance_km: float
    estimated_price: int
    tariff: str
    customer_name: str
    customer_phone: str
    status: str
    status_label: str
    driver_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    from_address: str
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_address: str
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    distance_km: float
    duration_min: int
    tariff: str
    rate_per_km: float
    estimated_price: int
    customer_name: str
    customer_phone: str
    contact_way: str
    comment: Optional[str] = None
    status: str
    status_label: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    internal_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    history: List[OrderHistoryItem] = []

    model_config = {"from_attributes": True}


class OrderStats(BaseModel):
    total: int
    by_status: dict
    revenue: int
    avg_price: int
