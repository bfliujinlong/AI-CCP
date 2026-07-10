from __future__ import annotations
import uuid as _uuid
from datetime import datetime
from typing import List, Dict, Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Numeric, JSON, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings


# SQLite-compatible UUID type: stores as String(36), accepts both str and uuid.UUID
class GUID(TypeDecorator):
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, _uuid.UUID):
            return str(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, _uuid.UUID):
            return value
        return _uuid.UUID(value)

    @property
    def python_type(self):
        return _uuid.UUID


# JSON type compatible with all dialects
if settings.DATABASE_URL.startswith("sqlite"):
    JSONType = JSON
else:
    from sqlalchemy.dialects.postgresql import JSONB as _JSONType

    JSONType = _JSONType

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="consultant")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    phone_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="owner", foreign_keys="Customer.owner_id")
    opportunities: Mapped[List["Opportunity"]] = relationship("Opportunity", back_populates="owner", foreign_keys="Opportunity.owner_id")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    permissions: Mapped[Dict] = mapped_column(JSONType, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100))
    contact_name: Mapped[Optional[str]] = mapped_column(String(200))
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50))
    address: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    owner_id: Mapped[Optional[_uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped[Optional["User"]] = relationship("User", back_populates="customers", foreign_keys=[owner_id])
    opportunities: Mapped[List["Opportunity"]] = relationship("Opportunity", back_populates="customer", cascade="all, delete-orphan")


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    customer_id: Mapped[_uuid.UUID] = mapped_column(GUID(), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="discovery", index=True)
    estimated_revenue: Mapped[Optional[float]] = mapped_column(Numeric(15, 2))
    probability: Mapped[int] = mapped_column(Integer, default=50)
    description: Mapped[Optional[str]] = mapped_column(Text)
    owner_id: Mapped[Optional[_uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="opportunities")
    owner: Mapped[Optional["User"]] = relationship("User", back_populates="opportunities", foreign_keys=[owner_id])
    fact_sheets: Mapped[List["FactSheet"]] = relationship("FactSheet", back_populates="opportunity", cascade="all, delete-orphan")


class FactSheet(Base):
    __tablename__ = "fact_sheets"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    opportunity_id: Mapped[_uuid.UUID] = mapped_column(GUID(), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    facts: Mapped[Dict] = mapped_column(JSONType, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[Optional[_uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    opportunity: Mapped["Opportunity"] = relationship("Opportunity", back_populates="fact_sheets")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0")
    description: Mapped[Optional[str]] = mapped_column(Text)
    prompt_template: Mapped[Optional[str]] = mapped_column(Text)
    input_schema: Mapped[Dict] = mapped_column(JSONType, default=dict)
    output_schema: Mapped[Dict] = mapped_column(JSONType, default=dict)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0")
    template: Mapped[str] = mapped_column(Text, nullable=False)
    skill_id: Mapped[Optional[_uuid.UUID]] = mapped_column(GUID(), ForeignKey("skills.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class FactRegistry(Base):
    __tablename__ = "fact_registry"

    id: Mapped[_uuid.UUID] = mapped_column(GUID(), primary_key=True, default=_uuid.uuid4)
    fact_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    fact_type: Mapped[str] = mapped_column(String(50), nullable=False, default="string")
    description: Mapped[Optional[str]] = mapped_column(Text)
    validation_rule: Mapped[Dict] = mapped_column(JSONType, default=dict)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
