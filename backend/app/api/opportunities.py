from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_db
from app.schemas.opportunity import OpportunityCreate, OpportunityUpdate, OpportunityResponse, OpportunityListResponse
from app.services.opportunity_service import OpportunityService

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


async def get_current_user(authorization: str = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    customer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = OpportunityService(db)
    opportunities, total = await service.get_list(
        page=page, page_size=page_size, search=search, status=status, customer_id=customer_id
    )
    return OpportunityListResponse(
        items=[OpportunityResponse.model_validate(o) for o in opportunities],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats")
async def get_opportunity_stats(
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = OpportunityService(db)
    return await service.get_stats()


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = OpportunityService(db)
    opportunity = await service.get_by_id(opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opportunity


@router.post("", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    data: OpportunityCreate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    user_id = await get_current_user(authorization)
    service = OpportunityService(db)
    opportunity = await service.create(data, owner_id=UUID(user_id))
    return opportunity


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: UUID,
    data: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = OpportunityService(db)
    try:
        opportunity = await service.update(opportunity_id, data)
        return opportunity
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = OpportunityService(db)
    try:
        await service.delete(opportunity_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
