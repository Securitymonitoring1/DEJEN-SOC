from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.investigation_note import InvestigationNote
from backend.models.user import User


def create_investigation_note(
    db: Session,
    incident_id: UUID,
    user_id: int,
    content: str,
) -> InvestigationNote:
    note = InvestigationNote(
        incident_id=incident_id,
        user_id=user_id,
        content=content,
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    return note


def get_investigation_notes(
    db: Session,
    incident_id: UUID,
) -> list[dict]:
    statement = (
        select(
            InvestigationNote,
            User.username,
            User.role,
        )
        .join(
            User,
            InvestigationNote.user_id == User.id,
        )
        .where(
            InvestigationNote.incident_id == incident_id
        )
        .order_by(
            InvestigationNote.created_at.desc()
        )
    )

    results = db.execute(statement).all()

    return [
        {
            "note_id": note.note_id,
            "incident_id": note.incident_id,
            "user_id": note.user_id,
            "username": username,
            "role": role,
            "content": note.content,
            "created_at": note.created_at,
        }
        for note, username, role in results
    ]
