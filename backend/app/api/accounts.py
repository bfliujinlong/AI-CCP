from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.models.models import User
from app.services.phone_verify_service import phone_verify_service
from jose import jwt, JWTError
from app.core.config import settings

router = APIRouter(prefix="/accounts", tags=["Account Management"])


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")


class PhoneVerifyCheckRequest(BaseModel):
    phone: str = Field(..., pattern=r"^1[3-9]\d{9}$")
    code: str = Field(..., min_length=6, max_length=6)


class AccountCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=6, max_length=100)
    full_name: Optional[str] = None
    role: str = Field(default="consultant")
    phone: Optional[str] = Field(None, pattern=r"^1[3-9]\d{9}$")
    phone_code: Optional[str] = None


class AccountUpdateRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None


class PasswordResetRequest(BaseModel):
    user_id: UUID
    new_password: str = Field(..., min_length=6, max_length=100)


class AccountListResponse(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    phone: Optional[str] = None
    phone_verified: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SecurityConfigResponse(BaseModel):
    default_username: str
    default_password_hint: str
    default_password: str
    show_default_on_login: bool = False


async def _require_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.post("/phone/send-code")
async def send_phone_code(req: PhoneVerifyRequest):
    result = phone_verify_service.send_code(req.phone)
    return result


@router.post("/phone/verify-code")
async def verify_phone_code(req: PhoneVerifyCheckRequest):
    valid = phone_verify_service.verify_code(req.phone, req.code)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码无效或已过期")
    return {"verified": True, "phone": req.phone}


@router.get("/", response_model=List[AccountListResponse])
async def list_accounts(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(User).offset(skip).limit(limit).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users


@router.get("/count")
async def count_accounts(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(func.count(User.id)))
    total = result.scalar_one()
    active_result = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active = active_result.scalar_one()
    return {"total": total, "active": active}


@router.post("/", response_model=AccountListResponse)
async def create_account(
    req: AccountCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")

    existing_email = await db.execute(select(User).where(User.email == req.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已存在")

    phone_verified = False
    if req.phone:
        if req.phone_code:
            valid = phone_verify_service.verify_code(req.phone, req.phone_code)
            if not valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机验证码无效")
            phone_verified = True
        existing_phone = await db.execute(select(User).where(User.phone == req.phone))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已被使用")

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name,
        role=req.role,
        phone=req.phone,
        phone_verified=phone_verified,
        phone_verified_at=datetime.utcnow() if phone_verified else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}", response_model=AccountListResponse)
async def update_account(
    user_id: UUID,
    req: AccountUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    update_data = req.model_dump(exclude_unset=True)
    if "phone" in update_data and update_data["phone"] != user.phone:
        if update_data["phone"]:
            existing_phone = await db.execute(select(User).where(User.phone == update_data["phone"]))
            if existing_phone.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已被使用")
        user.phone_verified = False
        user.phone_verified_at = None

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: UUID,
    req: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    if req.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户ID不匹配")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    user.hashed_password = get_password_hash(req.new_password)
    await db.commit()
    return {"message": "密码重置成功"}


@router.delete("/{user_id}")
async def delete_account(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    if user.username == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="不能删除管理员账户")

    user.is_active = False
    await db.commit()
    return {"message": "账户已禁用"}


@router.get("/security-config", response_model=SecurityConfigResponse)
async def get_security_config(_: str = Depends(_require_admin)):
    return SecurityConfigResponse(
        default_username=settings.DEFAULT_ADMIN_USERNAME,
        default_password_hint=f"{settings.DEFAULT_ADMIN_PASSWORD[0]}***{settings.DEFAULT_ADMIN_PASSWORD[-1]}",
        default_password=settings.DEFAULT_ADMIN_PASSWORD,
        show_default_on_login=settings.SHOW_DEFAULT_PASSWORD_ON_LOGIN,
    )
