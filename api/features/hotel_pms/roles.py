from enum import Enum


class HotelPMSRole(str, Enum):
    APP_OWNER = "app_owner"
    MANAGER = "manager"
    FRONT_DESK = "front_desk"

    @classmethod
    def values(cls) -> list[str]:
        return [role.value for role in cls]
