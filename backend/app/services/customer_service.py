from __future__ import annotations
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Customer
from app.repositories.customer_repo import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CustomerRepository(db)

    async def get_by_id(self, customer_id: UUID) -> Customer | None:
        return await self.repo.get_by_id(customer_id)

    async def get_list(
        self, page: int = 1, page_size: int = 20, search: str | None = None, is_active: bool | None = None
    ) -> tuple[list[Customer], int]:
        skip = (page - 1) * page_size
        customers = await self.repo.get_all(skip=skip, limit=page_size, search=search, is_active=is_active)
        total = await self.repo.count(search=search, is_active=is_active)
        return customers, total

    async def create(self, data: CustomerCreate, owner_id: UUID) -> Customer:
        customer = Customer(
            name=data.name,
            industry=data.industry,
            contact_name=data.contact_name,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
            address=data.address,
            description=data.description,
            owner_id=owner_id,
        )
        return await self.repo.create(customer)

    async def update(self, customer_id: UUID, data: CustomerUpdate) -> Customer:
        customer = await self.repo.get_by_id(customer_id)
        if not customer:
            raise ValueError("Customer not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(customer, field, value)
        return await self.repo.update(customer)

    async def delete(self, customer_id: UUID) -> None:
        customer = await self.repo.get_by_id(customer_id)
        if not customer:
            raise ValueError("Customer not found")
        await self.repo.delete(customer)
