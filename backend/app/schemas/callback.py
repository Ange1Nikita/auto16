from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CallbackCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=120)
    customer_phone: str = Field(..., min_length=10, max_length=40)


class CallbackOut(BaseModel):
    id: int
    customer_name: str
    customer_phone: str
    is_processed: bool
    created_at: datetime
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
