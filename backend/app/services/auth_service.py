from __future__ import annotations
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.models import User
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserCreate, UserUpdate, Token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def authenticate(self, username: str, password: str) -> Token | None:
        user = await self.user_repo.get_by_username(username)
        if not user or not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        access_token = create_access_token(subject=str(user.id))
        return Token(access_token=access_token)

    async def get_current_user(self, user_id: UUID) -> User | None:
        return await self.user_repo.get_by_id(user_id)

    async def register(self, user_data: UserCreate) -> User:
        existing = await self.user_repo.get_by_username(user_data.username)
        if existing:
            raise ValueError("Username already exists")
        existing_email = await self.user_repo.get_by_email(user_data.email)
        if existing_email:
            raise ValueError("Email already exists")
        user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role,
        )
        return await self.user_repo.create(user)

    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        for field, value in user_data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        return await self.user_repo.update(user)
