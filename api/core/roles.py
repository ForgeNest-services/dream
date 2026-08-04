from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    OWNER = "owner"
    MANAGER = "manager"

    @classmethod
    def get_roles_below(cls, role: str) -> list:
        if role == cls.OWNER:
            return [cls.MANAGER]
        return []
