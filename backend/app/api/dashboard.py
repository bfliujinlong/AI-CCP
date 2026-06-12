from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_db
from app.services.factsheet_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


async def get_current_user(authorization: str = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = DashboardService(db)
    return await service.get_stats()
