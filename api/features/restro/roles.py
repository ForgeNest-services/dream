from enum import Enum


class RestroRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    WAITER = "waiter"
    CHEF = "chef"

    @classmethod
    def values(cls) -> list[str]:
        return [role.value for role in cls]
