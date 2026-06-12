CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(50) NOT NULL DEFAULT 'consultant',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    industry VARCHAR(100),
    contact_name VARCHAR(200),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'discovery',
    estimated_revenue DECIMAL(15, 2),
    probability INTEGER DEFAULT 50,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fact_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    facts JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(opportunity_id, category, version)
);

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    description TEXT,
    prompt_template TEXT,
    input_schema JSONB DEFAULT '{}',
    output_schema JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    template TEXT NOT NULL,
    skill_id UUID REFERENCES skills(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, version)
);

CREATE TABLE IF NOT EXISTS fact_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fact_name VARCHAR(200) NOT NULL UNIQUE,
    fact_type VARCHAR(50) NOT NULL DEFAULT 'string',
    description TEXT,
    validation_rule JSONB DEFAULT '{}',
    required BOOLEAN NOT NULL DEFAULT FALSE,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO roles (name, description, permissions) VALUES
    ('admin', 'System Administrator', '["all"]'),
    ('manager', 'Project Manager', '["customer:read", "customer:write", "opportunity:read", "opportunity:write", "factsheet:read", "factsheet:write", "quotation:read", "quotation:write", "sow:read", "sow:write", "wbs:read", "wbs:write"]'),
    ('consultant', 'Cloud Consultant', '["customer:read", "customer:write", "opportunity:read", "opportunity:write", "factsheet:read", "factsheet:write", "quotation:read", "sow:read", "wbs:read"]'),
    ('viewer', 'Read Only', '["customer:read", "opportunity:read", "factsheet:read", "quotation:read", "sow:read", "wbs:read"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO fact_registry (fact_name, fact_type, description, validation_rule, required, category) VALUES
    ('vm_count', 'integer', 'Number of virtual machines', '{"min": 0}', TRUE, 'infrastructure'),
    ('database_count', 'integer', 'Number of databases', '{"min": 0}', TRUE, 'infrastructure'),
    ('region_count', 'integer', 'Number of regions', '{"min": 1}', TRUE, 'infrastructure'),
    ('security_level', 'enum', 'Security compliance level', '{"options": ["basic", "medium", "advanced"]}', TRUE, 'security'),
    ('vpc_count', 'integer', 'Number of VPCs', '{"min": 0}', FALSE, 'infrastructure'),
    ('account_count', 'integer', 'Number of cloud accounts', '{"min": 1}', TRUE, 'governance'),
    ('project_type', 'enum', 'Type of cloud project', '{"options": ["landing_zone", "migration", "big_data", "hybrid_cloud", "security", "cost_optimization"]}', TRUE, 'general'),
    ('current_cloud', 'enum', 'Current cloud provider', '{"options": ["on_premise", "aws", "azure", "aliyun", "huawei", "tencent", "hybrid"]}', TRUE, 'general'),
    ('target_cloud', 'enum', 'Target cloud provider', '{"options": ["aws", "azure", "aliyun", "huawei", "tencent", "hybrid"]}', TRUE, 'general'),
    ('budget_range', 'string', 'Estimated budget range', '{}', FALSE, 'general'),
    ('timeline_months', 'integer', 'Project timeline in months', '{"min": 1}', FALSE, 'general'),
    ('compliance_requirements', 'array', 'Compliance requirements', '{"options": ["ISO27001", "PCI-DSS", "GDPR", "MLPS", "SOC2"]}', FALSE, 'security')
ON CONFLICT (fact_name) DO NOTHING;

INSERT INTO skills (name, category, description, prompt_template, input_schema, output_schema) VALUES
    ('LZ-Discovery', 'landing_zone', 'Landing Zone discovery questions generator', 'Based on the following project context, generate a list of discovery questions for a Landing Zone project:

Project Type: {project_type}
Current Cloud: {current_cloud}
Target Cloud: {target_cloud}
Account Count: {account_count}
Region Count: {region_count}
Security Level: {security_level}

Please generate structured discovery questions grouped by category.', '{"project_type": "string", "current_cloud": "string", "target_cloud": "string", "account_count": "integer", "region_count": "integer", "security_level": "string"}', '{"questions": [{"category": "string", "question": "string", "purpose": "string"}]}'),
    ('LZ-SOW', 'landing_zone', 'Landing Zone SOW generator', 'Generate a Statement of Work for a Landing Zone project based on the following facts:

{facts}

Include: Project Overview, Scope, Deliverables, Assumptions, Risks, Timeline, and Team Structure.', '{"facts": "object"}', '{"scope": "string", "deliverables": ["string"], "assumptions": ["string"], "risks": ["string"], "timeline": "string", "team": "string"}'),
    ('Migration-WBS', 'migration', 'Migration WBS generator', 'Generate a Work Breakdown Structure for a cloud migration project:

VM Count: {vm_count}
Database Count: {database_count}
Source Cloud: {current_cloud}
Target Cloud: {target_cloud}

Break down into phases: Assessment, Design, Migration, Testing, Cutover.', '{"vm_count": "integer", "database_count": "integer", "current_cloud": "string", "target_cloud": "string"}', '{"phases": [{"name": "string", "tasks": [{"name": "string", "duration_days": "integer", "dependencies": ["string"]}]}]}'),
    ('Estimate-LZ', 'landing_zone', 'Landing Zone cost estimator', 'Estimate the cost for a Landing Zone implementation:

Account Count: {account_count}
Region Count: {region_count}
VPC Count: {vpc_count}
Security Level: {security_level}
Target Cloud: {target_cloud}

Provide estimate in person-days and cost.', '{"account_count": "integer", "region_count": "integer", "vpc_count": "integer", "security_level": "string", "target_cloud": "string"}', '{"person_days": "number", "cost_breakdown": [{"item": "string", "days": "number", "rate": "number", "total": "number"}], "total_cost": "number"}')
ON CONFLICT (name) DO NOTHING;
