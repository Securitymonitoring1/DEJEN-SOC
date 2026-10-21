from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.dependencies import get_db
from backend.middleware.auth import get_current_user, require_role
from backend.models.user import User
from backend.schemas.event import (
    EventCreate,
    EventDeleteRequest,
    EventDeleteResponse,
    EventResponse,
)
from backend.services.auth_service import verify_password
from backend.services.event_ingestion_service import ingest_event
from backend.services.event_service import delete_events, get_event, get_events


router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


def _verify_admin_password(db: Session, current_user: dict, password: str) -> None:
    user_id = int(current_user["sub"])
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator password is incorrect")


@router.delete("", response_model=EventDeleteResponse)
def delete_all_events(
    request_data: EventDeleteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("ADMIN")),
):
    _verify_admin_password(db, current_user, request_data.password)
    return {"deleted_events": delete_events(db)}


@router.delete("/{event_id}", response_model=EventDeleteResponse)
def delete_one_event(
    event_id: UUID,
    request_data: EventDeleteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("ADMIN")),
):
    _verify_admin_password(db, current_user, request_data.password)
    deleted_events = delete_events(db, event_id)
    if not deleted_events:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return {"deleted_events": deleted_events}


# ============================================================
# CREATE EVENT
# ADMIN or ANALYST
# ============================================================

@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    return ingest_event(db, event_data)


# ============================================================
# GET ALL EVENTS
# ADMIN / ANALYST / VIEWER
# ============================================================

@router.get(
    "",
    response_model=list[EventResponse],
)
def list_events(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_events(db)


# ============================================================
# GET ONE EVENT
# ADMIN / ANALYST / VIEWER
# ============================================================

@router.get(
    "/{event_id}",
    response_model=EventResponse,
)
def read_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    event = get_event(
        db,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return event
