from enum import Enum


class HotelPMSRole(str, Enum):
    MANAGER = "manager"
    FRONT_DESK = "front_desk"
    HOUSEKEEPER = "housekeeper"

    @classmethod
    def values(cls) -> list[str]:
        return [role.value for role in cls]
