from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.dependencies import get_db
from backend.middleware.auth import get_current_user, require_role
from backend.schemas.event import EventCreate, EventResponse
from backend.services.event_ingestion_service import ingest_event
from backend.services.event_service import get_event, get_events


router = APIRouter(
    prefix="/events",
    tags=["Events"],
)


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
