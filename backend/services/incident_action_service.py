from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.incident_action import IncidentAction
from backend.models.user import User


def create_incident_action(
    db: Session,
    incident_id: UUID,
    user_id: int,
    action_type: str,
    description: str,
) -> IncidentAction:
    action = IncidentAction(
        incident_id=incident_id,
        user_id=user_id,
        action_type=action_type,
        description=description,
    )

    db.add(action)
    db.commit()
    db.refresh(action)

    return action


def get_incident_actions(
    db: Session,
    incident_id: UUID,
) -> list[dict]:
    statement = (
        select(
            IncidentAction,
            User.username,
            User.role,
        )
        .join(
            User,
            IncidentAction.user_id == User.id,
        )
        .where(
            IncidentAction.incident_id == incident_id
        )
        .order_by(
            IncidentAction.created_at.desc()
        )
    )

    results = db.execute(statement).all()

    return [
        {
            "action_id": action.action_id,
            "incident_id": action.incident_id,
            "user_id": action.user_id,
            "username": username,
            "role": role,
            "action_type": action.action_type,
            "description": action.description,
            "created_at": action.created_at,
        }
        for action, username, role in results
    ]
