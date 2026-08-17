from pydantic import BaseModel, ConfigDict


class AppData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    slug: str
    name: str
    description: str | None = None
    icon: str | None = None
    icon_url: str | None = None
    url: str
    is_active: bool
