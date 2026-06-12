from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.customers import router as customers_router
from app.api.opportunities import router as opportunities_router
from app.api.factsheets import router as factsheets_router
from app.api.skills import router as skills_router
from app.api.dashboard import router as dashboard_router
from app.api.sow_templates import router as sow_templates_router
from app.api.cloud_pricing import router as cloud_pricing_router
from app.api.accounts import router as accounts_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(customers_router)
api_router.include_router(opportunities_router)
api_router.include_router(factsheets_router)
api_router.include_router(skills_router)
api_router.include_router(dashboard_router)
api_router.include_router(sow_templates_router)
api_router.include_router(cloud_pricing_router)
api_router.include_router(accounts_router)
