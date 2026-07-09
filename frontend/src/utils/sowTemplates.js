/**
 * SOW 模板生成器 - 按项目类型区分
 *
 * 支持的项目类型:
 *   - landing_zone:    Landing Zone 云基础架构建设
 *   - migration:       企业云迁移
 *   - big_data:        大数据平台建设
 *   - hybrid_cloud:    混合云架构
 *   - security:        安全加固
 *   - cost_optimization: 成本优化
 *
 * 每个生成函数接收 (facts, quotation, opportunityName) 参数，返回完整的 SOW 内容对象。
 * quotation 为报价数据(含 estimate/input/cost)，用于引用实际评估结果。
 */

const cloudNames = {
  aws: 'AWS', azure: 'Azure', gcp: 'GCP',
  aliyun: '阿里云', huawei: '华为云', tencent: '腾讯云',
  volcengine: '火山引擎', on_premise: '本地机房',
}
const typeNames = {
  landing_zone: 'Landing Zone', migration: '云迁移', big_data: '大数据平台',
  hybrid_cloud: '混合云', security: '安全加固', cost_optimization: '成本优化',
}
const secNames = { basic: '基础', medium: '中等', advanced: '高级' }

function getCloudName(cloud) { return cloudNames[cloud] || cloud || '云平台' }
function getTypeName(type) { return typeNames[type] || type || '云服务' }
function getSecName(level) { return secNames[level] || level || '基础' }

/**
 * 从报价数据中提取关键参数，用于增强 SOW 内容
 */
function extractQuoteParams(quotation) {
  const est = quotation?.estimate || {}
  const input = quotation?.input || {}
  const res = input.resources || {}
  const tech = input.techStack || {}
  const counts = input.counts || {}

  return {
    hasQuotation: !!quotation?.estimate,
    totalHours: est.totalHours || 0,
    totalWeeks: est.totalWeeks || 0,
    baseHours: est.baseHours || 0,
    phaseHours: est.phaseHours || {},
    appDaysAvg: est.appDaysAvg || 0,
    appCount: est.appAssessment?.summary?.count || 0,
    migrationDays: est.migrationDays || 0,
    resourceFactor: est.resourceFactor || 0,
    techComplexity: est.techComplexity || 0,
    // 资源数据(从报价输入)
    qVmCount: res.vms || 0,
    qDbCount: Object.values(res.databases || {}).reduce((s, v) => s + (Number(v) || 0), 0),
    qK8sNodes: res.kubernetes_nodes || 0,
    qContainers: res.container_instances || 0,
    qBusinessSystems: res.business_systems || 0,
    // 技术栈
    qLanguages: tech.languages || [],
    qFrameworks: tech.frameworks || [],
    qArchitecture: tech.architecture || '',
    qThirdParty: tech.thirdParty || '',
    // 团队
    qTeam: {
      junior: counts.junior || 0,
      mid: counts.mid || 0,
      senior: counts.senior || 0,
      pm: counts.pm || 0,
    },
    qTeamTotal: (counts.junior || 0) + (counts.mid || 0) + (counts.senior || 0) + (counts.pm || 0),
  }
}

/**
 * 根据报价团队配置生成团队列表
 */
function buildTeamFromQuotation(q) {
  const team = []
  if (q.qTeam.pm > 0) team.push({ role: '项目总监/PM', count: q.qTeam.pm, responsibility: '项目整体管控、客户沟通、风险管理' })
  if (q.qTeam.senior > 0) team.push({ role: '云架构师(高级)', count: q.qTeam.senior, responsibility: '架构设计、技术方案审核、关键技术攻关' })
  if (q.qTeam.mid > 0) team.push({ role: '云工程师(中级)', count: q.qTeam.mid, responsibility: '实施部署、配置开发、测试验证' })
  if (q.qTeam.junior > 0) team.push({ role: '云工程师(初级)', count: q.qTeam.junior, responsibility: '基础配置、文档编写、辅助测试' })
  return team.length > 0 ? team : null
}


