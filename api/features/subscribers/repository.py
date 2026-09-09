from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from shared_models import Subscriber


class SubscriberRepository:
    @staticmethod
    def create(db: Session, email: str) -> dict:
        """Re-subscribing with the same email is a no-op success, not an
        error -- the unique constraint on Subscriber.email is what makes
        that safe to just swallow rather than pre-checking existence."""
        subscriber = Subscriber(email=email)
        db.add(subscriber)
        try:
            db.commit()
            db.refresh(subscriber)
            return {"success": True, "subscriber": subscriber, "already_subscribed": False}
        except IntegrityError:
            db.rollback()
            existing = db.query(Subscriber).filter(Subscriber.email == email).first()
            return {"success": True, "subscriber": existing, "already_subscribed": True}

    @staticmethod
    def list_paginated(db: Session, offset: int, limit: int) -> tuple[list[Subscriber], int]:
        base = db.query(Subscriber).order_by(Subscriber.created_at.desc())
        total = base.count()
        items = base.offset(offset).limit(limit).all()
        return items, total
