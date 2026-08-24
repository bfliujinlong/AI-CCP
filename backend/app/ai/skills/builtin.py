"""AICC 内置 Skill 定义库（AICC Builtin Skills）。

AI 链路：Skill → Prompt → LLM → Structured Output → Document（PDF/DOCX）

设计原则:
1. 命名与前端 Skill Center 兼容（Generate-*/Estimate-LZ/LZ-*/Migration-*）
2. 每个 Skill 都有 output_schema，用于结构化 LLM 输出与文档生成
3. 新增 Skill 只需在 BUILTIN_SKILLS 列表追加一项，重启自动同步到 DB

Skill 分类（22 个）:
- general (8):     Generate-FactSheet / -Quotation / -SOW / -WBS / -MeetingMinutes / -HLD / -LLD / -CutoverPlan
- landing_zone (4): Estimate-LZ / LZ-Discovery / LZ-SOW / LZ-HLD
- migration (5):    Migration-WBS / -Architecture / -Cutover / -DataSync / BigData-Migration-WBS
- security (2):     Security-Compliance-Check / Security-Risk-Assessment
- analysis (3):     Cost-Optimization / Risk-Register / PreSales-Architect
"""

from __future__ import annotations
from typing import Any, Dict, List


# Skill 输出文档格式: pdf / docx / md / none（none 表示不生成文档）
DOC_PDF = "pdf"
DOC_DOCX = "docx"
DOC_MD = "md"


