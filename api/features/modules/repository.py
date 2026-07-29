from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from shared_models import Module, ModuleSubscription
from utils.logger import logger


class ModuleRepository:
    @staticmethod
    def get_by_code(db: Session, code: str) -> Module:
        return db.query(Module).filter(Module.code == code).first()


class ModuleSubscriptionRepository:
    @staticmethod
    def get(db: Session, tenant_id: str, module_id: str) -> ModuleSubscription:
        return (
            db.query(ModuleSubscription)
            .filter(
                ModuleSubscription.tenant_id == tenant_id,
                ModuleSubscription.module_id == module_id,
            )
            .first()
        )

    @staticmethod
    def start_trial(db: Session, tenant_id: str, module_code: str) -> ModuleSubscription | None:
        module = ModuleRepository.get_by_code(db, module_code)
        if not module:
            logger.warning(f"Cannot start trial: module '{module_code}' not found")
            return None

        existing = ModuleSubscriptionRepository.get(db, tenant_id, module.id)
        if existing:
            logger.info(f"Trial not started: tenant {tenant_id} already has subscription for {module_code}")
            return existing

        now = datetime.now(timezone.utc)
        trial_ends = now + timedelta(days=module.default_trial_days)

        subscription = ModuleSubscription(
            tenant_id=tenant_id,
            module_id=module.id,
            plan_type="trial",
            status="trial",
            trial_started_at=now,
            trial_expires_at=trial_ends,
            starts_at=now,
            ends_at=trial_ends,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        logger.info(f"Trial started: tenant={tenant_id}, module={module_code}, expires={trial_ends.isoformat()}")
        return subscription
