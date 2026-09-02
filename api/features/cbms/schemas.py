from pydantic import BaseModel, field_validator


class CBMSCredentialRequest(BaseModel):
    ird_username: str
    ird_password: str

    @field_validator("ird_username", "ird_password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("cannot be blank")
        return v.strip()
