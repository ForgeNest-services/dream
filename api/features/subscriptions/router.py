from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, get_current_user
from utils.helpers import success_response, error_response
from features.subscriptions.service import SubscriptionService
from features.subscriptions.schemas import (
    SubscriptionData,
    SubscriptionWithTenantData,
    PaymentData,
    PaymentWithTenantData,
    PlanData,
    SubmitPaymentRequest,
    ConfirmPaymentRequest,
    ManuallyActivateRequest,
    ExtendTrialRequest,
    CreatePlanRequest,
    UpdatePlanRequest,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

_ERROR_MAP = {
    "NOT_FOUND": ("NOT_FOUND", "Subscription not found.", 404),
    "APP_NOT_FOUND": ("APP_NOT_FOUND", "App not found.", 404),
    "INVALID_PLAN": ("INVALID_PLAN", "Plan must be monthly or yearly.", 422),
    "PLAN_NOT_CONFIGURED": ("PLAN_NOT_CONFIGURED", "No active pricing plan configured for this app and plan type.", 422),
    "PLAN_EXISTS": ("PLAN_EXISTS", "A plan with this app_code and plan type already exists.", 409),
    "PAYMENT_NOT_FOUND": ("PAYMENT_NOT_FOUND", "Payment not found.", 404),
    "PAYMENT_NOT_PENDING": ("PAYMENT_NOT_PENDING", "Payment is not in pending status.", 409),
}


def _err(code: str):
    mapped = _ERROR_MAP.get(code, ("SERVER_ERROR", "Operation failed.", 500))
    return error_response(*mapped)


def _require_superadmin(current_user: dict = Depends(get_current_user)):
    if not current_user or current_user.get("type") != "superadmin":
        raise HTTPException(403, "Superadmin only")
    return current_user


# ── Owner/Manager endpoints (platform JWT) ───────────────────────────────────


@router.get("/plans")
def list_plans(
    app_code: str | None = Query(None),
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    """Active pricing plans — owner calls this to show real prices in the pay modal."""
    plans = SubscriptionService.list_plans(db, app_code)
    return success_response(data=[PlanData.model_validate(p).model_dump(mode="json") for p in plans])


@router.get("/my")
def list_my_subscriptions(
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["user"].tenant_id
    result = SubscriptionService.list_for_tenant(db, tenant_id)
    return success_response(
        data=[SubscriptionData.model_validate(s).model_dump(mode="json") for s in result["subscriptions"]]
    )


@router.get("/my/payments")
def list_my_payments(
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["user"].tenant_id
    result = SubscriptionService.list_payments(db, tenant_id)
    return success_response(
        data=[PaymentData.model_validate(p).model_dump(mode="json") for p in result["payments"]]
    )


@router.post("/my/payments")
def submit_payment(
    data: SubmitPaymentRequest,
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["user"].tenant_id
    result = SubscriptionService.submit_payment(
        db,
        tenant_id=tenant_id,
        app_code=data.app_code,
        plan=data.plan,
        payment_method=data.payment_method,
        notes=data.notes,
    )
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=PaymentData.model_validate(result["payment"]).model_dump(mode="json"),
        message="Payment request submitted. Our team will confirm it shortly.",
        status_code=201,
    )


# ── Superadmin: plan management ──────────────────────────────────────────────


@router.get("/admin/plans")
def admin_list_plans(
    app_code: str | None = Query(None),
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    plans = SubscriptionService.list_plans(db, app_code)
    return success_response(data=[PlanData.model_validate(p).model_dump(mode="json") for p in plans])


@router.post("/admin/plans")
def admin_create_plan(
    data: CreatePlanRequest,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.create_plan(db, data.app_code, data.plan, data.price_npr, data.label)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=PlanData.model_validate(result["plan"]).model_dump(mode="json"),
        status_code=201,
    )


@router.patch("/admin/plans/{plan_id}")
def admin_update_plan(
    plan_id: str,
    data: UpdatePlanRequest,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.update_plan(db, plan_id, data.price_npr, data.label, data.is_active)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(data=PlanData.model_validate(result["plan"]).model_dump(mode="json"))


# ── Superadmin: payment management ──────────────────────────────────────────


@router.get("/admin/pending-payments")
def list_pending_payments(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.list_pending_payments(db)
    return success_response(
        data=[PaymentData.model_validate(p).model_dump(mode="json") for p in result["payments"]]
    )


@router.get("/admin/all-payments")
def list_all_payments(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    rows = SubscriptionService.list_all_payments(db)
    result = []
    for row in rows:
        d = PaymentData.model_validate(row["payment"]).model_dump(mode="json")
        d["tenant_name"] = row["tenant_name"]
        result.append(d)
    return success_response(data=result)


@router.post("/admin/payments/{payment_id}/confirm")
def confirm_payment(
    payment_id: str,
    data: ConfirmPaymentRequest,
    admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    admin_id = admin["admin"].id
    result = SubscriptionService.confirm_payment_and_activate(db, payment_id, admin_id, data.notes)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data={
            "subscription": SubscriptionData.model_validate(result["subscription"]).model_dump(mode="json"),
            "payment": PaymentData.model_validate(result["payment"]).model_dump(mode="json"),
        },
        message="Payment confirmed and subscription activated.",
    )


@router.post("/admin/payments/{payment_id}/reject")
def reject_payment(
    payment_id: str,
    data: ConfirmPaymentRequest,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.reject_payment(db, payment_id, data.notes)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=PaymentData.model_validate(result["payment"]).model_dump(mode="json"),
        message="Payment rejected.",
    )


# ── Superadmin: subscription management ─────────────────────────────────────


@router.get("/admin/all")
def list_all_subscriptions(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    rows = SubscriptionService.list_all_subscriptions(db)
    result = []
    for row in rows:
        d = SubscriptionData.model_validate(row["sub"]).model_dump(mode="json")
        d["tenant_name"] = row["tenant_name"]
        d["tenant_email"] = row["tenant_email"]
        result.append(d)
    return success_response(data=result)


@router.post("/admin/activate")
def manually_activate(
    data: ManuallyActivateRequest,
    admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.manually_activate(
        db,
        tenant_id=data.tenant_id,
        app_code=data.app_code,
        plan=data.plan,
        months=data.months,
        price_npr=data.price_npr,
        admin_id=admin["admin"].id,
        notes=data.notes,
    )
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=SubscriptionData.model_validate(result["subscription"]).model_dump(mode="json"),
        message="Subscription activated.",
    )


@router.post("/admin/extend-trial")
def extend_trial(
    data: ExtendTrialRequest,
    admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.extend_trial(
        db,
        tenant_id=data.tenant_id,
        app_code=data.app_code,
        extra_days=data.extra_days,
        admin_id=admin["admin"].id,
    )
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=SubscriptionData.model_validate(result["subscription"]).model_dump(mode="json"),
        message=f"Trial extended by {data.extra_days} days.",
    )
