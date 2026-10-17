from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.dependencies import get_db
from backend.middleware.auth import get_current_user, require_role
from backend.schemas.incident import (
    IncidentAssignmentUpdate,
    IncidentCreate,
    IncidentResponse,
    IncidentStatusUpdate,
)
from backend.schemas.incident_action import IncidentActionResponse
from backend.schemas.investigation_note import (
    InvestigationNoteCreate,
    InvestigationNoteResponse,
)
from backend.services.incident_action_service import (
    create_incident_action,
    get_incident_actions,
)
from backend.services.incident_service import (
    create_incident,
    get_incident,
    get_incidents,
    update_incident_assignment,
    update_incident_status,
)
from backend.services.investigation_note_service import (
    create_investigation_note,
    get_investigation_notes,
)


router = APIRouter(
    prefix="/incidents",
    tags=["Incidents"],
)


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_incident(
    incident_data: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    incident = create_incident(
        db,
        incident_data,
    )

    create_incident_action(
        db,
        incident_id=incident.incident_id,
        user_id=int(current_user["sub"]),
        action_type="CREATED",
        description="Incident created",
    )

    return incident


@router.get(
    "",
    response_model=list[IncidentResponse],
)
def list_all_incidents(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_incidents(db)


@router.get(
    "/{incident_id}/actions",
    response_model=list[IncidentActionResponse],
)
def list_incident_actions(
    incident_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return get_incident_actions(
        db,
        incident_id,
    )


@router.post(
    "/{incident_id}/notes",
    response_model=InvestigationNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_investigation_note(
    incident_id: UUID,
    note_data: InvestigationNoteCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    note = create_investigation_note(
        db,
        incident_id=incident_id,
        user_id=int(current_user["sub"]),
        content=note_data.content,
    )

    return {
        "note_id": note.note_id,
        "incident_id": note.incident_id,
        "user_id": note.user_id,
        "username": current_user["username"],
        "role": current_user["role"],
        "content": note.content,
        "created_at": note.created_at,
    }


@router.get(
    "/{incident_id}/notes",
    response_model=list[InvestigationNoteResponse],
)
def list_investigation_notes(
    incident_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return get_investigation_notes(
        db,
        incident_id,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
)
def read_incident(
    incident_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return incident


@router.patch(
    "/{incident_id}",
    response_model=IncidentResponse,
)
def change_incident_status(
    incident_id: UUID,
    status_data: IncidentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    allowed_statuses = {
        "OPEN",
        "INVESTIGATING",
        "RESOLVED",
        "CLOSED",
    }

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid incident status",
        )

    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    old_status = incident.status

    incident = update_incident_status(
        db,
        incident_id,
        status_data.status,
    )

    if old_status != status_data.status:
        create_incident_action(
            db,
            incident_id=incident.incident_id,
            user_id=int(current_user["sub"]),
            action_type="STATUS_CHANGED",
            description=(
                f"Status changed from "
                f"{old_status} to {status_data.status}"
            ),
        )

    return incident


@router.patch(
    "/{incident_id}/assign",
    response_model=IncidentResponse,
)
def assign_incident(
    incident_id: UUID,
    assignment_data: IncidentAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    incident = get_incident(
        db,
        incident_id,
    )

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    old_assigned_to = incident.assigned_to
    new_assigned_to = assignment_data.assigned_to

    incident = update_incident_assignment(
        db,
        incident_id,
        new_assigned_to,
    )

    if old_assigned_to != new_assigned_to:
        if new_assigned_to:
            action_type = "ASSIGNED"
            description = (
                f"Incident assigned to {new_assigned_to}"
            )
        else:
            action_type = "UNASSIGNED"
            description = "Incident assignment removed"

        create_incident_action(
            db,
            incident_id=incident.incident_id,
            user_id=int(current_user["sub"]),
            action_type=action_type,
            description=description,
        )

    return incident
