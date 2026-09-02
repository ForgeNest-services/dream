import re
from sqlalchemy.orm import Session
from features.branches.repository import BranchRepository
from utils.logger import logger


def derive_unique_code(db: Session, tenant_id: str, name: str, exclude_branch_id: str | None = None) -> str:
    """Auto-derives a short branch code from its name — IRD: Electronic
    Billing Procedure 2082, clause 6.2ग requires each billing outlet's code
    to appear in the printed bill number once a tenant has 2+ branches.
    Takes the first letter of up to 3 words (e.g. "Kathmandu Durbar Marg" ->
    "KDM"), falling back to the first 3 letters of a single word ("Sanepa"
    -> "SAN"). Appends a number on collision (KTM, KTM2, KTM3, ...) so it
    stays unique per tenant even for near-identical branch names."""
    words = re.findall(r"[A-Za-z0-9]+", name)
    if len(words) >= 2:
        base = "".join(w[0] for w in words[:3]).upper()
    elif words:
        base = words[0][:3].upper()
    else:
        base = "BR"
    base = base[:8] or "BR"

    if not BranchRepository.code_exists(db, tenant_id, base, exclude_branch_id):
        return base
    n = 2
    while BranchRepository.code_exists(db, tenant_id, f"{base}{n}", exclude_branch_id):
        n += 1
    return f"{base}{n}"


class BranchService:
    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str, tenant) -> list:
        """List active branches; auto-provisions a default one from tenant info
        on first call so a fresh tenant always has at least one branch."""
        branches = BranchRepository.list_for_tenant(db, tenant_id)
        if not branches:
            code = derive_unique_code(db, tenant_id, tenant.name)
            branch = BranchRepository.create(
                db,
                tenant_id=tenant_id,
                name=tenant.name,
                code=code,
                address=tenant.business_address,
                phone=tenant.business_phone,
            )
            logger.info(
                f"Auto-provisioned default branch: {branch.id} (code={code})",
                extra={"tenant_id": tenant_id},
            )
            return [branch]
        return branches

    @staticmethod
    def list_for_staff(db: Session, tenant_id: str, branch_id: str | None) -> list:
        if branch_id:
            branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
            return [branch] if branch else []
        return BranchRepository.list_for_tenant(db, tenant_id)

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        code: str | None = None,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> dict:
        if code:
            code = code.strip().upper()
            if BranchRepository.code_exists(db, tenant_id, code):
                return {"success": False, "error_code": "BRANCH_CODE_TAKEN"}
        else:
            code = derive_unique_code(db, tenant_id, name)
        branch = BranchRepository.create(
            db, tenant_id=tenant_id, name=name, code=code, address=address, city=city, phone=phone
        )
        logger.info(f"Branch created: {branch.id} (code={code})", extra={"tenant_id": tenant_id})
        return {"success": True, "branch": branch}

    @staticmethod
    def update(
        db: Session,
        tenant_id: str,
        branch_id: str,
        name: str | None = None,
        code: str | None = None,
        address: str | None = None,
        city: str | None = None,
        phone: str | None = None,
    ) -> dict:
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        if code:
            code = code.strip().upper()
            if BranchRepository.code_exists(db, tenant_id, code, exclude_branch_id=branch_id):
                return {"success": False, "error_code": "BRANCH_CODE_TAKEN"}

        updated = BranchRepository.update(
            db, branch, name=name, code=code, address=address, city=city, phone=phone
        )
        logger.info(f"Branch updated: {updated.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "branch": updated}

    @staticmethod
    def delete(db: Session, tenant_id: str, branch_id: str) -> dict:
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}

        BranchRepository.update(db, branch, is_active=False)
        logger.info(f"Branch deactivated: {branch_id}", extra={"tenant_id": tenant_id})
        return {"success": True}
