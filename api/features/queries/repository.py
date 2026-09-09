from sqlalchemy.orm import Session
from shared_models import Query


class QueryRepository:
    @staticmethod
    def create(
        db: Session,
        name: str,
        email: str,
        message: str,
        business_name: str | None = None,
        phone: str | None = None,
        app_interest: str | None = None,
    ) -> Query:
        query = Query(
            name=name,
            email=email,
            business_name=business_name,
            phone=phone,
            app_interest=app_interest,
            message=message,
        )
        db.add(query)
        db.commit()
        db.refresh(query)
        return query

    @staticmethod
    def list_paginated(db: Session, offset: int, limit: int) -> tuple[list[Query], int]:
        base = db.query(Query).order_by(Query.created_at.desc())
        total = base.count()
        items = base.offset(offset).limit(limit).all()
        return items, total
