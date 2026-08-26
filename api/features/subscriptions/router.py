from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.deps import require_tenant_user, get_current_user
from utils.helpers import success_response, error_response
from features.subscriptions.service import SubscriptionService
from features.subscriptions.schemas import (
    SubscriptionData,
    PaymentData,
    PaymentGroupData,
    PlanData,
    BundleDiscountData,
    PriceQuoteData,
    PriceQuoteRequest,
    SubmitPaymentRequest,
    ConfirmPaymentRequest,
    ManuallyActivateRequest,
    ExtendTrialRequest,
    CreatePlanRequest,
    UpdatePlanRequest,
    UpdateBundleDiscountRequest,
    OwnerUserData,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

_ERROR_MAP = {
    "NOT_FOUND": ("NOT_FOUND", "Subscription not found.", 404),
    "APP_NOT_FOUND": ("APP_NOT_FOUND", "App not found.", 404),
    "INVALID_PLAN": ("INVALID_PLAN", "Plan must be monthly or yearly.", 422),
    "NO_APPS_SELECTED": ("NO_APPS_SELECTED", "Select at least one app.", 422),
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


def _group_to_dict(g: dict) -> dict:
    d = dict(g)
    d["payments"] = [PaymentData.model_validate(p).model_dump(mode="json") for p in g["payments"]]
    d["created_at"] = d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else d["created_at"]
    return d


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


@router.get("/bundle-discount")
def get_bundle_discount(
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    percent = SubscriptionService.get_bundle_discount_percent(db)
    return success_response(data=BundleDiscountData(percent=percent).model_dump(mode="json"))


@router.post("/quote")
def quote_price(
    data: PriceQuoteRequest,
    current_user: dict = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    """Prices a selection of one or more apps for one billing cycle —
    used to render the pay modal's total before the tenant submits a
    payment request. See SubscriptionService.price_selection."""
    result = SubscriptionService.price_selection(db, data.app_codes, data.plan)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(data=PriceQuoteData(**result).model_dump(mode="json"))


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
    """Submits a payment request for one or more apps at once (2+ apps =
    a discounted bundle purchase, priced by price_selection). All apps in
    one request share one billing cycle and one payment group — see
    SubscriptionService.submit_payment."""
    tenant_id = current_user["user"].tenant_id
    result = SubscriptionService.submit_payment(
        db,
        tenant_id=tenant_id,
        app_codes=data.app_codes,
        plan=data.plan,
        payment_method=data.payment_method,
        notes=data.notes,
    )
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data={
            "group_id": result["group_id"],
            "payments": [PaymentData.model_validate(p).model_dump(mode="json") for p in result["payments"]],
        },
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


@router.get("/admin/bundle-discount")
def admin_get_bundle_discount(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    percent = SubscriptionService.get_bundle_discount_percent(db)
    return success_response(data=BundleDiscountData(percent=percent).model_dump(mode="json"))


@router.patch("/admin/bundle-discount")
def admin_update_bundle_discount(
    data: UpdateBundleDiscountRequest,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    percent = SubscriptionService.set_bundle_discount_percent(db, data.percent)
    return success_response(
        data=BundleDiscountData(percent=percent).model_dump(mode="json"),
        message="Bundle discount updated.",
    )


# ── Superadmin: payment management ──────────────────────────────────────────


@router.get("/admin/pending-payments")
def list_pending_payments(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    groups = SubscriptionService.list_pending_payment_groups(db)
    return success_response(data=[_group_to_dict(g) for g in groups])


@router.get("/admin/all-payments")
def list_all_payments(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    groups = SubscriptionService.list_all_payment_groups(db)
    return success_response(data=[_group_to_dict(g) for g in groups])


@router.post("/admin/payment-groups/{group_id}/confirm")
def confirm_payment_group(
    group_id: str,
    data: ConfirmPaymentRequest,
    admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    admin_id = admin["admin"].id
    result = SubscriptionService.confirm_payment_group(db, group_id, admin_id, data.notes)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data={
            "subscriptions": [SubscriptionData.model_validate(s).model_dump(mode="json") for s in result["subscriptions"]],
            "payments": [PaymentData.model_validate(p).model_dump(mode="json") for p in result["payments"]],
        },
        message="Payment confirmed and subscription(s) activated.",
    )


@router.post("/admin/payment-groups/{group_id}/reject")
def reject_payment_group(
    group_id: str,
    data: ConfirmPaymentRequest,
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    result = SubscriptionService.reject_payment_group(db, group_id, data.notes)
    if not result["success"]:
        return _err(result["error_code"])
    return success_response(
        data=[PaymentData.model_validate(p).model_dump(mode="json") for p in result["payments"]],
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


# ── Superadmin: users ─────────────────────────────────────────────────────────


@router.get("/admin/users")
def list_all_owners(
    _admin: dict = Depends(_require_superadmin),
    db: Session = Depends(get_db),
):
    """Every owner account with their business info (if set up) and every
    app subscription that business has — the superadmin Users page. Plan
    changes for a listed user's subscription go through the existing
    POST /admin/activate (same manual-activation path a payment
    confirmation uses)."""
    rows = SubscriptionService.list_all_owners(db)
    result = []
    for row in rows:
        result.append(
            OwnerUserData(
                user_id=row["user"].id,
                full_name=row["user"].full_name,
                email=row["user"].email,
                is_verified=row["user"].is_verified,
                is_active=row["user"].is_active,
                created_at=row["user"].created_at,
                tenant=row["tenant"],
                subscriptions=row["subscriptions"],
            ).model_dump(mode="json")
        )
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
