"""One-off, DISPOSABLE tenant for a real IRD CBMS sandbox test -- NOT part
of the ordered dummy-tenant suite (dummy_tenants.json / conftest.py's
fixtures) and never referenced by any test_NN_*.py file.

Why this can't reuse the PAN/VAT dummy tenants from seed_dummy_tenants.py:
build_cbms_payload() sends `order.seller_pan`, which OrderService.mark_paid
snapshots straight from `tenant.pan` (see order_service.py) -- NOT from
org_tax_settings.pan. IRD's real sandbox validates seller_pan against the
Test_CBMS account and expects exactly "999999999" (confirmed
docs/compliance.md's 2026-09-04 live-test note: a mismatched seller PAN
alone triggers response code 100, auth mismatch). The ongoing VAT dummy
tenant's pan is "600000102" and must stay that way (test_02_branch_settings.py
and others assert against it) -- so this script creates a wholly separate,
throwaway VAT tenant with pan="999999999" instead of mutating shared
infrastructure.

Run inside the api container:
    docker exec srota-api python /app/tests/rms/seed_cbms_live_tenant.py

Writes cbms_live_tenant.json in this same directory. Safe to re-run --
checks for the existing tenant/branch/credential/org_tax_settings row by
name/username before creating new ones.
"""
import sys
import json
sys.path.insert(0, "/app")
import main  # noqa: F401

from core.database import SessionLocal
from core.crypto import encrypt_secret
from shared_models import Tenant, User
from features.auth.repository import TenantRepository
from features.branches.repository import BranchRepository
from features.restro.service import RestroCredentialService
from features.restro.roles import RestroRole
from features.tax_settings.repository import TaxSettingsRepository

TENANT_NAME = "RMS CBMS Live Sandbox Test Ltd"
SANDBOX_PAN = "999999999"  # IRD's own Test_CBMS sandbox account PAN
IRD_USERNAME = "Test_CBMS"
IRD_PASSWORD = "test@321"
ROLE_PASSWORD = "TestPass123!"


def main_seed():
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.name == TENANT_NAME).first()
        if tenant:
            print(f"Tenant already exists: {TENANT_NAME} ({tenant.id})")
        else:
            tenant = TenantRepository.create(
                db, name=TENANT_NAME, pan=SANDBOX_PAN, is_vat_registered=True,
                business_address="Kathmandu, Nepal",
            )
            print(f"Tenant created: {TENANT_NAME} ({tenant.id}) pan={tenant.pan}")

        owner_email = "cbms-live-owner@test.dream"
        owner_user = db.query(User).filter(User.tenant_id == tenant.id, User.email == owner_email).first()
        if not owner_user:
            owner_user = User(
                tenant_id=tenant.id, full_name="CBMS Live Test Owner",
                email=owner_email, is_owner=True, role="owner",
            )
            db.add(owner_user)
            db.commit()
            db.refresh(owner_user)

        from shared_models import Branch
        branch = db.query(Branch).filter(Branch.tenant_id == tenant.id, Branch.code == "CBMS01").first()
        if not branch:
            branch = BranchRepository.create(db, tenant_id=tenant.id, name="Main Branch", code="CBMS01")
            print(f"Branch created: {branch.id}")

        from features.restro.repository import RestroCredentialRepository
        owner_username = "cbms-live-owner"
        cred = RestroCredentialRepository.get_by_username(db, owner_username)
        if not cred:
            result = RestroCredentialService.create(
                db, tenant_id=tenant.id, created_by=owner_user.id,
                role=RestroRole.OWNER.value, name="CBMS Live Test Owner",
                username=owner_username, password=ROLE_PASSWORD, branch_id=None,
            )
            if not result["success"]:
                raise RuntimeError(f"Failed to create owner credential: {result.get('error_code')}")
            cred = result["credential"]
            print(f"Credential created: {owner_username}")
        else:
            print(f"Credential already exists: {owner_username}")

        # Real CBMS credentials -- IRD's own Test_CBMS sandbox account, from
        # IRD's official CBMS API documentation PDF (supplied by the
        # business owner, per docs/compliance.md's §6).
        settings_row = TaxSettingsRepository.get_or_create(db, tenant.id)
        encrypted = encrypt_secret(IRD_PASSWORD)
        TaxSettingsRepository.save_credentials(db, settings_row, tenant.pan, IRD_USERNAME, encrypted)
        TaxSettingsRepository.set_sync_enabled(db, settings_row, True)
        print("org_tax_settings: real IRD sandbox credentials saved, cbms_sync_enabled=True")

        output = {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "pan": tenant.pan,
            "branch_id": branch.id,
            "branch_code": branch.code,
            "owner": {"username": owner_username, "password": ROLE_PASSWORD, "cred_id": cred.id},
        }
        out_path = "/app/tests/rms/cbms_live_tenant.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nWrote {out_path}")
        print(json.dumps(output, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main_seed()
