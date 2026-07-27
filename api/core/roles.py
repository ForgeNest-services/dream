from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"
    ACCOUNTANT = "accountant"

    @classmethod
    def get_roles_below(cls, role: str) -> list:
        """Return roles that can be created by the given role."""
        if role == cls.OWNER:
            return [cls.MANAGER, cls.STAFF, cls.ACCOUNTANT]
        elif role == cls.MANAGER:
            return [cls.STAFF, cls.ACCOUNTANT]
        return []
