from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.dependencies import get_db
from backend.middleware.auth import get_current_user, require_role
from backend.schemas.alert import AlertCreate, AlertResponse, AlertStatusUpdate
from backend.schemas.endpoint_action import EndpointActionCreate, EndpointActionResponse
from backend.services.alert_service import (
    create_alert,
    get_alert,
    get_alerts,
    update_alert_status,
)
from backend.services.endpoint_action_service import (
    EndpointActionError,
    create_endpoint_actions,
    get_alert_endpoint_actions,
)


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"],
)


@router.post(
    "/{alert_id}/response-actions",
    response_model=list[EndpointActionResponse],
    status_code=status.HTTP_202_ACCEPTED,
)
def request_response_action(
    alert_id: UUID,
    action_data: EndpointActionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("ADMIN", "ANALYST")),
):
    try:
        return create_endpoint_actions(
            db,
            alert_id=alert_id,
            action_type=action_data.action_type,
            requested_by=current_user.get("username", "unknown"),
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except EndpointActionError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get(
    "/{alert_id}/response-actions",
    response_model=list[EndpointActionResponse],
)
def list_response_actions(
    alert_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("ADMIN", "ANALYST")),
):
    if db.get(Alert, alert_id) is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return get_alert_endpoint_actions(db, alert_id)


@router.post(
    "",
    response_model=AlertResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_alert(
    alert_data: AlertCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("ADMIN", "ANALYST")),
):
    return create_alert(db, alert_data)


# ============================================================
# GET ALL ALERTS
# ADMIN / ANALYST / VIEWER
# ============================================================

@router.get(
    "",
    response_model=list[AlertResponse],
)
def list_alerts(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_alerts(db)


# ============================================================
# GET ONE ALERT
# ADMIN / ANALYST / VIEWER
# ============================================================

@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
)
def read_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    alert = get_alert(
        db,
        alert_id,
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return alert


# ============================================================
# UPDATE ALERT STATUS
# ADMIN / ANALYST
# ============================================================

@router.patch(
    "/{alert_id}",
    response_model=AlertResponse,
)
def change_alert_status(
    alert_id: UUID,
    status_data: AlertStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("ADMIN", "ANALYST")
    ),
):
    allowed_statuses = {
        "OPEN",
        "INVESTIGATING",
        "RESOLVED",
    }

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid alert status",
        )

    alert = update_alert_status(
        db,
        alert_id,
        status_data.status,
    )

    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    return alert
