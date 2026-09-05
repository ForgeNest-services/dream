"""One-time bootstrap: creates two real dummy RMS tenants (one PAN-only, one
VAT-registered) with a branch and all 4 role credentials each, for the
ordered black-box HTTP test suite in this directory.

NOT a pytest test itself -- run once, manually, inside the api container:
    docker exec srota-api python /app/tests/rms/seed_dummy_tenants.py

Writes the resulting IDs/usernames/passwords to dummy_tenants.json in this
same directory, which conftest.py's fixtures read back on the HOST side
(where the actual httpx test files run) -- this script is the only piece
that needs the app's real DB/service-layer imports, so it's the only piece
that needs to run inside the container.

Safe to re-run: checks for existing tenants by name before creating new
ones, so it won't duplicate on a second run.
"""
import sys
import json
sys.path.insert(0, "/app")
import main  # noqa: F401 -- see this session's established import-order note

from core.database import SessionLocal
from shared_models import Tenant, User
from features.auth.repository import TenantRepository
from features.branches.repository import BranchRepository
from features.restro.service import RestroCredentialService
from features.restro.roles import RestroRole

PAN_TENANT_NAME = "RMS Test PAN Pvt Ltd"
VAT_TENANT_NAME = "RMS Test VAT Pvt Ltd"

ROLE_PASSWORD = "TestPass123!"


def _get_or_create_tenant(db, name: str, pan: str, is_vat_registered: bool) -> Tenant:
    existing = db.query(Tenant).filter(Tenant.name == name).first()
    if existing:
        print(f"Tenant already exists: {name} ({existing.id})")
        return existing
    tenant = TenantRepository.create(
        db,
        name=name,
        pan=pan,
        is_vat_registered=is_vat_registered,
        business_address="Kathmandu, Nepal",
    )
    print(f"Tenant created: {name} ({tenant.id}) pan={tenant.pan} vat={tenant.is_vat_registered}")
    return tenant


def _get_or_create_owner_user(db, tenant_id: str, email: str) -> User:
    existing = db.query(User).filter(User.tenant_id == tenant_id, User.email == email).first()
    if existing:
        return existing
    owner_user = User(
        tenant_id=tenant_id,
        full_name="Test Owner",
        email=email,
        is_owner=True,
        role="owner",
    )
    db.add(owner_user)
    db.commit()
    db.refresh(owner_user)
    return owner_user


def _get_or_create_branch(db, tenant_id: str, name: str, code: str):
    from shared_models import Branch
    existing = db.query(Branch).filter(Branch.tenant_id == tenant_id, Branch.code == code).first()
    if existing:
        print(f"Branch already exists: {name} ({existing.id})")
        return existing
    branch = BranchRepository.create(db, tenant_id=tenant_id, name=name, code=code)
    print(f"Branch created: {name} ({branch.id})")
    return branch


def _get_or_create_credential(db, tenant_id: str, created_by: str, branch_id: str | None, role: str, username: str):
    from features.restro.repository import RestroCredentialRepository
    existing = RestroCredentialRepository.get_by_username(db, username)
    if existing:
        print(f"Credential already exists: {username} (role={role})")
        return existing
    result = RestroCredentialService.create(
        db,
        tenant_id=tenant_id,
        created_by=created_by,
        role=role,
        name=f"Test {role.capitalize()}",
        username=username,
        password=ROLE_PASSWORD,
        branch_id=branch_id,
    )
    if not result["success"]:
        raise RuntimeError(f"Failed to create credential {username}: {result.get('error_code')}")
    print(f"Credential created: {username} (role={role})")
    return result["credential"]


def seed_business(db, business_key: str, tenant_name: str, pan: str | None, is_vat_registered: bool) -> dict:
    tenant = _get_or_create_tenant(db, tenant_name, pan, is_vat_registered)
    owner_user = _get_or_create_owner_user(db, tenant.id, f"{business_key}-owner@test.dream")
    branch = _get_or_create_branch(db, tenant.id, "Main Branch", f"{business_key.upper()}01")

    creds = {}
    for role in RestroRole.values():
        username = f"{business_key}-{role}"
        branch_id = branch.id if role != RestroRole.OWNER.value else None
        cred = _get_or_create_credential(db, tenant.id, owner_user.id, branch_id, role, username)
        creds[role] = {"username": username, "password": ROLE_PASSWORD, "cred_id": cred.id}

    return {
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "pan": tenant.pan,
        "is_vat_registered": tenant.is_vat_registered,
        "branch_id": branch.id,
        "branch_code": branch.code,
        "credentials": creds,
    }


def main_seed():
    db = SessionLocal()
    try:
        pan_business = seed_business(db, "pan", PAN_TENANT_NAME, pan="600000101", is_vat_registered=False)
        vat_business = seed_business(db, "vat", VAT_TENANT_NAME, pan="600000102", is_vat_registered=True)

        output = {"pan": pan_business, "vat": vat_business}
        out_path = "/app/tests/rms/dummy_tenants.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nWrote {out_path}")
        print(json.dumps(output, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main_seed()
