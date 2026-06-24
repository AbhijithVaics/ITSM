"""
V1 API router aggregator.
All v1 sub-routers are mounted here, then this single router is
included in main.py under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.groups import router as groups_router
from app.api.v1.work_items import router as work_items_router
from app.api.v1.email_webhook import router as email_webhook_router
from app.api.v1.admin.graph_config import router as graph_config_router
from app.api.v1.notifications import router as notifications_router

# Phase 1 only includes auth.
# Phase 2+ will add: work_items, incidents, users, groups, etc.

api_v1_router = APIRouter()

# ── Auth ──
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# ── Phase 2 routes ──
api_v1_router.include_router(users_router, prefix="/admin/users", tags=["Admin - Users"])
api_v1_router.include_router(groups_router, prefix="/admin/groups", tags=["Admin - Groups"])
api_v1_router.include_router(work_items_router, prefix="/work-items", tags=["Work Items"])

# ── Phase 4 routes ──
api_v1_router.include_router(email_webhook_router, prefix="/email/webhook", tags=["Email Webhook"])
api_v1_router.include_router(graph_config_router, prefix="/admin/graph", tags=["Admin - Graph"])

# ── Phase 5 routes ──
api_v1_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])

# ── Phase 6 routes ──
from app.api.v1.changes import router as changes_router
from app.api.v1.approvals import router as approvals_router
api_v1_router.include_router(changes_router, prefix="/changes", tags=["Change Management"])
api_v1_router.include_router(approvals_router, prefix="/approvals", tags=["Change Approvals"])

# ── Phase 7 routes ──
from app.api.v1.search import router as search_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.admin.audit import router as audit_router
from app.api.v1.admin.sla import router as sla_router

api_v1_router.include_router(search_router, prefix="/search", tags=["Search"])
api_v1_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_v1_router.include_router(audit_router, prefix="/admin/audit", tags=["Admin - Audit"])
api_v1_router.include_router(sla_router, prefix="/admin/sla", tags=["Admin - SLA"])


