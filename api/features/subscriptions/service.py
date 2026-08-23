from datetime import datetime, timezone
from sqlalchemy.orm import Session
from shared_models import AppSubscription, SubscriptionPayment, SubscriptionPlan, App
from features.subscriptions.repository import SubscriptionRepository
from utils.logger import logger

TRIAL_DAYS = 30


def _is_active(sub: AppSubscription) -> bool:
    now = datetime.now(timezone.utc)
    if sub.status == "trialing":
        return bool(sub.trial_ends_at and sub.trial_ends_at > now)
    if sub.status == "active":
        return bool(sub.period_end and sub.period_end > now)
    return False


class SubscriptionService:
    @staticmethod
    def provision_trials(db: Session, tenant_id: str) -> None:
        """Called after business registration — auto-creates 30-day trials for
        every active app in the catalog. Idempotent: skips apps that already
        have a subscription record."""
        apps = db.query(App).filter(App.is_active == True).all()
        for app in apps:
            SubscriptionRepository.create_trial(db, tenant_id, app.code, TRIAL_DAYS)
        logger.info(f"Provisioned trials for tenant {tenant_id}", extra={"tenant_id": tenant_id})

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
        """Returns True if the tenant has an active trial or paid subscription."""
        sub = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if not sub:
            return False
        return _is_active(sub)

    @staticmethod
    def submit_payment(
        db: Session,
        tenant_id: str,
        app_code: str,
        plan: str,
        payment_method: str | None,
        notes: str | None,
    ) -> dict:
        if plan not in ("monthly", "yearly"):
            return {"success": False, "error_code": "INVALID_PLAN"}

        # Verify the app exists
        app = db.query(App).filter(App.code == app_code, App.is_active == True).first()
        if not app:
            return {"success": False, "error_code": "APP_NOT_FOUND"}

        # Look up price from subscription_plans table
        plan_row = SubscriptionRepository.get_plan_by_app_plan(db, app_code, plan)
        if not plan_row:
            return {"success": False, "error_code": "PLAN_NOT_CONFIGURED"}
        amount = float(plan_row.price_npr)
        months = 1 if plan == "monthly" else 12

        pmt = SubscriptionRepository.create_payment(
            db,
            tenant_id=tenant_id,
            app_code=app_code,
            amount_npr=amount,
            plan=plan,
            period_months=months,
            payment_method=payment_method,
            notes=notes,
        )
        logger.info(
            f"Payment submitted: tenant={tenant_id} app={app_code} plan={plan}",
            extra={"tenant_id": tenant_id},
        )
        return {"success": True, "payment": pmt}

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
    def confirm_payment_and_activate(
        db: Session,
        payment_id: str,
        confirmed_by: str,
        notes: str | None,
    ) -> dict:
        pmt = SubscriptionRepository.get_payment(db, payment_id)
        if not pmt:
            return {"success": False, "error_code": "PAYMENT_NOT_FOUND"}
        if pmt.status != "pending":
            return {"success": False, "error_code": "PAYMENT_NOT_PENDING"}

        SubscriptionRepository.confirm_payment(db, pmt, confirmed_by, notes)

        sub = SubscriptionRepository.get_for_tenant_app(db, pmt.tenant_id, pmt.app_code)
        if not sub:
            sub = AppSubscription(tenant_id=pmt.tenant_id, app_code=pmt.app_code)
            db.add(sub)
            db.flush()

        activated = SubscriptionRepository.activate(
            db,
            sub,
            plan=pmt.plan,
            months=pmt.period_months,
            price_npr=float(pmt.amount_npr),
            notes=notes,
        )
        logger.info(
            f"Subscription activated: tenant={pmt.tenant_id} app={pmt.app_code} plan={pmt.plan}",
        )
        return {"success": True, "subscription": activated, "payment": pmt}

    @staticmethod
    def reject_payment(db: Session, payment_id: str, notes: str | None) -> dict:
        pmt = SubscriptionRepository.get_payment(db, payment_id)
        if not pmt:
            return {"success": False, "error_code": "PAYMENT_NOT_FOUND"}
        if pmt.status != "pending":
            return {"success": False, "error_code": "PAYMENT_NOT_PENDING"}
        SubscriptionRepository.reject_payment(db, pmt, notes)
        return {"success": True, "payment": pmt}

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
        if plan not in ("monthly", "yearly", "bundle"):
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

    @staticmethod
    def list_all_payments(db: Session) -> list:
        rows = SubscriptionRepository.list_all_payments(db)
        return [{"payment": pmt, "tenant_name": tenant_name} for pmt, tenant_name in rows]
