from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.alert import Alert
from backend.schemas.alert import AlertCreate


def create_alert(db: Session, alert_data: AlertCreate) -> Alert:
    alert = Alert(**alert_data.model_dump(), status="OPEN")
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alerts(db: Session) -> list[Alert]:
    statement = select(Alert).order_by(Alert.created_at.desc())
    return list(db.scalars(statement).all())


def get_alert(db: Session, alert_id: UUID) -> Alert | None:
    statement = select(Alert).where(Alert.alert_id == alert_id)
    return db.scalar(statement)


def update_alert_status(
    db: Session,
    alert_id: UUID,
    status: str,
) -> Alert | None:
    alert = get_alert(db, alert_id)

    if alert is None:
        return None

    alert.status = status

    db.commit()
    db.refresh(alert)

    return alert
