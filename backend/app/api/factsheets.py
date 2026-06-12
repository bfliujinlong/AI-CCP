from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_db
from app.schemas.factsheet import FactSheetCreate, FactSheetUpdate, FactSheetResponse, FactRegistryResponse
from app.services.factsheet_service import FactSheetService

router = APIRouter(prefix="/fact-sheets", tags=["Fact Sheets"])


async def get_current_user(authorization: str = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("/opportunity/{opportunity_id}", response_model=list[FactSheetResponse])
async def list_fact_sheets(
    opportunity_id: UUID,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = FactSheetService(db)
    fact_sheets = await service.get_by_opportunity(opportunity_id, category)
    return fact_sheets


@router.post("", response_model=FactSheetResponse, status_code=status.HTTP_201_CREATED)
async def create_fact_sheet(
    data: FactSheetCreate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    user_id = await get_current_user(authorization)
    service = FactSheetService(db)
    fact_sheet = await service.create(data, user_id=UUID(user_id))
    return fact_sheet


@router.put("/{fact_sheet_id}", response_model=FactSheetResponse)
async def update_fact_sheet(
    fact_sheet_id: UUID,
    data: FactSheetUpdate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    user_id = await get_current_user(authorization)
    service = FactSheetService(db)
    try:
        fact_sheet = await service.update(fact_sheet_id, data, user_id=UUID(user_id))
        return fact_sheet
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/registry", response_model=list[FactRegistryResponse])
async def list_fact_registry(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = FactSheetService(db)
    return await service.get_registry(category)
