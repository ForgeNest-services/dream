from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class SubscribeRequest(BaseModel):
    email: EmailStr


class SubscriberData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    created_at: datetime
