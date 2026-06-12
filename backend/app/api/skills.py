from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_db
from app.schemas.skill import SkillCreate, SkillUpdate, SkillResponse, SkillExecuteRequest, SkillExecuteResponse
from app.services.skill_service import SkillService

router = APIRouter(prefix="/skills", tags=["Skills"])


async def get_current_user(authorization: str = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("", response_model=list[SkillResponse])
async def list_skills(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    return await service.get_all(category)


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: UUID,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    skill = await service.get_by_id(skill_id)
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")
    return skill


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    data: SkillCreate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    try:
        return await service.create(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    data: SkillUpdate,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    try:
        return await service.update(skill_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    try:
        await service.delete(skill_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/execute", response_model=SkillExecuteResponse)
async def execute_skill(
    request: SkillExecuteRequest,
    db: AsyncSession = Depends(get_db),
    authorization: str = None,
):
    await get_current_user(authorization)
    service = SkillService(db)
    try:
        return await service.execute(request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
