from __future__ import annotations
from typing import List, Dict, Optional, Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Customer


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, customer_id: UUID) -> Customer | None:
        result = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        return result.scalar_one_or_none()

    async def get_all(
        self, skip: int = 0, limit: int = 20, search: str | None = None, is_active: bool | None = None
    ) -> List[Customer]:
        query = select(Customer)
        if search:
            query = query.where(Customer.name.ilike(f"%{search}%"))
        if is_active is not None:
            query = query.where(Customer.is_active == is_active)
        query = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(self, search: str | None = None, is_active: bool | None = None) -> int:
        query = select(func.count(Customer.id))
        if search:
            query = query.where(Customer.name.ilike(f"%{search}%"))
        if is_active is not None:
            query = query.where(Customer.is_active == is_active)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        await self.db.flush()
        return customer

    async def update(self, customer: Customer) -> Customer:
        await self.db.flush()
        return customer

    async def delete(self, customer: Customer) -> None:
        await self.db.delete(customer)
        await self.db.flush()
