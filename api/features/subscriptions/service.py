import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from shared_models import AppSubscription, App
from features.subscriptions.repository import SubscriptionRepository
from utils.logger import logger

TRIAL_DAYS = 30
DEFAULT_BUNDLE_DISCOUNT_PERCENT = Decimal("20")


def _is_active(sub: AppSubscription) -> bool:
    now = datetime.now(timezone.utc)
    if sub.status == "trialing":
        return bool(sub.trial_ends_at and sub.trial_ends_at > now)
    if sub.status == "active":
        return bool(sub.period_end and sub.period_end > now)
    return False


class SubscriptionService:
    @staticmethod
    def start_trial_if_needed(db: Session, tenant_id: str, app_code: str) -> None:
        """Call this from each app's credential-creation path (see
        HotelPMSCredentialService.create / RestroCredentialService.create /
        IMSCredentialService.create) right after a credential is created.
        Starts that app's independent 30-day trial the first time the
        tenant actually starts using it — not at signup, not on login.
        Idempotent: a no-op if a subscription row already exists for this
        (tenant, app), so it's safe to call on every credential creation,
        not just the first."""
        if SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code):
            return
        SubscriptionRepository.create_trial(db, tenant_id, app_code, TRIAL_DAYS)
        logger.info(f"Trial started for tenant {tenant_id}, app {app_code}", extra={"tenant_id": tenant_id})

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> dict:
        subs = SubscriptionRepository.list_for_tenant(db, tenant_id)
        now = datetime.now(timezone.utc)
        result = []
        for s in subs:
            # Auto-expire stale records on read (lazy expiry — no cron needed)
            if s.status == "trialing" and s.trial_ends_at and s.trial_ends_at <= now:
                SubscriptionRepository.expire(db, s)
            elif s.status == "active" and s.period_end and s.period_end <= now:
                SubscriptionRepository.expire(db, s)
            result.append(s)
        return {"success": True, "subscriptions": result}

    @staticmethod
    def get_for_app(db: Session, tenant_id: str, app_code: str) -> dict:
        sub = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if not sub:
            return {"success": False, "error_code": "NOT_FOUND"}
        now = datetime.now(timezone.utc)
        if sub.status == "trialing" and sub.trial_ends_at and sub.trial_ends_at <= now:
            SubscriptionRepository.expire(db, sub)
        elif sub.status == "active" and sub.period_end and sub.period_end <= now:
            SubscriptionRepository.expire(db, sub)
        return {"success": True, "subscription": sub}

    @staticmethod
    def is_accessible(db: Session, tenant_id: str, app_code: str) -> bool:
        """Returns True if the tenant has an active trial or paid
        subscription, OR simply hasn't started using this app yet (no
        subscription row = untried, not locked — every app is free to try
        until its own first-credential-triggered trial actually expires)."""
        sub = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if not sub:
            return True
        return _is_active(sub)

    # ── Bundle-aware pricing ─────────────────────────────────────────────────

    @staticmethod
    def get_bundle_discount_percent(db: Session) -> Decimal:
        val = SubscriptionRepository.get_setting(db, "bundle_discount_percent")
        if val is None:
            return DEFAULT_BUNDLE_DISCOUNT_PERCENT
        try:
            return Decimal(val)
        except Exception:
            return DEFAULT_BUNDLE_DISCOUNT_PERCENT

    @staticmethod
    def set_bundle_discount_percent(db: Session, percent: Decimal) -> Decimal:
        SubscriptionRepository.set_setting(db, "bundle_discount_percent", str(percent))
        return percent

    @staticmethod
    def price_selection(db: Session, app_codes: list[str], plan: str) -> dict:
        """Prices a set of apps bought together in one purchase. A single
        app just returns its own plan price. 2+ apps sums each app's price
        for that plan, then applies the platform's bundle discount % once
        to the total — there's no separate 'bundle' SKU (see
        SubscriptionPlan's docstring)."""
        if plan not in ("monthly", "yearly"):
            return {"success": False, "error_code": "INVALID_PLAN"}
        if not app_codes:
            return {"success": False, "error_code": "NO_APPS_SELECTED"}

        unique_codes = list(dict.fromkeys(app_codes))  # de-dupe, keep order
        lines = []
        for code in unique_codes:
            app = db.query(App).filter(App.code == code, App.is_active == True).first()
            if not app:
                return {"success": False, "error_code": "APP_NOT_FOUND"}
            plan_row = SubscriptionRepository.get_plan_by_app_plan(db, code, plan)
            if not plan_row:
                return {"success": False, "error_code": "PLAN_NOT_CONFIGURED"}
            lines.append({"app_code": code, "price_npr": Decimal(str(plan_row.price_npr))})

        subtotal = sum((l["price_npr"] for l in lines), Decimal("0"))
        discount_percent = (
            SubscriptionService.get_bundle_discount_percent(db) if len(unique_codes) >= 2 else Decimal("0")
        )
        discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.01"))
        total = subtotal - discount_amount

        # Distribute the discount proportionally across each app's line so
        # per-app SubscriptionPayment rows still sum to the discounted
        # total exactly (last line absorbs any rounding remainder).
        priced_lines = []
        running_total = Decimal("0")
        for i, l in enumerate(lines):
            if i == len(lines) - 1:
                line_amount = total - running_total
            else:
                share = (l["price_npr"] / subtotal) if subtotal else Decimal("0")
                line_amount = (total * share).quantize(Decimal("0.01"))
            running_total += line_amount
            priced_lines.append({"app_code": l["app_code"], "amount_npr": line_amount})

        return {
            "success": True,
            "lines": priced_lines,
            "subtotal_npr": subtotal,
            "discount_percent": discount_percent,
            "discount_amount_npr": discount_amount,
            "total_npr": total,
        }

    @staticmethod
    def submit_payment(
        db: Session,
        tenant_id: str,
        app_codes: list[str],
        plan: str,
        payment_method: str | None,
        notes: str | None,
    ) -> dict:
        priced = SubscriptionService.price_selection(db, app_codes, plan)
        if not priced["success"]:
            return priced

        months = 1 if plan == "monthly" else 12
        group_id = str(uuid.uuid4())
        payments = []
        for line in priced["lines"]:
            pmt = SubscriptionRepository.create_payment(
                db,
                group_id=group_id,
                tenant_id=tenant_id,
                app_code=line["app_code"],
                amount_npr=float(line["amount_npr"]),
                plan=plan,
                period_months=months,
                payment_method=payment_method,
                notes=notes,
            )
            payments.append(pmt)
        app_codes_str = ",".join(l["app_code"] for l in priced["lines"])
        logger.info(
            f"Payment submitted: tenant={tenant_id} apps={app_codes_str} plan={plan} group={group_id}",
            extra={"tenant_id": tenant_id},
        )
        return {"success": True, "payments": payments, "group_id": group_id}

    @staticmethod
    def list_payments(db: Session, tenant_id: str) -> dict:
        pmts = SubscriptionRepository.list_payments_for_tenant(db, tenant_id)
        return {"success": True, "payments": pmts}

    # ── Superadmin operations ────────────────────────────────────────────────

    @staticmethod
    def list_pending_payments(db: Session) -> dict:
        pmts = SubscriptionRepository.list_pending_payments(db)
        return {"success": True, "payments": pmts}

    @staticmethod
    def confirm_payment_group(
        db: Session,
        group_id: str,
        confirmed_by: str,
        notes: str | None,
    ) -> dict:
        """Confirms every row in a payment group (a single-app purchase is
        a group of one) and activates each app's subscription in turn."""
        pmts = SubscriptionRepository.list_payments_for_group(db, group_id)
        if not pmts:
            return {"success": False, "error_code": "PAYMENT_NOT_FOUND"}
        if any(p.status != "pending" for p in pmts):
            return {"success": False, "error_code": "PAYMENT_NOT_PENDING"}

        activated = []
        for pmt in pmts:
            SubscriptionRepository.confirm_payment(db, pmt, confirmed_by, notes)
            sub = SubscriptionRepository.get_for_tenant_app(db, pmt.tenant_id, pmt.app_code)
            if not sub:
                sub = AppSubscription(tenant_id=pmt.tenant_id, app_code=pmt.app_code)
                db.add(sub)
                db.flush()
            activated.append(
                SubscriptionRepository.activate(
                    db, sub, plan=pmt.plan, months=pmt.period_months,
                    price_npr=float(pmt.amount_npr), notes=notes,
                )
            )
        logger.info(f"Subscription group activated: group={group_id} apps={[p.app_code for p in pmts]}")
        return {"success": True, "subscriptions": activated, "payments": pmts}

    @staticmethod
    def reject_payment_group(db: Session, group_id: str, notes: str | None) -> dict:
        pmts = SubscriptionRepository.list_payments_for_group(db, group_id)
        if not pmts:
            return {"success": False, "error_code": "PAYMENT_NOT_FOUND"}
        if any(p.status != "pending" for p in pmts):
            return {"success": False, "error_code": "PAYMENT_NOT_PENDING"}
        for pmt in pmts:
            SubscriptionRepository.reject_payment(db, pmt, notes)
        return {"success": True, "payments": pmts}

    @staticmethod
    def list_all_payment_groups(db: Session) -> list:
        """All payments (any status) grouped by group_id, joined with
        tenant name — one row per group for the admin payments table."""
        rows = SubscriptionRepository.list_all_payments(db)
        groups: dict[str, dict] = {}
        for pmt, tenant_name in rows:
            g = groups.setdefault(pmt.group_id, {
                "group_id": pmt.group_id,
                "tenant_id": pmt.tenant_id,
                "tenant_name": tenant_name,
                "plan": pmt.plan,
                "status": pmt.status,
                "payment_method": pmt.payment_method,
                "created_at": pmt.created_at,
                "payments": [],
            })
            g["payments"].append(pmt)
        return list(groups.values())

    @staticmethod
    def list_pending_payment_groups(db: Session) -> list:
        return [g for g in SubscriptionService.list_all_payment_groups(db) if g["status"] == "pending"]

    @staticmethod
    def manually_activate(
        db: Session,
        tenant_id: str,
        app_code: str,
        plan: str,
        months: int,
        price_npr: float,
        admin_id: str,
        notes: str | None,
    ) -> dict:
        """Superadmin can directly activate a subscription (e.g. cash payment confirmed in person)."""
        if plan not in ("monthly", "yearly"):
            return {"success": False, "error_code": "INVALID_PLAN"}
        app = db.query(App).filter(App.code == app_code, App.is_active == True).first()
        if not app:
            return {"success": False, "error_code": "APP_NOT_FOUND"}

        sub = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if not sub:
            sub = AppSubscription(tenant_id=tenant_id, app_code=app_code)
            db.add(sub)
            db.flush()

        activated = SubscriptionRepository.activate(
            db, sub, plan=plan, months=months, price_npr=price_npr,
            notes=f"Manually activated by admin {admin_id}. {notes or ''}".strip(),
        )
        return {"success": True, "subscription": activated}

    @staticmethod
    def extend_trial(
        db: Session,
        tenant_id: str,
        app_code: str,
        extra_days: int,
        admin_id: str,
    ) -> dict:
        """Superadmin can extend a trial (e.g. for onboarding support)."""
        sub = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if not sub:
            return {"success": False, "error_code": "NOT_FOUND"}
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        base = sub.trial_ends_at if (sub.trial_ends_at and sub.trial_ends_at > now) else now
        sub.status = "trialing"
        sub.trial_ends_at = base + timedelta(days=extra_days)
        sub.updated_at = now
        sub.notes = f"Trial extended by admin {admin_id}."
        db.commit()
        db.refresh(sub)
        return {"success": True, "subscription": sub}

    # ── Plan management (superadmin) ─────────────────────────────────────────

    @staticmethod
    def list_plans(db: Session, app_code: str | None = None) -> list:
        return SubscriptionRepository.list_plans(db, app_code)

    @staticmethod
    def create_plan(db: Session, app_code: str, plan: str, price_npr: float, label: str) -> dict:
        existing = SubscriptionRepository.get_plan_by_app_plan(db, app_code, plan)
        if existing:
            return {"success": False, "error_code": "PLAN_EXISTS"}
        sp = SubscriptionRepository.create_plan(db, app_code, plan, price_npr, label)
        return {"success": True, "plan": sp}

    @staticmethod
    def update_plan(db: Session, plan_id: str, price_npr: float | None, label: str | None, is_active: bool | None) -> dict:
        sp = SubscriptionRepository.get_plan(db, plan_id)
        if not sp:
            return {"success": False, "error_code": "NOT_FOUND"}
        updated = SubscriptionRepository.update_plan(db, sp, price_npr=price_npr, label=label, is_active=is_active)
        return {"success": True, "plan": updated}

    # ── Admin: cross-tenant views ────────────────────────────────────────────

    @staticmethod
    def list_all_subscriptions(db: Session) -> list:
        rows = SubscriptionRepository.list_all_subscriptions(db)
        result = []
        now = datetime.now(timezone.utc)
        for sub, tenant_name, tenant_email in rows:
            if sub.status == "trialing" and sub.trial_ends_at and sub.trial_ends_at <= now:
                SubscriptionRepository.expire(db, sub)
            elif sub.status == "active" and sub.period_end and sub.period_end <= now:
                SubscriptionRepository.expire(db, sub)
            result.append({"sub": sub, "tenant_name": tenant_name, "tenant_email": tenant_email})
        return result
