from enum import Enum


class IMSRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    STOREKEEPER = "storekeeper"

    @classmethod
    def values(cls) -> list[str]:
        return [role.value for role in cls]
