from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from shared_models import AppSubscription, SubscriptionPayment, SubscriptionPlan, Tenant


class SubscriptionRepository:
    @staticmethod
    def get_for_tenant_app(db: Session, tenant_id: str, app_code: str) -> AppSubscription | None:
        return (
            db.query(AppSubscription)
            .filter(
                AppSubscription.tenant_id == tenant_id,
                AppSubscription.app_code == app_code,
            )
            .first()
        )

    @staticmethod
    def list_for_tenant(db: Session, tenant_id: str) -> list[AppSubscription]:
        return (
            db.query(AppSubscription)
            .filter(AppSubscription.tenant_id == tenant_id)
            .order_by(AppSubscription.created_at)
            .all()
        )

    @staticmethod
    def create_trial(db: Session, tenant_id: str, app_code: str, trial_days: int = 30) -> AppSubscription:
        existing = SubscriptionRepository.get_for_tenant_app(db, tenant_id, app_code)
        if existing:
            return existing
        sub = AppSubscription(
            tenant_id=tenant_id,
            app_code=app_code,
            status="trialing",
            trial_ends_at=datetime.now(timezone.utc) + timedelta(days=trial_days),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def activate(
        db: Session,
        sub: AppSubscription,
        plan: str,
        months: int,
        price_npr: float,
        notes: str | None = None,
    ) -> AppSubscription:
        now = datetime.now(timezone.utc)
        # If currently active and not expired, extend from current end date
        if sub.status == "active" and sub.period_end and sub.period_end > now:
            period_start = sub.period_end
        else:
            period_start = now
        period_end = period_start + timedelta(days=30 * months)
        sub.status = "active"
        sub.plan = plan
        sub.period_start = period_start
        sub.period_end = period_end
        sub.price_npr = price_npr
        sub.trial_ends_at = None
        sub.notes = notes
        sub.updated_at = now
        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def expire(db: Session, sub: AppSubscription) -> AppSubscription:
        sub.status = "expired"
        sub.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def cancel(db: Session, sub: AppSubscription, notes: str | None = None) -> AppSubscription:
        sub.status = "cancelled"
        if notes:
            sub.notes = notes
        sub.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sub)
        return sub

    # ── Payments ────────────────────────────────────────────────────────────

    @staticmethod
    def create_payment(
        db: Session,
        tenant_id: str,
        app_code: str,
        amount_npr: float,
        plan: str,
        period_months: int,
        payment_method: str | None,
        notes: str | None,
    ) -> SubscriptionPayment:
        pmt = SubscriptionPayment(
            tenant_id=tenant_id,
            app_code=app_code,
            amount_npr=amount_npr,
            plan=plan,
            period_months=period_months,
            payment_method=payment_method,
            notes=notes,
        )
        db.add(pmt)
        db.commit()
        db.refresh(pmt)
        return pmt

    @staticmethod
    def get_payment(db: Session, payment_id: str) -> SubscriptionPayment | None:
        return db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()

    @staticmethod
    def list_payments_for_tenant(db: Session, tenant_id: str) -> list[SubscriptionPayment]:
        return (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.tenant_id == tenant_id)
            .order_by(SubscriptionPayment.created_at.desc())
            .all()
        )

    @staticmethod
    def list_pending_payments(db: Session) -> list[SubscriptionPayment]:
        return (
            db.query(SubscriptionPayment)
            .filter(SubscriptionPayment.status == "pending")
            .order_by(SubscriptionPayment.created_at)
            .all()
        )

    @staticmethod
    def confirm_payment(
        db: Session,
        pmt: SubscriptionPayment,
        confirmed_by: str,
        notes: str | None,
    ) -> SubscriptionPayment:
        pmt.status = "confirmed"
        pmt.confirmed_by = confirmed_by
        pmt.confirmed_at = datetime.now(timezone.utc)
        if notes:
            pmt.notes = notes
        pmt.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(pmt)
        return pmt

    @staticmethod
    def reject_payment(
        db: Session,
        pmt: SubscriptionPayment,
        notes: str | None,
    ) -> SubscriptionPayment:
        pmt.status = "rejected"
        if notes:
            pmt.notes = notes
        pmt.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(pmt)
        return pmt

    # ── Subscription Plans ───────────────────────────────────────────────────

    @staticmethod
    def list_plans(db: Session, app_code: str | None = None) -> list[SubscriptionPlan]:
        q = db.query(SubscriptionPlan)
        if app_code:
            q = q.filter(SubscriptionPlan.app_code == app_code)
        return q.order_by(SubscriptionPlan.app_code, SubscriptionPlan.plan).all()

    @staticmethod
    def get_plan(db: Session, plan_id: str) -> SubscriptionPlan | None:
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()

    @staticmethod
    def get_plan_by_app_plan(db: Session, app_code: str, plan: str) -> SubscriptionPlan | None:
        return (
            db.query(SubscriptionPlan)
            .filter(
                SubscriptionPlan.app_code == app_code,
                SubscriptionPlan.plan == plan,
                SubscriptionPlan.is_active == True,
            )
            .first()
        )

    @staticmethod
    def create_plan(db: Session, app_code: str, plan: str, price_npr: float, label: str) -> SubscriptionPlan:
        sp = SubscriptionPlan(app_code=app_code, plan=plan, price_npr=price_npr, label=label)
        db.add(sp)
        db.commit()
        db.refresh(sp)
        return sp

    @staticmethod
    def update_plan(
        db: Session,
        sp: SubscriptionPlan,
        price_npr: float | None = None,
        label: str | None = None,
        is_active: bool | None = None,
    ) -> SubscriptionPlan:
        if price_npr is not None:
            sp.price_npr = price_npr
        if label is not None:
            sp.label = label
        if is_active is not None:
            sp.is_active = is_active
        sp.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(sp)
        return sp

    # ── Admin: all subscriptions ─────────────────────────────────────────────

    @staticmethod
    def list_all_subscriptions(db: Session) -> list[tuple]:
        """Returns (AppSubscription, tenant_name, tenant_email) tuples."""
        return (
            db.query(AppSubscription, Tenant.name.label("tenant_name"), Tenant.business_email.label("tenant_email"))
            .join(Tenant, AppSubscription.tenant_id == Tenant.id)
            .order_by(AppSubscription.updated_at.desc())
            .all()
        )

    @staticmethod
    def list_all_payments(db: Session) -> list[tuple]:
        """All payments (any status), joined with tenant name."""
        return (
            db.query(SubscriptionPayment, Tenant.name.label("tenant_name"))
            .join(Tenant, SubscriptionPayment.tenant_id == Tenant.id)
            .order_by(SubscriptionPayment.created_at.desc())
            .all()
        )