// ============================================================================
// Landing Zone SOW
// ============================================================================
function generateLandingZoneSOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const targetCloud = getCloudName(facts.target_cloud)
  const accountCount = facts.account_count || q.qBusinessSystems || 1
  const regionCount = facts.region_count || 1
  const vpcCount = facts.vpc_count || 1
  const secLevel = getSecName(facts.security_level)
  const totalWeeks = q.totalWeeks || 10

  return {
    title: `${oppName} - Landing Zone 云基础架构建设工作说明书`,
    project_overview:
      `本项目旨在为${oppName}构建${targetCloud} Landing Zone 云基础架构。` +
      `项目覆盖${accountCount}个云账号、${regionCount}个Region、${vpcCount}个VPC的标准化建设，` +
      `安全等级为${secLevel}。通过建立标准化的多账号组织架构、集中式身份管理、安全合规网络、` +
      `统一审计日志和成本归因体系，为客户打造可扩展、可治理的云上基础环境。`,
    scope:
      `本项目工作范围包括${targetCloud} Landing Zone 的七大治理域：账号治理、身份管理、网络架构、` +
      `安全基线、合规审计、财务管理和运维监控。涵盖调研评估、方案设计、实施落地和验收转移四个阶段。`,
    scope_items: [
      { category: '账号治理', item: `多账号组织架构(Organization/OU)设计，覆盖${accountCount}个账号`, included: true },
      { category: '账号治理', item: '账号开通与标准化配置', included: true },
      { category: '身份管理', item: 'IAM 策略与权限体系设计', included: true },
      { category: '身份管理', item: 'SSO 单点登录集成(企业 IdP 对接)', included: true },
      { category: '网络架构', item: `VPC/子网/安全组设计，覆盖${vpcCount}个VPC`, included: true },
      { category: '网络架构', item: `${regionCount}个Region 网络互通方案`, included: true },
      { category: '安全基线', item: `${secLevel}安全等级基线配置`, included: true },
      { category: '安全基线', item: 'KMS 密钥管理与加密策略', included: true },
      { category: '合规审计', item: 'CloudTrail/操作审计日志集中化', included: true },
      { category: '合规审计', item: 'Config 配置合规检查', included: true },
      { category: '财务管理', item: '成本标签策略与分账体系', included: true },
      { category: '财务管理', item: '预算告警与成本看板', included: true },
      { category: '运维监控', item: 'CloudWatch/监控告警体系搭建', included: true },
      { category: '运维监控', item: 'IaC 代码仓库(Terraform)交付', included: true },
      { category: '知识转移', item: '运维文档与团队培训', included: true },
      { category: '不在范围', item: '业务应用迁移与部署', included: false },
      { category: '不在范围', item: '第三方软件许可证采购', included: false },
      { category: '不在范围', item: '专线/VPN 物理线路施工', included: false },
    ],
    deliverables: [
      { name: '项目需求确认书', description: '确认项目范围、目标、约束条件', milestone: 'M1-调研阶段' },
      { name: '云上 IT 治理现状调研报告', description: '现有账号/网络/安全/成本现状分析', milestone: 'M1-调研阶段' },
      { name: '合规差距分析报告', description: '目标合规要求与现状差距识别', milestone: 'M1-调研阶段' },
      { name: 'Landing Zone 高阶架构设计文档(HLD)', description: '七大治理域目标架构设计', milestone: 'M2-设计阶段' },
      { name: 'Landing Zone 低阶实施方案(LLD)', description: '含具体配置、IaC 代码结构、部署步骤', milestone: 'M2-设计阶段' },
      { name: 'IP 地址规划表', description: 'VPC/子网 CIDR 规划', milestone: 'M2-设计阶段' },
      { name: 'IAM 权限矩阵', description: '角色-权限映射表', milestone: 'M2-设计阶段' },
      { name: 'Landing Zone 基础架构(可运行环境)', description: '云上已部署的 Landing Zone 环境', milestone: 'M3-实施阶段' },
      { name: 'IaC 代码仓库', description: 'Terraform 模块化代码，可重复部署', milestone: 'M3-实施阶段' },
      { name: '验收报告', description: 'UAT 测试结果与验收确认', milestone: 'M4-验收阶段' },
      { name: '运维手册与培训材料', description: '日常运维操作手册、故障处理指南、培训PPT', milestone: 'M4-验收阶段' },
    ],
    assumptions: [
      '客户已具备目标云平台账号及管理员权限',
      '客户网络团队已准备好专线/VPN 连接方案',
      '客户企业提供企业身份认证源(IdP)，如 AD/LDAP/OIDC',
      '项目期间客户关键人员可参与评审会议和验收',
      '云平台服务配额满足项目需求，如需提升由客户配合申请',
      '安全等级要求以当前确认的为准，如需提升需另行评估',
      '客户已有或同意采购必要的第三方工具许可证',
    ],
    risks: [
      { risk: '云平台服务配额不足', impact: '高', mitigation: '项目启动阶段提前与云厂商确认配额并申请提升' },
      { risk: '企业 IdP 对接兼容性问题', impact: '中', mitigation: '设计阶段进行技术验证(POC)，预留适配时间' },
      { risk: '网络专线延迟或中断', impact: '高', mitigation: '提前测试专线连通性，准备 VPN 备选方案' },
      { risk: '安全合规要求变更', impact: '中', mitigation: '项目启动时冻结安全需求基线，变更走变更管理流程' },
      { risk: '客户人员配合不足', impact: '高', mitigation: '明确 RACI 矩阵，建立定期同步机制' },
      { risk: '多账号环境配置不一致', impact: '中', mitigation: '采用 IaC 统一部署，配置漂移检测' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天），分为调研、设计、实施、验收四个主要阶段。`,
    milestones: [
      { phase: 'M1-调研阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.12))}周`, deliverable: '需求确认书、现状调研报告、合规差距分析' },
      { phase: 'M2-设计阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.18))}周`, deliverable: 'HLD/LLD 设计文档、IP 规划表、IAM 矩阵' },
      { phase: 'M3-实施阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.45))}周`, deliverable: 'Landing Zone 环境、IaC 代码仓库' },
      { phase: 'M4-验收阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.10))}周`, deliverable: '验收报告、运维手册、培训交付' },
    ],
    team: buildTeamFromQuotation(q) || [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通、风险管理' },
      { role: '云架构师', count: 1, responsibility: 'Landing Zone 架构设计、技术方案审核' },
      { role: '云工程师', count: 2, responsibility: 'IaC 编写、Landing Zone 实施部署' },
      { role: '安全顾问', count: 1, responsibility: '安全基线设计、合规审计、IAM 策略' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪、客户协调' },
    ],
    acceptance_criteria: [
      '所有云账号 Landing Zone 配置完成并通过自动化验证',
      '多账号组织架构(Organization/OU)符合设计文档',
      'IAM/SSO 身份认证体系正常工作，权限矩阵验证通过',
      `网络连通性测试通过，覆盖${regionCount}个Region`,
      '安全合规检查通过，满足等保/合规要求',
      '操作审计日志集中收集并可查询',
      '成本标签策略生效，分账报表可生成',
      'IaC 代码可重复部署，通过验证测试',
      '运维文档交付并通过审核',
      '客户团队完成培训并通过考核',
    ],
  }
}


// ============================================================================
// 云迁移 SOW
// ============================================================================
function generateMigrationSOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const sourceCloud = getCloudName(facts.current_cloud)
  const targetCloud = getCloudName(facts.target_cloud)
  const vmCount = facts.vm_count || q.qVmCount || 0
  const dbCount = facts.database_count || q.qDbCount || 0
  const secLevel = getSecName(facts.security_level)
  const totalWeeks = q.totalWeeks || (vmCount > 200 ? 16 : vmCount > 50 ? 12 : 8)
  const appCount = q.appCount || facts.app_count || 0

  return {
    title: `${oppName} - 企业云迁移工作说明书`,
    project_overview:
      `本项目旨在为${oppName}实施从${sourceCloud}到${targetCloud}的业务系统迁移。` +
      `项目涉及${vmCount}台虚拟机和${dbCount}个数据库的迁移，安全等级为${secLevel}。` +
      `基于 6R 迁移策略(Rehost/Replatform/Refactor/Retire/Retain/Relocate)，` +
      `采用迁移工厂模式，保障业务连续性的前提下完成平滑迁移。`,
    scope:
      `本项目工作范围涵盖迁移评估与规划、迁移准备与基础架构搭建、迁移实施与割接、` +
      `验收与知识转移四个阶段。包括${vmCount}台服务器迁移和${dbCount}个数据库迁移。`,
    scope_items: [
      { category: '迁移评估', item: `${vmCount}台服务器资产盘点与分类`, included: true },
      { category: '迁移评估', item: `${dbCount}个数据库迁移可行性评估`, included: true },
      { category: '迁移评估', item: '应用依赖关系分析(端口/调用/数据流)', included: true },
      { category: '迁移评估', item: '6R 迁移策略制定(每台服务器/每个数据库)', included: true },
      { category: '迁移评估', item: 'TCO 总拥有成本对比分析', included: true },
      { category: '迁移规划', item: '目标云基础架构设计(VPC/安全/网络)', included: true },
      { category: '迁移规划', item: '分批迁移波浪规划与割接方案', included: true },
      { category: '迁移规划', item: '回滚预案设计', included: true },
      { category: '迁移准备', item: `${targetCloud}目标环境搭建`, included: true },
      { category: '迁移准备', item: '混合云网络打通(专线/VPN)', included: true },
      { category: '迁移准备', item: '迁移工具部署与配置(CMS/DCM等)', included: true },
      { category: '迁移实施', item: '服务器批量迁移(Rehost/Replatform)', included: true },
      { category: '迁移实施', item: '数据库迁移与数据同步(DTS/OGG等)', included: true },
      { category: '迁移实施', item: '应用割接与DNS切换', included: true },
      { category: '迁移实施', item: '迁移后系统验证与性能调优', included: true },
      { category: '知识转移', item: '运维文档与团队培训', included: true },
      { category: '不在范围', item: '新业务应用开发', included: false },
      { category: '不在范围', item: '源端系统改造(Refactor 除外)', included: false },
      { category: '不在范围', item: '第三方软件许可证采购', included: false },
    ],
    deliverables: [
      { name: '迁移评估报告', description: `含${vmCount}台服务器和${dbCount}个数据库的评估结果`, milestone: 'M1-评估阶段' },
      { name: '迁移规划书', description: '6R 策略、波浪规划、资源需求', milestone: 'M1-评估阶段' },
      { name: '应用依赖关系图', description: '服务器间调用关系、数据流向', milestone: 'M1-评估阶段' },
      { name: 'TCO 对比分析', description: `${sourceCloud} vs ${targetCloud} 三年 TCO 对比`, milestone: 'M1-评估阶段' },
      { name: '目标云基础架构设计文档', description: `VPC/安全组/IAM/监控设计`, milestone: 'M2-规划阶段' },
      { name: '割接方案与回滚预案', description: '逐应用割接步骤、回滚条件与操作', milestone: 'M2-规划阶段' },
      { name: '迁移工具部署文档', description: 'CMS/DCM/DTS 配置说明', milestone: 'M3-准备阶段' },
      { name: '服务器迁移记录', description: `每台服务器迁移日志与验证结果`, milestone: 'M4-实施阶段' },
      { name: '数据库迁移验证报告', description: `数据一致性校验、性能对比`, milestone: 'M4-实施阶段' },
      { name: '割接执行记录', description: '割接操作日志、DNS 切换记录', milestone: 'M4-实施阶段' },
      { name: '迁移验收报告', description: '迁移完成确认、遗留问题清单', milestone: 'M5-验收阶段' },
      { name: '运维手册与培训材料', description: '目标云运维操作手册、培训PPT', milestone: 'M5-验收阶段' },
    ],
    assumptions: [
      '客户已具备目标云平台账号及管理员权限',
      '源端系统运行稳定，迁移期间无重大变更',
      '客户提供完整的应用资产清单和依赖关系信息',
      '客户网络团队配合完成混合云网络打通',
      '业务团队配合提供割接窗口(通常为夜间/周末)',
      '云平台服务配额满足迁移目标端资源需求',
      '第三方软件许可证可在目标云平台继续使用或客户同意采购新许可',
      '迁移期间客户关键人员可参与割接值班',
    ],
    risks: [
      { risk: '迁移工具兼容性问题', impact: '高', mitigation: '评估阶段进行 POC 验证，准备备选迁移方案' },
      { risk: '应用依赖关系不完整', impact: '高', mitigation: '多维度采集依赖数据(网络抓包/配置分析/访谈)' },
      { risk: '数据库数据量大导致迁移超时', impact: '中', mitigation: '采用增量同步+停机割接模式，提前进行全量预迁移' },
      { risk: '割接期间业务中断超预期', impact: '高', mitigation: '制定详细回滚预案，设置最长允许中断时间' },
      { risk: '目标云性能不达标', impact: '中', mitigation: '迁移后进行性能压测，预留调优时间' },
      { risk: '第三方软件许可证不可迁移', impact: '中', mitigation: '评估阶段确认许可证条款，预算替代方案成本' },
      { risk: '客户人员配合不足', impact: '高', mitigation: '明确 RACI 矩阵，建立每日站会机制' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天，含应用迁移${q.appDaysAvg}人天、迁移服务${q.migrationDays}人天），分为评估、规划、准备、实施、验收五个阶段。`,
    milestones: [
      { phase: 'M1-评估阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.12))}周`, deliverable: '迁移评估报告、6R策略、TCO分析' },
      { phase: 'M2-规划阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.18))}周`, deliverable: '目标架构设计、割接方案、回滚预案' },
      { phase: 'M3-准备阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.15))}周`, deliverable: '目标环境搭建、迁移工具部署、网络打通' },
      { phase: 'M4-实施阶段', duration: `${Math.max(2, Math.ceil(totalWeeks * 0.45))}周`, deliverable: '服务器/数据库迁移、应用割接' },
      { phase: 'M5-验收阶段', duration: `${Math.max(1, Math.ceil(totalWeeks * 0.10))}周`, deliverable: '验收报告、运维手册、培训交付' },
    ],
    team: buildTeamFromQuotation(q) || [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通、风险管理' },
      { role: '迁移架构师', count: 1, responsibility: '6R 策略制定、迁移方案设计、技术审核' },
      { role: '云工程师', count: 2, responsibility: '服务器迁移实施、目标环境配置' },
      { role: '数据库专家', count: 1, responsibility: '数据库迁移、数据一致性校验、性能调优' },
      { role: '网络工程师', count: 1, responsibility: '混合云网络打通、DNS 配置、安全组' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、割接协调、风险跟踪' },
    ],
    acceptance_criteria: [
      `${vmCount}台服务器全部迁移至目标云并正常运行`,
      `${dbCount}个数据库数据迁移完成，一致性校验通过`,
      '所有应用割接完成，业务系统正常运行',
      '迁移后系统性能不低于源端(同等或更好)',
      '混合云网络连通性测试通过',
      '安全组/防火墙规则配置正确，通过安全扫描',
      '回滚预案经过演练验证(至少一次)',
      '运维监控告警体系正常运行',
      '运维文档交付并通过审核',
      '客户团队完成培训并通过考核',
    ],
  }
}


// ============================================================================
// 大数据平台 SOW
// ============================================================================
function generateBigDataSOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const targetCloud = getCloudName(facts.target_cloud)
  const vmCount = facts.vm_count || q.qVmCount || 0
  const dbCount = facts.database_count || q.qDbCount || 0
  const secLevel = getSecName(facts.security_level)
  const totalWeeks = q.totalWeeks || (vmCount > 100 ? 16 : 12)

  return {
    title: `${oppName} - 大数据平台建设工作说明书`,
    project_overview:
      `本项目旨在为${oppName}在${targetCloud}上构建大数据平台。` +
      `项目基于湖仓一体架构，涵盖${vmCount}台计算节点的集群规划、数据迁移与治理体系建设，` +
      `安全等级为${secLevel}。通过统一的数据采集、存储、计算和分析能力，赋能客户数据驱动的业务决策。`,
    scope:
      `本项目工作范围包括大数据平台的架构设计、平台搭建、数据迁移、开发治理和验收转移五个阶段。` +
      `覆盖数据湖/数据仓库建设、ETL 管道开发、数据治理体系搭建。`,
    scope_items: [
      { category: '架构设计', item: '湖仓一体架构设计(Data Lake + Data Warehouse)', included: true },
      { category: '架构设计', item: `${vmCount}节点集群规划与规格选型`, included: true },
      { category: '架构设计', item: '数据分层模型设计(ODS/DWD/DWS/ADS)', included: true },
      { category: '架构设计', item: '数据安全与权限体系设计', included: true },
      { category: '平台搭建', item: `${targetCloud}大数据组件部署(EMR/Hologres/MaxCompute等)`, included: true },
      { category: '平台搭建', item: '元数据管理与数据目录搭建', included: true },
      { category: '平台搭建', item: '任务调度系统配置(Airflow/DolphinScheduler)', included: true },
      { category: '平台搭建', item: '数据质量监控告警体系', included: true },
      { category: '数据迁移', item: `${dbCount}个源数据库数据抽取与加载`, included: true },
      { category: '数据迁移', item: '历史数据批量迁移与增量同步', included: true },
      { category: '数据治理', item: '数据标准与质量规则定义', included: true },
      { category: '数据治理', item: '数据血缘与影响分析', included: true },
      { category: '数据治理', item: '数据资产目录与自助分析门户', included: true },
      { category: '知识转移', item: '运维文档与团队培训', included: true },
      { category: '不在范围', item: '业务 BI 报表开发(可选增量包)', included: false },
      { category: '不在范围', item: 'AI/ML 模型开发', included: false },
      { category: '不在范围', item: '第三方数据采购', included: false },
    ],
    deliverables: [
      { name: '大数据平台架构设计文档', description: '湖仓一体架构、技术选型、集群规划', milestone: 'M1-设计阶段' },
      { name: '数据模型设计文档', description: '分层模型、主题域划分、表结构设计', milestone: 'M1-设计阶段' },
      { name: '数据安全与权限方案', description: `${secLevel}安全等级的数据访问控制方案`, milestone: 'M1-设计阶段' },
      { name: '大数据平台环境', description: `${targetCloud}上已部署的大数据平台`, milestone: 'M2-搭建阶段' },
      { name: 'ETL 管道与调度配置', description: '数据采集、清洗、加载管道及调度任务', milestone: 'M2-搭建阶段' },
      { name: '数据迁移验证报告', description: `${dbCount}个数据库迁移结果与数据量统计`, milestone: 'M3-迁移阶段' },
      { name: '数据治理规范文档', description: '数据标准、质量规则、管理流程', milestone: 'M4-治理阶段' },
      { name: '数据资产目录', description: '元数据目录、数据血缘、资产盘点', milestone: 'M4-治理阶段' },
      { name: '验收报告', description: '平台功能测试、性能测试结果', milestone: 'M5-验收阶段' },
      { name: '运维手册与培训材料', description: '平台运维手册、开发规范、培训PPT', milestone: 'M5-验收阶段' },
    ],
    assumptions: [
      '客户已具备目标云平台账号及管理员权限',
      '客户提供源系统数据字典和业务规则文档',
      '客户数据团队配合进行数据质量确认',
      '源数据库允许数据抽取(网络连通、权限开放)',
      '云平台大数据服务配额满足集群规模需求',
      '数据迁移窗口由客户与业务方协商确认',
      '客户已有或同意采购必要的 BI 工具许可证',
    ],
    risks: [
      { risk: '数据质量问题导致迁移返工', impact: '高', mitigation: '迁移前进行数据质量探查，建立清洗规则' },
      { risk: '源系统数据量超预期', impact: '中', mitigation: '评估阶段进行数据量采样，预留增量迁移时间' },
      { risk: '集群性能不满足查询需求', impact: '中', mitigation: '设计阶段进行性能基准测试，预留扩容方案' },
      { risk: '数据安全合规审查不通过', impact: '高', mitigation: '设计阶段引入安全团队评审，预留整改时间' },
      { risk: 'ETL 管道稳定性问题', impact: '中', mitigation: '建立任务监控告警，准备重试和补偿机制' },
      { risk: '客户数据团队配合不足', impact: '中', mitigation: '明确数据确认 RACI，建立数据治理委员会' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天），分为设计、搭建、迁移、治理、验收五个阶段。`,
    milestones: [
      { phase: 'M1-设计阶段', duration: '2-3周', deliverable: '架构设计、数据模型、安全方案' },
      { phase: 'M2-搭建阶段', duration: '3-4周', deliverable: '大数据平台环境、ETL 管道、调度系统' },
      { phase: 'M3-迁移阶段', duration: '3-4周', deliverable: '数据迁移、增量同步、验证报告' },
      { phase: 'M4-治理阶段', duration: '2-3周', deliverable: '治理规范、数据目录、血缘分析' },
      { phase: 'M5-验收阶段', duration: '1-2周', deliverable: '验收报告、运维手册、培训交付' },
    ],
    team: [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通' },
      { role: '数据架构师', count: 1, responsibility: '湖仓架构设计、技术选型、模型审核' },
      { role: '大数据工程师', count: 2, responsibility: '平台搭建、ETL 开发、性能调优' },
      { role: '数据治理专家', count: 1, responsibility: '数据标准、质量规则、元数据管理' },
      { role: '数据库专家', count: 1, responsibility: '数据迁移、一致性校验、SQL 优化' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪、客户协调' },
    ],
    acceptance_criteria: [
      '大数据平台部署完成，所有组件正常运行',
      '集群规模满足设计规格，通过性能压测',
      `${dbCount}个数据库数据迁移完成，数据一致性校验通过`,
      'ETL 管道正常运行，调度任务执行成功率达 99%+',
      '数据质量监控规则生效，异常数据可自动告警',
      '数据安全权限体系配置正确，通过安全审计',
      '数据资产目录可查询，数据血缘可追溯',
      '运维监控告警体系正常运行',
      '运维文档交付并通过审核',
      '客户团队完成培训并通过考核',
    ],
  }
}


// ============================================================================
// 混合云 SOW
// ============================================================================
function generateHybridCloudSOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const sourceCloud = getCloudName(facts.current_cloud)
  const targetCloud = getCloudName(facts.target_cloud)
  const vmCount = facts.vm_count || q.qVmCount || 0
  const regionCount = facts.region_count || 1
  const secLevel = getSecName(facts.security_level)
  const totalWeeks = q.totalWeeks || (vmCount > 500 ? 20 : 14)

  return {
    title: `${oppName} - 混合云架构建设工作说明书`,
    project_overview:
      `本项目旨在为${oppName}构建${sourceCloud}与${targetCloud}的混合云架构。` +
      `项目涉及${vmCount}台虚拟机的混合部署、跨${regionCount}个Region的统一管理，` +
      `安全等级为${secLevel}。通过统一身份、网络互通、应用集成和统一运维，` +
      `实现本地与云端资源的协同管理，兼顾数据合规与弹性扩展需求。`,
    scope:
      `本项目工作范围包括混合云架构设计、网络互通建设、统一身份与安全、应用集成与迁移、` +
      `统一运维管理和验收转移六个阶段。`,
    scope_items: [
      { category: '架构设计', item: `${sourceCloud}+${targetCloud}混合云总体架构设计`, included: true },
      { category: '架构设计', item: '混合云管理平台选型与设计', included: true },
      { category: '架构设计', item: '应用部署拓扑设计(哪些在本地/哪些在云端)', included: true },
      { category: '网络互通', item: `专线/VPN 混合云网络打通，覆盖${regionCount}个Region`, included: true },
      { category: '网络互通', item: '跨云 DNS 解析与流量路由', included: true },
      { category: '网络互通', item: '混合云负载均衡与流量分发', included: true },
      { category: '统一身份', item: '跨云统一身份认证(IdP 联邦)', included: true },
      { category: '统一身份', item: '跨云权限统一管理与审计', included: true },
      { category: '安全合规', item: `${secLevel}安全等级统一安全策略`, included: true },
      { category: '安全合规', item: '跨云安全组/防火墙统一管理', included: true },
      { category: '应用集成', item: `${vmCount}台虚拟机混合部署与集成`, included: true },
      { category: '应用集成', item: '跨云数据同步与消息总线', included: true },
      { category: '统一运维', item: '混合云统一监控告警平台', included: true },
      { category: '统一运维', item: '混合云日志集中分析', included: true },
      { category: '统一运维', item: '混合云备份与灾难恢复方案', included: true },
      { category: '知识转移', item: '运维文档与团队培训', included: true },
      { category: '不在范围', item: '新建业务应用开发', included: false },
      { category: '不在范围', item: '本地机房硬件采购与安装', included: false },
    ],
    deliverables: [
      { name: '混合云架构设计文档', description: `${sourceCloud}+${targetCloud}总体架构、部署拓扑`, milestone: 'M1-设计阶段' },
      { name: '混合云管理平台方案', description: '管理平台选型、功能设计、集成方案', milestone: 'M1-设计阶段' },
      { name: '网络互通方案', description: '专线/VPN 设计、DNS/路由规划、负载均衡', milestone: 'M1-设计阶段' },
      { name: '统一身份安全方案', description: 'IdP 联邦、权限矩阵、安全策略', milestone: 'M1-设计阶段' },
      { name: '混合云网络环境', description: '专线/VPN 已打通、DNS/路由配置完成', milestone: 'M2-网络阶段' },
      { name: '统一身份认证体系', description: '跨云 SSO、统一权限管理部署完成', milestone: 'M3-身份阶段' },
      { name: '应用集成部署报告', description: `${vmCount}台虚拟机部署结果、集成验证`, milestone: 'M4-集成阶段' },
      { name: '混合云运维平台', description: '统一监控、日志分析、备份恢复', milestone: 'M5-运维阶段' },
      { name: '灾难恢复方案与演练报告', description: 'DR 方案设计、演练记录', milestone: 'M5-运维阶段' },
      { name: '验收报告', description: '功能测试、故障切换测试结果', milestone: 'M6-验收阶段' },
      { name: '运维手册与培训材料', description: '混合云运维手册、故障处理指南、培训PPT', milestone: 'M6-验收阶段' },
    ],
    assumptions: [
      '客户已具备本地机房和目标云平台账号',
      '客户网络团队配合完成专线申请与本地端配置',
      '本地系统支持混合云集成所需的接口和协议',
      '客户企业提供企业身份认证源(IdP)',
      '云平台与本地机房网络带宽满足业务需求',
      '项目期间客户关键人员可参与评审和验收',
      '数据跨境传输符合当地法律法规要求',
    ],
    risks: [
      { risk: '专线延迟/带宽不达标', impact: '高', mitigation: '提前进行网络测试，预留带宽扩容方案' },
      { risk: '跨云身份联邦兼容性问题', impact: '中', mitigation: '设计阶段进行 POC 验证，准备备选方案' },
      { risk: '应用跨云集成复杂度超预期', impact: '高', mitigation: '评估阶段详细梳理应用依赖，分阶段集成' },
      { risk: '数据同步延迟影响业务', impact: '中', mitigation: '采用异步消息+缓存方案，设定 SLA 监控' },
      { risk: '统一运维平台采集不到本地数据', impact: '中', mitigation: '确认本地系统监控接口，准备适配方案' },
      { risk: '灾难恢复演练影响生产', impact: '高', mitigation: '在非生产环境演练，设置严格回滚条件' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天），分为设计、网络、身份、集成、运维、验收六个阶段。`,
    milestones: [
      { phase: 'M1-设计阶段', duration: '2-3周', deliverable: '架构设计、管理平台方案、网络/身份方案' },
      { phase: 'M2-网络阶段', duration: '2-3周', deliverable: '专线/VPN 打通、DNS/路由/负载均衡' },
      { phase: 'M3-身份阶段', duration: '1-2周', deliverable: '统一 SSO、权限管理、安全策略' },
      { phase: 'M4-集成阶段', duration: '4-6周', deliverable: '应用部署、数据同步、消息总线' },
      { phase: 'M5-运维阶段', duration: '3-4周', deliverable: '统一监控、日志分析、备份恢复、DR 演练' },
      { phase: 'M6-验收阶段', duration: '1-2周', deliverable: '验收报告、运维手册、培训交付' },
    ],
    team: [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通、风险管理' },
      { role: '混合云架构师', count: 1, responsibility: '混合云总体架构设计、技术方案审核' },
      { role: '网络工程师', count: 1, responsibility: '专线/VPN、DNS、负载均衡、安全组' },
      { role: '云工程师', count: 2, responsibility: '云端环境搭建、应用部署、数据同步' },
      { role: '安全顾问', count: 1, responsibility: '统一安全策略、身份联邦、审计合规' },
      { role: '运维工程师', count: 1, responsibility: '统一监控、日志、备份恢复、DR 演练' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪、客户协调' },
    ],
    acceptance_criteria: [
      '混合云网络互通正常，延迟和带宽满足 SLA',
      '跨云统一身份认证正常工作，权限验证通过',
      `${vmCount}台虚拟机混合部署完成并正常运行`,
      '跨云数据同步正常，一致性校验通过',
      '统一监控告警平台覆盖所有环境，告警可正常触发',
      '跨云日志集中收集并可查询分析',
      '备份恢复方案验证通过，数据可正常恢复',
      '灾难恢复演练成功完成，RTO/RPO 满足要求',
      '安全合规检查通过，满足等保要求',
      '运维文档交付并通过审核',
      '客户团队完成培训并通过考核',
    ],
  }
}


// ============================================================================
// 安全加固 SOW
// ============================================================================
function generateSecuritySOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const targetCloud = getCloudName(facts.target_cloud)
  const vmCount = facts.vm_count || q.qVmCount || 0
  const accountCount = facts.account_count || q.qBusinessSystems || 1
  const secLevel = getSecName(facts.security_level)
  const totalWeeks = q.totalWeeks || (vmCount > 200 ? 14 : 8)

  return {
    title: `${oppName} - 云安全加固工作说明书`,
    project_overview:
      `本项目旨在为${oppName}在${targetCloud}上的云环境进行安全加固。` +
      `项目覆盖${vmCount}台虚拟机、${accountCount}个云账号的安全评估与加固，` +
      `目标安全等级为${secLevel}。通过安全基线加固、访问控制优化、` +
      `漏洞修复和监控告警体系建设，全面提升客户云上环境的安全防护能力。`,
    scope:
      `本项目工作范围包括安全评估、安全加固、安全测试、监控建设和验收转移五个阶段。` +
      `涵盖身份安全、网络安全、数据安全、主机安全和运维安全五大领域。`,
    scope_items: [
      { category: '安全评估', item: `${accountCount}个云账号安全配置基线检查`, included: true },
      { category: '安全评估', item: `${vmCount}台虚拟机漏洞扫描与风险评估`, included: true },
      { category: '安全评估', item: '网络安全评估(安全组/NACL/WAF)', included: true },
      { category: '安全评估', item: 'IAM 权限审计(最小权限原则检查)', included: true },
      { category: '安全评估', item: '数据安全评估(加密/脱敏/访问审计)', included: true },
      { category: '身份安全', item: 'IAM 策略优化与权限收敛', included: true },
      { category: '身份安全', item: 'MFA 多因素认证强制启用', included: true },
      { category: '身份安全', item: '特权账号管理与审计', included: true },
      { category: '网络安全', item: '安全组/NACL 规则最小化配置', included: true },
      { category: '网络安全', item: 'WAF/Web 防护规则配置', included: true },
      { category: '网络安全', item: 'DDoS 防护配置', included: true },
      { category: '数据安全', item: '存储/数据库加密配置', included: true },
      { category: '数据安全', item: '敏感数据发现与脱敏', included: true },
      { category: '主机安全', item: 'OS 安全基线加固(CIS Benchmark)', included: true },
      { category: '主机安全', item: '主机入侵检测(HIDS)部署', included: true },
      { category: '主机安全', item: '漏洞修复与补丁管理', included: true },
      { category: '运维安全', item: '操作审计日志集中化', included: true },
      { category: '运维安全', item: '安全监控告警体系搭建', included: true },
      { category: '运维安全', item: '安全事件自动响应(SOAR)', included: true },
      { category: '知识转移', item: '安全运维文档与培训', included: true },
      { category: '不在范围', item: '应用代码安全审计(可选增量包)', included: false },
      { category: '不在范围', item: '渗透测试(可选增量包)', included: false },
    ],
    deliverables: [
      { name: '安全评估报告', description: `含${accountCount}个账号和${vmCount}台主机的安全评估结果`, milestone: 'M1-评估阶段' },
      { name: '漏洞与风险清单', description: '按严重程度分级的风险项及修复建议', milestone: 'M1-评估阶段' },
      { name: '安全加固方案', description: '五大领域的加固措施与技术方案', milestone: 'M2-加固阶段' },
      { name: 'IAM 权限优化报告', description: '权限收敛前后的对比、遗留风险', milestone: 'M2-加固阶段' },
      { name: '安全基线配置文档', description: 'OS/网络/数据库安全基线配置清单', milestone: 'M2-加固阶段' },
      { name: '安全测试报告', description: '加固后漏洞复测、渗透测试结果', milestone: 'M3-测试阶段' },
      { name: '安全监控告警体系', description: 'SIEM/SOAR 配置、告警规则、响应流程', milestone: 'M4-监控阶段' },
      { name: '安全事件响应预案', description: '安全事件分级、响应流程、联系方式', milestone: 'M4-监控阶段' },
      { name: '验收报告', description: '安全加固效果对比、遗留风险确认', milestone: 'M5-验收阶段' },
      { name: '安全运维手册与培训材料', description: '日常安全运维、应急响应、培训PPT', milestone: 'M5-验收阶段' },
    ],
    assumptions: [
      '客户已具备目标云平台管理员权限',
      '客户配合提供现有安全策略和配置信息',
      '客户同意在维护窗口进行安全加固操作',
      '源系统漏洞修复不影响业务正常运行(或客户接受短暂中断)',
      '客户已有或同意采购安全工具许可证(HIDS/WAF/SIEM等)',
      '云平台安全服务配额满足项目需求',
      '客户安全团队配合进行安全策略评审',
    ],
    risks: [
      { risk: '安全加固影响业务连续性', impact: '高', mitigation: '在维护窗口操作，逐项验证，准备快速回滚' },
      { risk: '权限收敛导致业务中断', impact: '高', mitigation: '分阶段收敛，每阶段验证业务正常' },
      { risk: '漏洞修复引发兼容性问题', impact: '中', mitigation: '测试环境验证后再生产部署，准备回滚' },
      { risk: '安全工具部署资源冲突', impact: '中', mitigation: '评估资源占用，预留扩容空间' },
      { risk: '合规要求变更', impact: '中', mitigation: '项目启动时冻结合规基线，变更走变更流程' },
      { risk: '客户安全团队配合不足', impact: '中', mitigation: '建立安全评审委员会，定期同步进展' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天），分为评估、加固、测试、监控、验收五个阶段。`,
    milestones: [
      { phase: 'M1-评估阶段', duration: '2-3周', deliverable: '安全评估报告、漏洞清单、风险分析' },
      { phase: 'M2-加固阶段', duration: '4-6周', deliverable: '安全基线配置、IAM 优化、加密部署' },
      { phase: 'M3-测试阶段', duration: '1-2周', deliverable: '漏洞复测、安全测试报告' },
      { phase: 'M4-监控阶段', duration: '2-3周', deliverable: '监控告警体系、事件响应预案' },
      { phase: 'M5-验收阶段', duration: '1周', deliverable: '验收报告、运维手册、培训交付' },
    ],
    team: [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通、风险管理' },
      { role: '安全架构师', count: 1, responsibility: '安全架构设计、加固方案审核' },
      { role: '安全工程师', count: 2, responsibility: '安全加固实施、漏洞修复、HIDS 部署' },
      { role: '云安全专家', count: 1, responsibility: 'IAM 优化、网络安全、数据加密' },
      { role: '运维工程师', count: 1, responsibility: 'SIEM/SOAR 配置、监控告警、日志分析' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪、客户协调' },
    ],
    acceptance_criteria: [
      `${accountCount}个云账号安全基线检查全部通过`,
      `${vmCount}台虚拟机高危漏洞全部修复`,
      'IAM 权限收敛完成，无过度授权账号',
      'MFA 多因素认证全部启用',
      '安全组/NACL 规则最小化配置，无全开放端口',
      '存储和数据库加密配置完成',
      'HIDS 主机入侵检测全部部署并正常运行',
      '安全监控告警体系正常运行，可检测异常行为',
      '安全事件响应预案经过演练验证',
      '安全加固后通过复测，风险等级降低至可接受水平',
      '运维文档交付并通过审核',
      '客户团队完成培训并通过考核',
    ],
  }
}


// ============================================================================
// 成本优化 SOW
// ============================================================================
function generateCostOptimizationSOW(facts, quotation, oppName) {
  const q = extractQuoteParams(quotation)
  const targetCloud = getCloudName(facts.target_cloud)
  const vmCount = facts.vm_count || q.qVmCount || 0
  const accountCount = facts.account_count || q.qBusinessSystems || 1
  const totalWeeks = q.totalWeeks || (vmCount > 200 ? 12 : 8)

  return {
    title: `${oppName} - 云成本优化工作说明书`,
    project_overview:
      `本项目旨在为${oppName}在${targetCloud}上的云资源进行成本优化。` +
      `项目覆盖${accountCount}个云账号、${vmCount}台虚拟机的成本分析与优化，` +
      `目标是在不影响业务的前提下，识别浪费、优化资源配置、建立持续成本管理体系，` +
      `实现云成本的可见、可控和可优化。`,
    scope:
      `本项目工作范围包括成本评估、优化实施、FinOps 体系建设和验收转移四个阶段。` +
      `涵盖资源优化、计费优化、架构优化和流程优化四大领域。`,
    scope_items: [
      { category: '成本评估', item: `${accountCount}个云账号成本数据采集与分析`, included: true },
      { category: '成本评估', item: `${vmCount}台虚拟机资源利用率分析(CPU/内存/网络)`, included: true },
      { category: '成本评估', item: '闲置资源识别(未挂载磁盘/未关联弹性IP/闲置LB)', included: true },
      { category: '成本评估', item: '成本分摊与标签策略评估', included: true },
      { category: '成本评估', item: 'RI/SP 预留实例使用率分析', included: true },
      { category: '资源优化', item: '超配资源降配(Right-sizing)', included: true },
      { category: '资源优化', item: '闲置资源回收', included: true },
      { category: '资源优化', item: '自动伸缩策略优化', included: true },
      { category: '资源优化', item: '存储生命周期策略配置', included: true },
      { category: '计费优化', item: 'RI/SP 预留实例购买建议', included: true },
      { category: '计费优化', item: '节省计划(Savings Plan)方案设计', included: true },
      { category: '计费优化', item: '竞价实例适用场景识别', included: true },
      { category: '计费优化', item: '账单结构与付款方式优化', included: true },
      { category: '架构优化', item: 'Serverless/容器化改造建议', included: true },
      { category: '架构优化', item: '多可用区/多Region 成本优化', included: true },
      { category: 'FinOps 体系', item: '成本标签策略与分账体系', included: true },
      { category: 'FinOps 体系', item: '成本预算与告警机制', included: true },
      { category: 'FinOps 体系', item: '成本看板与报表体系', included: true },
      { category: 'FinOps 体系', item: '成本优化流程与责任矩阵', included: true },
      { category: '知识转移', item: 'FinOps 培训与文档交付', included: true },
      { category: '不在范围', item: '应用架构重构实施(可选增量包)', included: false },
      { category: '不在范围', item: '多云成本管理平台采购', included: false },
    ],
    deliverables: [
      { name: '云成本分析报告', description: `含${accountCount}个账号的成本分布、趋势分析`, milestone: 'M1-评估阶段' },
      { name: '资源利用率分析报告', description: `${vmCount}台虚拟机利用率统计、闲置资源清单`, milestone: 'M1-评估阶段' },
      { name: '成本优化方案', description: '四大领域优化措施、预期节省金额', milestone: 'M1-评估阶段' },
      { name: '优化实施报告', description: '已执行的优化项、实际节省金额', milestone: 'M2-实施阶段' },
      { name: 'RI/SP 购买建议', description: '预留实例/节省计划的购买方案与 ROI 分析', milestone: 'M2-实施阶段' },
      { name: 'FinOps 管理体系文档', description: '标签策略、预算流程、成本看板设计', milestone: 'M3-FinOps阶段' },
      { name: '成本看板与告警', description: '已配置的成本监控看板和预算告警', milestone: 'M3-FinOps阶段' },
      { name: '成本优化流程手册', description: '日常成本管理流程、优化检查清单', milestone: 'M3-FinOps阶段' },
      { name: '验收报告', description: '优化效果总结、持续优化路线图', milestone: 'M4-验收阶段' },
      { name: 'FinOps 培训材料', description: 'FinOps 方法论培训PPT、操作手册', milestone: 'M4-验收阶段' },
    ],
    assumptions: [
      '客户已具备目标云平台账单访问权限',
      '客户配合提供业务资源使用规律(峰谷时段/季节性变化)',
      '客户同意在维护窗口进行资源降配操作',
      '客户接受 RI/SP 的长期承诺(1年/3年)',
      '云平台成本数据 API 可正常访问',
      '客户财务团队配合进行成本分摊确认',
      '客户运维团队配合执行资源优化操作',
    ],
    risks: [
      { risk: '资源降配影响业务性能', impact: '高', mitigation: '降配前进行性能基线测试，逐步降配并监控' },
      { risk: 'RI/SP 购买后资源使用量下降', impact: '中', mitigation: '基于历史数据分析推荐，设置覆盖率上限' },
      { risk: '成本数据不完整', impact: '中', mitigation: '多维度采集数据(账单API/监控/标签)，交叉验证' },
      { risk: '标签策略落地阻力', impact: '中', mitigation: '分阶段推行，先核心账号后全面铺开' },
      { risk: '优化效果不达预期', impact: '低', mitigation: '评估阶段设定合理预期，持续跟踪优化' },
    ],
    timeline: `预计项目总周期为${totalWeeks}周（报价评估${q.totalHours}人天），分为评估、实施、FinOps 建设、验收四个阶段。`,
    milestones: [
      { phase: 'M1-评估阶段', duration: '2-3周', deliverable: '成本分析报告、利用率分析、优化方案' },
      { phase: 'M2-实施阶段', duration: '3-4周', deliverable: '资源优化、计费优化、实施报告' },
      { phase: 'M3-FinOps阶段', duration: '2-3周', deliverable: 'FinOps 体系、成本看板、流程手册' },
      { phase: 'M4-验收阶段', duration: '1周', deliverable: '验收报告、培训交付、持续优化路线图' },
    ],
    team: [
      { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通' },
      { role: 'FinOps 架构师', count: 1, responsibility: '成本优化方案设计、FinOps 体系建设' },
      { role: '云成本分析师', count: 1, responsibility: '成本数据分析、RI/SP 建议、利用率评估' },
      { role: '云工程师', count: 1, responsibility: '资源优化实施、标签策略配置、看板搭建' },
      { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪、客户协调' },
    ],
    acceptance_criteria: [
      `${accountCount}个云账号成本分析完成，成本分布清晰可见`,
      `${vmCount}台虚拟机利用率分析完成，闲置资源已识别`,
      '资源优化措施全部实施，实际节省金额达到预期目标的 80%+',
      'RI/SP 购买方案已交付，ROI 分析清晰',
      '成本标签策略生效，分账报表可按部门/项目生成',
      '成本预算告警机制正常运行',
      '成本看板可实时展示成本趋势和分摊情况',
      'FinOps 管理流程文档交付并通过审核',
      '持续优化路线图已制定并获得客户确认',
      '客户团队完成 FinOps 培训并通过考核',
    ],
  }
}


// ============================================================================
// 模板映射表
// ============================================================================
const templateGenerators = {
  landing_zone: generateLandingZoneSOW,
  migration: generateMigrationSOW,
  big_data: generateBigDataSOW,
  hybrid_cloud: generateHybridCloudSOW,
  security: generateSecuritySOW,
  cost_optimization: generateCostOptimizationSOW,
}

/**
 * 根据项目类型生成 SOW 内容
 * @param {string} projectType - 项目类型
 * @param {object} facts - FactSheet 数据
 * @param {object} quotation - 报价数据 (含 estimate/input/cost)
 * @param {string} oppName - 商机名称
 * @returns {object} SOW 内容对象
 */
export function generateSOWByType(projectType, facts, quotation, oppName) {
  const generator = templateGenerators[projectType] || templateGenerators.landing_zone
  return generator(facts, quotation, oppName)
}

/**
 * 获取支持的项目类型列表
 */
export function getSupportedProjectTypes() {
  return Object.keys(templateGenerators)
}

/**
 * 获取项目类型的中文名称
 */
export function getProjectTypeName(projectType) {
  return typeNames[projectType] || projectType
}
