"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(200)),
        sa.Column('role', sa.String(50), nullable=False, server_default='consultant'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('phone', sa.String(20), unique=True),
        sa.Column('phone_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('phone_verified_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])

    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.Text),
        sa.Column('permissions', postgresql.JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create customers table
    op.create_table(
        'customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False, index=True),
        sa.Column('industry', sa.String(100)),
        sa.Column('contact_name', sa.String(200)),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('contact_phone', sa.String(50)),
        sa.Column('address', sa.Text),
        sa.Column('description', sa.Text),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_customers_name', 'customers', ['name'])

    # Create opportunities table
    op.create_table(
        'opportunities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(100)),
        sa.Column('status', sa.String(50), nullable=False, server_default='discovery', index=True),
        sa.Column('estimated_revenue', sa.Numeric(15, 2)),
        sa.Column('probability', sa.Integer, server_default='50'),
        sa.Column('description', sa.Text),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_opportunities_name', 'opportunities', ['name'])
    op.create_index('ix_opportunities_status', 'opportunities', ['status'])

    # Create fact_sheets table
    op.create_table(
        'fact_sheets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('opportunity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('opportunities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('facts', postgresql.JSONB, nullable=False, server_default='{}'),
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create skills table
    op.create_table(
        'skills',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False, unique=True),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('description', sa.Text),
        sa.Column('prompt_template', sa.Text),
        sa.Column('input_schema', postgresql.JSONB, server_default='{}'),
        sa.Column('output_schema', postgresql.JSONB, server_default='{}'),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create prompt_templates table
    op.create_table(
        'prompt_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('template', sa.Text, nullable=False),
        sa.Column('skill_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('skills.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create fact_registry table
    op.create_table(
        'fact_registry',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('fact_name', sa.String(200), nullable=False, unique=True),
        sa.Column('fact_type', sa.String(50), nullable=False, server_default='string'),
        sa.Column('description', sa.Text),
        sa.Column('validation_rule', postgresql.JSONB, server_default='{}'),
        sa.Column('required', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('category', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('fact_registry')
    op.drop_table('prompt_templates')
    op.drop_table('skills')
    op.drop_table('fact_sheets')
    op.drop_table('opportunities')
    op.drop_table('customers')
    op.drop_table('roles')
    op.drop_table('users')
