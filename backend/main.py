from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.handlers.alerts import router as alerts_router
from backend.handlers.agents import router as agents_router
from backend.handlers.dashboard import router as dashboard_router
from backend.handlers.events import router as events_router
from backend.handlers.incidents import router as incidents_router
from backend.handlers.users import router as users_router
from backend.middleware.auth import get_current_user, require_role


app = FastAPI(
    title="Dejen Security Monitoring Platform",
    description="Security monitoring and incident response backend",
    version="1.0.0",
)

# Allow the deployed DEJEN SOC frontend to access the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dejen-frontend-2s3x.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "dejen-backend",
    }


@app.get("/protected")
def protected_endpoint(
    current_user: dict = Depends(get_current_user),
):
    return {
        "message": "You have access to the protected endpoint",
        "user": current_user,
    }


@app.get("/admin-test")
def admin_test(
    current_user: dict = Depends(require_role("ADMIN")),
):
    return {
        "message": "ADMIN access granted",
        "user": current_user,
    }


# Authentication
app.include_router(users_router)

# Events
app.include_router(events_router)
app.include_router(agents_router)

# Alerts
app.include_router(alerts_router)

# Incidents
app.include_router(incidents_router)

# Dashboard
app.include_router(dashboard_router)
