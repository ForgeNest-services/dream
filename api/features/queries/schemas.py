from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

APP_INTEREST_VALUES = {"rms", "ims", "bundle"}


class SubmitQueryRequest(BaseModel):
    name: str
    email: EmailStr
    business_name: str | None = None
    phone: str | None = None
    app_interest: str | None = None
    message: str

    @field_validator("name", "message")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required")
        return v

    @field_validator("business_name", "phone", mode="before")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("app_interest", mode="before")
    @classmethod
    def _validate_app_interest(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if v not in APP_INTEREST_VALUES:
            raise ValueError(f"app_interest must be one of {sorted(APP_INTEREST_VALUES)}")
        return v


class QueryData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    business_name: str | None
    phone: str | None
    app_interest: str | None
    message: str
    created_at: datetime
