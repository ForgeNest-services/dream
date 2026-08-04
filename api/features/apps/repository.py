from sqlalchemy.orm import Session
from shared_models import App


class AppRepository:
    @staticmethod
    def list_public(db: Session) -> list[App]:
        return (
            db.query(App)
            .filter(App.is_active == True, App.is_public == True)
            .order_by(App.display_order, App.name)
            .all()
        )

    @staticmethod
    def list_all(db: Session) -> list[App]:
        return db.query(App).order_by(App.display_order, App.name).all()

    @staticmethod
    def get_by_code(db: Session, code: str) -> App | None:
        return db.query(App).filter(App.code == code).first()

    @staticmethod
    def get_by_slug(db: Session, slug: str) -> App | None:
        return db.query(App).filter(App.slug == slug).first()