BUILTIN_SKILLS: List[Dict[str, Any]] = [
    # ==================== General: Generate-* 系列（前端默认跳转路由） ====================
    {
        "name": "Generate-FactSheet",
        "category": "general",
        "version": "1.0",
        "description": "Fact Sheet 生成器 - 基于项目信息自动生成结构化 Fact Sheet（资源画像/合规/架构/团队），输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云迁移售前架构师。请基于以下项目信息生成结构化 Fact Sheet。

项目类型: {project_type}
当前云: {current_cloud}
目标云: {target_cloud}
VM 数量: {vm_count}
数据库数量: {database_count}
Region 数量: {region_count}
账号数量: {account_count}
VPC 数量: {vpc_count}
安全等级: {security_level}
存储容量(TB): {storage_tb}
业务应用数量: {app_count}
Kubernetes 集群数: {k8s_cluster_count}
预算范围: {budget_range}
项目周期(月): {timeline_months}

输出 JSON 必须包含:
- summary: 项目一句话总结
- infrastructure: 计算/存储/数据库/网络的规模画像
- security_compliance: 安全等级和合规要求
- architecture: 架构类型与设计要点
- team_estimate: 估算团队规模
- recommendations: 关键建议列表（5-10 条）
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_type": {"type": "string"},
                "current_cloud": {"type": "string"},
                "target_cloud": {"type": "string"},
                "vm_count": {"type": "integer"},
                "database_count": {"type": "integer"},
                "region_count": {"type": "integer"},
                "account_count": {"type": "integer"},
                "vpc_count": {"type": "integer"},
                "security_level": {"type": "string"},
                "storage_tb": {"type": "integer"},
                "app_count": {"type": "integer"},
                "k8s_cluster_count": {"type": "integer"},
                "budget_range": {"type": "string"},
                "timeline_months": {"type": "integer"},
            },
            "required": ["project_type", "current_cloud", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "infrastructure": {"type": "object"},
                "security_compliance": {"type": "object"},
                "architecture": {"type": "object"},
                "team_estimate": {"type": "object"},
                "recommendations": {"type": "array", "items": {"type": "string"}},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-Quotation",
        "category": "general",
        "version": "1.0",
        "description": "AI 报价生成器 - 基于 Fact Sheet 按 AC-MIG 定价模型生成详细报价（Workstream/角色/人天/单价/小计），输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云迁移报价专家，遵循 AC-MIG 定价方法论。请基于以下 Fact Sheet 生成报价。

Fact Sheet:
{facts}

定价要求:
1. 按 Workstream 拆分: Landing Zone / 迁移设计 / 数据迁移 / 应用迁移 / 切割切换 / 运维交接
2. 每个角色给出: 角色/人天/日单价/小计
3. 风险溢价系数: {risk_premium}
4. 输出总价（人民币¥）、总人天、报价备注

报价表（CSV 风格）:
workstream,role,person_days,daily_rate,subtotal
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "facts": {"type": "object"},
                "risk_premium": {"type": "number", "default": 1.1},
            },
            "required": ["facts"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "workstreams": {"type": "array"},
                "total_person_days": {"type": "number"},
                "total_amount": {"type": "number"},
                "currency": {"type": "string"},
                "notes": {"type": "string"},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-SOW",
        "category": "general",
        "version": "1.0",
        "description": "SOW 生成器 - 基于 Fact Sheet 生成标准 14 章结构工作说明书，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云迁移交付专家。请基于 Fact Sheet 生成标准 14 章 SOW。

Fact Sheet:
{facts}

标准 SOW 14 章:
1. 项目背景  2. 项目范围  3. 交付物清单  4. 假设与前提
5. 工作说明  6. 里程碑计划  7. 双方责任  8. 变更管理
9. 验收标准  10. 付款条款  11. 知识产权  12. 保密
13. 违约责任  14. 其它条款

每章输出 key_points（要点）和 open_items（待确认项）。
""",
        "input_schema": {
            "type": "object",
            "properties": {"facts": {"type": "object"}},
            "required": ["facts"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "chapters": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-WBS",
        "category": "general",
        "version": "1.0",
        "description": "WBS 生成器 - 基于 Fact Sheet 自动生成工作分解结构（含角色/工期/依赖/交付物），输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 PMO 专家。请基于 Fact Sheet 生成详细 WBS（Work Breakdown Structure）。

Fact Sheet:
{facts}

要求:
1. 按 Phase 组织（Phase 1-N）
2. 每个 Phase 含 task 列表：name/duration_days/role/dependencies/deliverable/level
3. 输出 total_days、start_date、end_date
4. 关键路径标识
""",
        "input_schema": {"type": "object", "properties": {"facts": {"type": "object"}}, "required": ["facts"]},
        "output_schema": {
            "type": "object",
            "properties": {
                "phases": {"type": "array"},
                "total_days": {"type": "integer"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-MeetingMinutes",
        "category": "general",
        "version": "1.0",
        "description": "会议纪要生成器 - 将会议文字稿结构化为摘要+决策+行动+风险+议程，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是会议纪要专家。请将以下会议文字稿结构化。

会议主题: {topic}
会议时间: {time}
参会人: {attendees}
文字稿:
{transcript}

输出:
- summary (200字内)
- decisions (决策项列表)
- action_items (行动项，含责任人/due_date)
- risks (风险点)
- next_agenda (下次会议议程)
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string"},
                "time": {"type": "string"},
                "attendees": {"type": "string"},
                "transcript": {"type": "string"},
            },
            "required": ["transcript"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "decisions": {"type": "array"},
                "action_items": {"type": "array"},
                "risks": {"type": "array"},
                "next_agenda": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-HLD",
        "category": "general",
        "version": "1.0",
        "description": "HLD（高级架构设计）生成器 - 输出 8 领域的高阶架构方案，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云架构师（CSP-Architect 级别）。请基于 Fact Sheet 生成 HLD（High-Level Design）。

Fact Sheet:
{facts}

HLD 8 大领域:
1. 账号与组织架构 (Account & Org)
2. 网络架构 (Network)
3. 安全与合规 (Security & Compliance)
4. 身份与访问 (IAM)
5. 计算 (Compute)
6. 存储 (Storage)
7. 数据库 (Database)
8. 监控运维 (Observability)

每个领域输出: 设计要点 / 关键组件 / 选型理由。
""",
        "input_schema": {"type": "object", "properties": {"facts": {"type": "object"}}, "required": ["facts"]},
        "output_schema": {
            "type": "object",
            "properties": {
                "domains": {"type": "array"},
                "design_principles": {"type": "array", "items": {"type": "string"}},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-LLD",
        "category": "general",
        "version": "1.0",
        "description": "LLD（详细架构设计）生成器 - 基于 HLD 输出参数表/拓扑图说明/部署步骤，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云架构师。请基于 HLD 输出 LLD（Low-Level Design），包含详细参数与部署步骤。

HLD 摘要:
{hld_summary}
目标云: {target_cloud}
Region: {region}

LLD 输出:
1. 网络拓扑（CIDR/路由表/安全组规则）
2. 计算实例规格表（实例类型/vCPU/内存/磁盘）
3. 数据库规格表（引擎/版本/HA 方案/备份策略）
4. 安全合规清单（KMS/RAM/WAF/DDoS）
5. 监控告警配置项
6. 部署步骤（Terraform/资源编排 ROS 模板）
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "hld_summary": {"type": "string"},
                "target_cloud": {"type": "string"},
                "region": {"type": "string"},
            },
            "required": ["hld_summary", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "network_topology": {"type": "object"},
                "compute_specs": {"type": "array"},
                "database_specs": {"type": "array"},
                "security_checklist": {"type": "array"},
                "monitoring_config": {"type": "object"},
                "deployment_steps": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Generate-CutoverPlan",
        "category": "general",
        "version": "1.0",
        "description": "切换计划生成器 - 输出分波次切换步骤/回滚方案/检查清单，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是云迁移切换专家。请基于以下信息生成切换计划（Cutover Plan）。

迁移范围:
{scope}
目标云: {target_cloud}
切换窗口(小时): {cutover_window}

输出:
1. 切换波次划分（建议 3-5 波）
2. 每波切换步骤（pre-cutover / cutover / post-cutover）
3. 关键检查清单（checklist）
4. 回滚方案（rollback plan）
5. 风险点和应急联系人
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "scope": {"type": "string"},
                "target_cloud": {"type": "string"},
                "cutover_window": {"type": "number"},
            },
            "required": ["scope", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "waves": {"type": "array"},
                "checklist": {"type": "array"},
                "rollback_plan": {"type": "object"},
                "risk_points": {"type": "array"},
            },
        },
        "status": "active",
    },

    # ==================== Landing Zone 系列 ====================
    {
        "name": "Estimate-LZ",
        "category": "landing_zone",
        "version": "1.0",
        "description": "Landing Zone 成本估算器 - 基于 Fact Sheet 自动估算 LZ 项目人天和成本，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 Landing Zone 实施专家。请基于以下信息估算 LZ 项目工作量与成本。

账号数: {account_count}
Region 数: {region_count}
VPC 数: {vpc_count}
安全等级: {security_level}
目标云: {target_cloud}
是否多账号: {multi_account}

输出:
1. 工作量明细（账号开通/网络规划/安全基线/IAM/监控 等）
2. 人天汇总（按角色）
3. 成本明细（人天成本 + 云资源成本）
4. 风险点
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "account_count": {"type": "integer"},
                "region_count": {"type": "integer"},
                "vpc_count": {"type": "integer"},
                "security_level": {"type": "string"},
                "target_cloud": {"type": "string"},
                "multi_account": {"type": "boolean"},
            },
            "required": ["account_count", "region_count", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "person_days_by_role": {"type": "array"},
                "cost_breakdown": {"type": "array"},
                "total_person_days": {"type": "number"},
                "total_cost": {"type": "number"},
                "risks": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "LZ-Discovery",
        "category": "landing_zone",
        "version": "1.0",
        "description": "Landing Zone 发现问题生成器 - 自动生成项目发现阶段的关键问题清单（治理/账号/网络/安全/IAM/合规），输出文档格式 PDF",
        "document_format": DOC_PDF,
        "prompt_template": """你是 LZ 咨询顾问。请基于以下项目背景生成 Landing Zone 发现问题清单。

项目类型: {project_type}
当前云: {current_cloud}
目标云: {target_cloud}
账号数: {account_count}
Region 数: {region_count}
安全等级: {security_level}
行业: {industry}

按六大领域分组（每组 3-5 个问题）:
- 治理 (Governance): 账号策略、组织结构、资源标签
- 网络 (Network): VPC 设计、专线、跨境、DNS
- 安全 (Security): 安全基线、加密、审计
- IAM: 身份目录、SSO、最小权限
- 合规 (Compliance): 等保/SOC2/ISO27001/GDPR
- 监控运维 (Ops): 监控、告警、备份、灾备

每个问题注明 priority（high/medium/low）和 purpose。
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_type": {"type": "string"},
                "current_cloud": {"type": "string"},
                "target_cloud": {"type": "string"},
                "account_count": {"type": "integer"},
                "region_count": {"type": "integer"},
                "security_level": {"type": "string"},
                "industry": {"type": "string"},
            },
            "required": ["project_type", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "categories": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "LZ-SOW",
        "category": "landing_zone",
        "version": "1.0",
        "description": "Landing Zone SOW 生成器 - 基于 Fact Sheet 自动生成 Landing Zone 项目工作说明书，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 LZ 交付专家。请基于 Fact Sheet 生成 Landing Zone SOW。

Fact Sheet:
{facts}

SOW 章节: 项目背景/范围/交付物/假设与前提/工作说明/里程碑/双方责任/变更管理/验收标准/付款条款/知识产权/保密/违约/其它
""",
        "input_schema": {"type": "object", "properties": {"facts": {"type": "object"}}, "required": ["facts"]},
        "output_schema": {
            "type": "object",
            "properties": {
                "chapters": {"type": "array"},
                "scope": {"type": "string"},
                "deliverables": {"type": "array"},
                "assumptions": {"type": "array"},
                "risks": {"type": "array"},
                "timeline": {"type": "string"},
                "team": {"type": "string"},
            },
        },
        "status": "active",
    },
    {
        "name": "LZ-HLD",
        "category": "landing_zone",
        "version": "1.0",
        "description": "Landing Zone 高级架构设计 - 输出 LZ 的多账号/网络/安全/IAM/合规整体架构，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 LZ 架构师。请基于以下信息生成 Landing Zone HLD。

账号数: {account_count}
Region 数: {region_count}
业务单元数: {business_units}
合规要求: {compliance_requirements}
目标云: {target_cloud}

LZ HLD 输出:
1. 多账号架构（管理账号/成员账号/OU 设计）
2. 网络架构（Hub-Spoke / Transit VPC / 专线 / DNS 规划）
3. 安全基线（KMS / 安全组 / WAF / DDoS）
4. IAM（RAM/SSO/角色权限）
5. 监控运维（日志/监控/告警/备份）
6. 合规映射（等保/SOC2/ISO27001 等）
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "account_count": {"type": "integer"},
                "region_count": {"type": "integer"},
                "business_units": {"type": "integer"},
                "compliance_requirements": {"type": "array"},
                "target_cloud": {"type": "string"},
            },
            "required": ["target_cloud", "account_count"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "account_structure": {"type": "object"},
                "network_architecture": {"type": "object"},
                "security_baseline": {"type": "object"},
                "iam_design": {"type": "object"},
                "monitoring_ops": {"type": "object"},
                "compliance_mapping": {"type": "object"},
            },
        },
        "status": "active",
    },

    # ==================== Migration 系列 ====================
    {
        "name": "Migration-WBS",
        "category": "migration",
        "version": "1.0",
        "description": "迁移项目 WBS 生成器 - 自动生成迁移项目工作分解结构，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是迁移专家。请基于以下信息生成迁移 WBS。

VM 数: {vm_count}
数据库数: {database_count}
源云: {current_cloud}
目标云: {target_cloud}
数据量(TB): {data_volume_tb}

Phase 划分:
1. 评估与设计（Assessment）
2. Landing Zone 准备
3. 数据迁移
4. 应用迁移
5. 切割切换
6. 验证与运维交接

每个 phase 给出 task 列表（name/duration_days/role/dependencies/deliverable）。
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "vm_count": {"type": "integer"},
                "database_count": {"type": "integer"},
                "current_cloud": {"type": "string"},
                "target_cloud": {"type": "string"},
                "data_volume_tb": {"type": "number"},
            },
            "required": ["vm_count", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "phases": {"type": "array"},
                "total_days": {"type": "integer"},
                "critical_path": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Migration-Architecture",
        "category": "migration",
        "version": "1.0",
        "description": "迁移架构方案设计 - 输出 6R 策略、迁移工具选型、网络/数据传输方案，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是迁移架构师。请基于 Fact Sheet 设计迁移架构方案。

Fact Sheet:
{facts}

输出:
1. 6R 策略划分（Rehost/Replatform/Refactor/Repurchase/Retain/Retire）—— 按资源类型分类
2. 迁移工具选型（服务器迁移中心 SMS / Data Transmission Service DTS / Database Migration Service）
3. 网络方案（专线 / VPN / 公网）
4. 数据迁移方案（在线/离线/混合）
5. 应用迁移策略（蓝绿/灰度/直接切换）
6. 风险评估
""",
        "input_schema": {"type": "object", "properties": {"facts": {"type": "object"}}, "required": ["facts"]},
        "output_schema": {
            "type": "object",
            "properties": {
                "strategy_6r": {"type": "array"},
                "tools": {"type": "array"},
                "network_plan": {"type": "object"},
                "data_migration": {"type": "object"},
                "app_migration": {"type": "object"},
                "risks": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Migration-Cutover",
        "category": "migration",
        "version": "1.0",
        "description": "迁移切换计划 - 输出分波次切换步骤、回滚方案、检查清单，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是迁移切换专家。请设计分波次切换计划。

迁移资源:
{resources}
目标云: {target_cloud}
切换窗口(小时): {cutover_window}

输出:
1. 切换波次划分（建议 3-5 波，按业务依赖关系）
2. 每波切换步骤: pre-cutover / cutover / post-cutover
3. 关键检查清单（数据库一致性、应用探活、DNS 切换等）
4. 回滚方案（每波都要有）
5. 风险点和应急联系人
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "resources": {"type": "string"},
                "target_cloud": {"type": "string"},
                "cutover_window": {"type": "number"},
            },
            "required": ["resources", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "waves": {"type": "array"},
                "checklist": {"type": "array"},
                "rollback_plan": {"type": "object"},
                "risk_points": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Migration-DataSync",
        "category": "migration",
        "version": "1.0",
        "description": "数据同步方案设计 - 输出数据库迁移/对象存储同步/增量同步策略，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是数据迁移专家。请设计数据同步方案。

数据库类型与数量: {db_types}
数据量(TB): {data_volume_tb}
源端: {source}
目标端: {target}
业务停机窗口(小时): {downtime_window}

输出:
1. 全量同步策略（停机/不停机）
2. 增量同步策略（DTS/OGG/原生工具）
3. 数据一致性校验方案
4. 回滚方案
5. 风险点和性能预期
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "db_types": {"type": "string"},
                "data_volume_tb": {"type": "number"},
                "source": {"type": "string"},
                "target": {"type": "string"},
                "downtime_window": {"type": "number"},
            },
            "required": ["db_types", "target"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "full_sync_strategy": {"type": "object"},
                "incremental_sync": {"type": "object"},
                "consistency_check": {"type": "object"},
                "rollback_plan": {"type": "object"},
                "risks": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "BigData-Migration-WBS",
        "category": "migration",
        "version": "1.0",
        "description": "大数据迁移 WBS - 覆盖 MaxCompute/Hive/Spark/DataWorks 等大数据组件迁移，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是大数据迁移专家。请生成大数据平台迁移 WBS。

数据量(TB): {data_volume_tb}
任务数: {task_count}
源大数据平台: {source_platform}
目标大数据平台: {target_platform}
组件清单: {components}

Phase 划分:
1. 大数据评估（数据画像/任务画像/依赖分析）
2. 集群准备（目标平台账号/集群/资源组）
3. 元数据迁移
4. 数据迁移（HDFS/OSS/对象存储）
5. 任务迁移（Trino→Spark/Hive→MaxCompute 等）
6. 调度迁移（Airflow/DataWorks/DolphinScheduler）
7. 数据校验与对账
8. 试运行与切换
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "data_volume_tb": {"type": "number"},
                "task_count": {"type": "integer"},
                "source_platform": {"type": "string"},
                "target_platform": {"type": "string"},
                "components": {"type": "string"},
            },
            "required": ["target_platform"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "phases": {"type": "array"},
                "total_days": {"type": "integer"},
                "key_risks": {"type": "array"},
            },
        },
        "status": "active",
    },

    # ==================== Security 系列 ====================
    {
        "name": "Security-Compliance-Check",
        "category": "security",
        "version": "1.0",
        "description": "安全合规检查 - 等保2.0/SOC2/ISO27001/GDPR 合规自评清单，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是安全合规专家。请对以下云架构进行合规自评。

目标云: {target_cloud}
合规标准: {compliance_standards}
业务系统: {business_systems}
数据敏感级别: {data_sensitivity}

输出合规自评表（按等保 2.0 / SOC 2 / ISO 27001 / GDPR 条款）:
- 控制项编号
- 控制项描述
- 当前状态（合规/部分合规/不合规）
- 差距描述
- 整改建议
- 责任人建议
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_cloud": {"type": "string"},
                "compliance_standards": {"type": "array"},
                "business_systems": {"type": "string"},
                "data_sensitivity": {"type": "string"},
            },
            "required": ["target_cloud", "compliance_standards"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "controls": {"type": "array"},
                "compliance_score": {"type": "number"},
                "critical_gaps": {"type": "array"},
            },
        },
        "status": "active",
    },
    {
        "name": "Security-Risk-Assessment",
        "category": "security",
        "version": "1.0",
        "description": "安全风险评估 - 识别云架构安全风险，给出风险等级与缓解措施，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是安全顾问。请基于架构信息评估安全风险。

架构摘要:
{architecture}

输出风险登记册:
1. 风险编号
2. 风险描述
3. 风险等级（高/中/低）
4. 影响范围
5. 缓解措施
6. 责任人
""",
        "input_schema": {"type": "object", "properties": {"architecture": {"type": "string"}}, "required": ["architecture"]},
        "output_schema": {
            "type": "object",
            "properties": {
                "risks": {"type": "array"},
                "risk_summary": {"type": "object"},
            },
        },
        "status": "active",
    },

    # ==================== Analysis 系列 ====================
    {
        "name": "Cost-Optimization",
        "category": "analysis",
        "version": "1.0",
        "description": "云成本优化方案 - 识别闲置/超配资源，给出预留实例/存储优化/弹性方案，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 FinOps 专家。请基于以下云资源清单生成成本优化方案。

目标云: {target_cloud}
VM 数: {vm_count}
数据库数: {database_count}
月度云支出(¥): {monthly_cost}
资源利用率: {utilization}

输出优化方案:
1. 当前成本分析（按服务分类）
2. 优化机会识别（表格：项目/当前成本/优化后成本/节省比例）
3. 短期优化（1-30天可执行）：闲置资源清理、存储降配、带宽优化
4. 中长期优化（1-6月）：预留实例、Savings Plans、弹性伸缩
5. 预估总节省金额和 ROI
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_cloud": {"type": "string"},
                "vm_count": {"type": "integer"},
                "database_count": {"type": "integer"},
                "monthly_cost": {"type": "number"},
                "utilization": {"type": "object"},
            },
            "required": ["target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "cost_analysis": {"type": "object"},
                "optimizations": {"type": "array"},
                "short_term_actions": {"type": "array"},
                "long_term_actions": {"type": "array"},
                "estimated_savings": {"type": "number"},
                "roi": {"type": "number"},
            },
        },
        "status": "active",
    },
    {
        "name": "Risk-Register",
        "category": "analysis",
        "version": "1.0",
        "description": "风险登记册 - 项目全生命周期风险识别与跟踪表，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是 PMO 风险专家。请为以下项目生成风险登记册。

项目类型: {project_type}
项目规模: {project_scale}
团队规模: {team_size}
项目周期(月): {timeline_months}

输出风险登记册（至少 10 条）:
1. 风险编号
2. 风险描述
3. 类别（技术/人员/进度/成本/合规/外部）
4. 概率（高/中/低）
5. 影响（高/中/低）
6. 风险等级（颜色）
7. 缓解措施
8. 应急方案
9. 责任人
10. 触发条件
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_type": {"type": "string"},
                "project_scale": {"type": "string"},
                "team_size": {"type": "integer"},
                "timeline_months": {"type": "integer"},
            },
            "required": ["project_type"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "risks": {"type": "array"},
                "summary_by_category": {"type": "object"},
            },
        },
        "status": "active",
    },
    {
        "name": "PreSales-Architect",
        "category": "analysis",
        "version": "1.0",
        "description": "售前架构师 - 多云架构方案设计、技术选型对比、POC 规划，输出文档格式 DOCX",
        "document_format": DOC_DOCX,
        "prompt_template": """你是资深云架构师，精通阿里云/华为云/腾讯云/AWS/Azure 多云架构设计。

项目类型: {project_type}
当前云: {current_cloud}
目标云: {target_cloud}
VM 数: {vm_count}
数据库数: {database_count}
Region 数: {region_count}
账号数: {account_count}
安全等级: {security_level}

请输出完整架构方案:
1. 架构概述与设计原则
2. 网络架构（VPC/子网/安全组/专线）
3. 安全与合规架构
4. 高可用与灾备方案
5. 多云技术选型对比表（功能差异/价格差异/迁移成本）
6. POC 验证计划（目标/范围/成功标准）
8. 预估架构风险与成本
""",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_type": {"type": "string"},
                "current_cloud": {"type": "string"},
                "target_cloud": {"type": "string"},
                "vm_count": {"type": "integer"},
                "database_count": {"type": "integer"},
                "region_count": {"type": "integer"},
                "account_count": {"type": "integer"},
                "security_level": {"type": "string"},
            },
            "required": ["project_type", "target_cloud"],
        },
        "output_schema": {
            "type": "object",
            "properties": {
                "overview": {"type": "string"},
                "network": {"type": "object"},
                "security": {"type": "object"},
                "ha_dr": {"type": "object"},
                "tech_comparison": {"type": "array"},
                "poc_plan": {"type": "object"},
                "risks": {"type": "array"},
            },
        },
        "status": "active",
    },
]


def list_builtin_skills() -> List[Dict[str, Any]]:
    """返回所有内置 skill 定义。"""
    return BUILTIN_SKILLS


def get_builtin_skill(name: str) -> Dict[str, Any] | None:
    """按 name 查找内置 skill。"""
    for skill in BUILTIN_SKILLS:
        if skill["name"] == name:
            return skill
    return None


def get_builtin_skills_count() -> int:
    """返回内置 skill 总数。"""
    return len(BUILTIN_SKILLS)