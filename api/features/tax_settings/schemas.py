from pydantic import BaseModel, field_validator


class SaveCredentialsRequest(BaseModel):
    ird_username: str
    ird_password: str
    # Server-side enforcement of the checklist's consent requirement — not
    # just a UI checkbox. A save without this explicitly true is rejected.
    consent: bool

    @field_validator("ird_username", "ird_password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("cannot be blank")
        return v.strip()

    @field_validator("consent")
    @classmethod
    def must_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("consent must be explicitly accepted")
        return v


class SetSyncEnabledRequest(BaseModel):
    enabled: bool
