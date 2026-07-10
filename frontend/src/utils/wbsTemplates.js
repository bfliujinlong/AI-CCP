/**
 * WBS 模板生成器 - 按报价数据驱动
 *
 * 核心改进：WBS 的人天分配从报价(Quotation)的阶段工时推导，而非硬编码。
 * 同时引用报价中的应用评估、迁移服务明细和 SOW 的里程碑/交付物。
 *
 * 数据来源:
 *   - quotation.estimate.phaseHours    → 各阶段人天预算
 *   - quotation.estimate.totalHours    → 总人天
 *   - quotation.estimate.appAssessment → 应用迁移任务
 *   - quotation.estimate.migrationServices → 迁移服务任务
 *   - quotation.input.resources        → 资源数量(VM/DB/账号等)
 *   - quotation.input.counts           → 团队人数
 *   - sow.milestones / deliverables    → 阶段对齐和交付物
 */

// 报价阶段 → WBS 阶段映射
const phaseLabels = {
  discovery: '需求调研',
  planning: '方案规划',
  implementation: '实施部署',
  testing: '测试验证',
  acceptance: '验收交付',
}

// 角色(报价中的 counts) → 中文角色名
const roleLabels = {
  junior: '云工程师(初)',
  mid: '云工程师(中)',
  senior: '云架构师',
  pm: '项目经理',
}

/**
 * 将阶段人天预算分配到任务列表
 * @param {number} phaseBudget - 阶段总人天
 * @param {Array} taskTemplates - 任务模板 [{name, desc, role, weight, deps, deliverable}]
 *   weight: 任务权重(默认均分), 越大分配越多
 * @returns {Array} 带实际 duration_days 的任务列表
 */
function distributeDays(phaseBudget, taskTemplates) {
  const totalWeight = taskTemplates.reduce((s, t) => s + (t.weight || 1), 0)
  return taskTemplates.map(t => {
    const days = Math.max(1, Math.round((phaseBudget * (t.weight || 1)) / totalWeight))
    return {
      name: t.name,
      description: t.desc,
      duration_days: days,
      role: t.role,
      dependencies: t.deps || [],
      deliverable: t.deliverable || '',
      level: t.level || 0,
    }
  })
}

/**
 * 根据阶段人天计算周数
 */
function daysToWeeks(days) {
  return Math.max(1, Math.ceil(days / 5))
}

/**
 * 从报价数据中提取关键参数
 */
function extractQuoteParams(quotation) {
  const est = quotation?.estimate || {}
  const input = quotation?.input || {}
  const res = input.resources || {}

  return {
    phaseHours: est.phaseHours || {},
    totalHours: est.totalHours || 0,
    baseHours: est.baseHours || 0,
    appDaysAvg: est.appDaysAvg || 0,
    appAssessment: est.appAssessment || { apps: [], summary: { count: 0 } },
    migrationServices: est.migrationServices || [],
    migrationDays: est.migrationDays || 0,
    resourceFactor: est.resourceFactor || 0,
    techComplexity: est.techComplexity || 0,
    // 资源数据
    businessSystems: res.business_systems || 0,
    vmCount: res.vms || 0,
    k8sNodes: res.kubernetes_nodes || 0,
    containerInstances: res.container_instances || 0,
    databases: res.databases || {},
    dbCount: Object.values(res.databases || {}).reduce((s, v) => s + (Number(v) || 0), 0),
    // FactSheet 数据
    facts: input._facts || {},
    // 团队
    counts: input.counts || { junior: 1, mid: 2, senior: 1, pm: 1 },
  }
}


// ============================================================================
// Landing Zone WBS 模板
// ============================================================================
function generateLandingZoneWBS(facts, quotation, sow, oppName) {
  const p = extractQuoteParams(quotation)
  const accountCount = facts.account_count || p.businessSystems || 1
  const regionCount = facts.region_count || 1
  const vpcCount = facts.vpc_count || 1
  const secLevel = facts.security_level || 'basic'

  // 从 SOW 中提取交付物名称用于对齐
  const sowDeliverables = (sow?.deliverables || []).map(d => d.name)

  const phases = []

  // ── P1: 需求调研与评估 ──
  const p1Budget = p.phaseHours.discovery || Math.round(p.totalHours * 0.12) || 10
  phases.push({
    name: 'P1 需求调研与评估',
    duration: `${daysToWeeks(p1Budget)}周`,
    tasks: distributeDays(p1Budget, [
      { name: '项目启动会', desc: `确认${oppName} Landing Zone 项目范围、目标、团队组成和沟通机制`, role: roleLabels.pm, weight: 0.5, deps: [], deliverable: '项目章程' },
      { name: 'IT治理现状调研', desc: `调研${accountCount}个云账号现状、网络拓扑、安全配置`, role: roleLabels.senior, weight: 1.5, deps: ['项目启动会'], deliverable: '现状调研报告' },
      { name: '合规差距分析', desc: `分析目标合规要求(等保/GDPR等)与现状差距，安全等级: ${secLevel}`, role: roleLabels.senior, weight: 1, deps: ['IT治理现状调研'], deliverable: '合规差距分析报告' },
      { name: '需求确认与基线冻结', desc: '确认安全等级、网络需求、账号体系需求，冻结需求基线', role: roleLabels.senior, weight: 1, deps: ['合规差距分析'], deliverable: '需求规格书' },
    ]),
  })

  // ── P2: 方案规划 ──
  const p2Budget = p.phaseHours.planning || Math.round(p.totalHours * 0.18) || 15
  phases.push({
    name: 'P2 方案规划',
    duration: `${daysToWeeks(p2Budget)}周`,
    tasks: distributeDays(p2Budget, [
      { name: '账号体系设计(Organization/OU)', desc: `设计${accountCount}个云账号的组织结构和OU层级`, role: roleLabels.senior, weight: 1.5, deps: ['需求确认与基线冻结'], deliverable: '账号架构图' },
      { name: '网络架构设计', desc: `设计${regionCount}个Region、${vpcCount}个VPC的网络拓扑、子网、安全组`, role: roleLabels.senior, weight: 2, deps: ['需求确认与基线冻结'], deliverable: '网络架构设计文档(HLD)' },
      { name: 'IAM与安全架构设计', desc: `设计IAM策略矩阵、SSO方案、${secLevel}安全等级基线`, role: roleLabels.senior, weight: 1.5, deps: ['需求确认与基线冻结'], deliverable: '安全架构设计文档' },
      { name: '治理与合规方案设计', desc: '设计标签策略、成本分账、审计日志、Config合规规则', role: roleLabels.senior, weight: 1.5, deps: ['账号体系设计(Organization/OU)'], deliverable: '治理方案' },
      { name: 'IaC架构设计', desc: '设计Terraform模块化代码结构、CI/CD流水线', role: roleLabels.mid, weight: 1, deps: ['网络架构设计', 'IAM与安全架构设计'], deliverable: 'IaC架构设计文档' },
      { name: 'LLD低阶方案编写', desc: '编写低阶实施方案，含具体配置、IP规划表、IAM权限矩阵', role: roleLabels.senior, weight: 2, deps: ['IaC架构设计'], deliverable: 'LLD实施方案' },
      { name: '架构评审', desc: '客户评审架构方案和技术方案', role: roleLabels.pm, weight: 0.5, deps: ['LLD低阶方案编写', '治理与合规方案设计'], deliverable: '评审纪要' },
    ]),
  })

  // ── P3: 实施部署 ──
  const p3Budget = p.phaseHours.implementation || Math.round(p.totalHours * 0.45) || 30
  const implTasks = [
    { name: 'Organization与账号结构部署', desc: `部署${accountCount}个账号的Organization/OU结构`, role: roleLabels.mid, weight: 1, deps: ['架构评审'], deliverable: '部署报告' },
    { name: `${regionCount}个Region VPC网络配置`, desc: `配置${vpcCount}个VPC、子网、路由表、安全组`, role: roleLabels.mid, weight: 2, deps: ['Organization与账号结构部署'], deliverable: '网络配置文档' },
    { name: 'IAM与SSO身份体系部署', desc: '部署IAM策略、SSO联邦认证、MFA强制启用', role: roleLabels.mid, weight: 1.5, deps: ['Organization与账号结构部署'], deliverable: 'IAM配置文档' },
    { name: '安全基线配置', desc: `配置${secLevel}安全等级基线: KMS加密、WAF、安全组最小化`, role: roleLabels.mid, weight: 1.5, deps: ['Organization与账号结构部署'], deliverable: '安全配置文档' },
    { name: '审计日志与Config部署', desc: '部署CloudTrail操作审计、Config合规检查、集中日志', role: roleLabels.mid, weight: 1, deps: [`${regionCount}个Region VPC网络配置`], deliverable: '审计配置文档' },
    { name: '成本管理与标签策略', desc: '配置成本标签策略、预算告警、分账报表', role: roleLabels.mid, weight: 1, deps: ['IAM与SSO身份体系部署'], deliverable: '成本管理配置' },
    { name: '监控告警体系部署', desc: '部署CloudMonitor、告警规则、运维看板', role: roleLabels.mid, weight: 1, deps: ['审计日志与Config部署'], deliverable: '监控配置文档' },
    { name: 'IaC代码仓库交付', desc: '交付Terraform模块化代码，可重复部署', role: roleLabels.senior, weight: 1.5, deps: ['监控告警体系部署'], deliverable: 'IaC代码仓库' },
  ]
  phases.push({
    name: 'P3 实施部署',
    duration: `${daysToWeeks(p3Budget)}周`,
    tasks: distributeDays(p3Budget, implTasks),
  })

  // ── P4: 测试验证 ──
  const p4Budget = p.phaseHours.testing || Math.round(p.totalHours * 0.15) || 10
  phases.push({
    name: 'P4 测试验证',
    duration: `${daysToWeeks(p4Budget)}周`,
    tasks: distributeDays(p4Budget, [
      { name: '端到端功能测试', desc: '验证Landing Zone所有组件功能正常', role: roleLabels.mid, weight: 2, deps: ['IaC代码仓库交付'], deliverable: '功能测试报告' },
      { name: '安全合规审计', desc: '执行安全基线核查、合规检查、漏洞扫描', role: roleLabels.senior, weight: 1.5, deps: ['端到端功能测试'], deliverable: '安全审计报告' },
      { name: 'IaC重复部署验证', desc: '验证Terraform代码可在新账号重复部署', role: roleLabels.mid, weight: 1, deps: ['端到端功能测试'], deliverable: '部署验证报告' },
      { name: '性能与连通性测试', desc: `验证${regionCount}个Region网络连通性、延迟、吞吐`, role: roleLabels.mid, weight: 1, deps: ['安全合规审计'], deliverable: '性能测试报告' },
    ]),
  })

  // ── P5: 验收交付 ──
  const p5Budget = p.phaseHours.acceptance || Math.round(p.totalHours * 0.10) || 5
  phases.push({
    name: 'P5 验收交付',
    duration: `${daysToWeeks(p5Budget)}周`,
    tasks: distributeDays(p5Budget, [
      { name: 'UAT用户验收测试', desc: '客户按验收标准进行UAT测试', role: roleLabels.pm, weight: 1.5, deps: ['性能与连通性测试', 'IaC重复部署验证'], deliverable: 'UAT验收报告' },
      { name: '运维文档交付', desc: '交付运维手册、故障处理指南、配置清单', role: roleLabels.senior, weight: 1, deps: ['UAT用户验收测试'], deliverable: '运维手册' },
      { name: '客户团队培训', desc: `培训客户团队(${p.counts.junior + p.counts.mid}人)Landing Zone运维`, role: roleLabels.senior, weight: 1, deps: ['运维文档交付'], deliverable: '培训记录' },
      { name: '项目结项', desc: '项目总结、经验沉淀、遗留问题清单', role: roleLabels.pm, weight: 0.5, deps: ['客户团队培训'], deliverable: '结项报告' },
    ]),
  })

  return { phases, source: 'quotation', totalQuotationHours: p.totalHours }
}


// ============================================================================
// 云迁移 WBS 模板
// ============================================================================
function generateMigrationWBS(facts, quotation, sow, oppName) {
  const p = extractQuoteParams(quotation)
  const vmCount = facts.vm_count || p.vmCount || 0
  const dbCount = facts.database_count || p.dbCount || 0

  const phases = []

  // ── P1: 迁移评估 ──
  const p1Budget = p.phaseHours.discovery || Math.round(p.totalHours * 0.12) || 15
  phases.push({
    name: 'P1 迁移评估与规划',
    duration: `${daysToWeeks(p1Budget)}周`,
    tasks: distributeDays(p1Budget, [
      { name: '资产盘点', desc: `盘点${vmCount}台VM和${dbCount}个数据库，建立资产清单`, role: roleLabels.senior, weight: 1.5, deps: [], deliverable: '资产清单' },
      { name: '应用依赖关系分析', desc: '分析服务器间调用关系、数据流向、网络端口依赖', role: roleLabels.senior, weight: 2, deps: ['资产盘点'], deliverable: '应用依赖关系图' },
      { name: '6R迁移策略制定', desc: '为每台VM/DB制定Rehost/Replatform/Refactor/Retire/Retain策略', role: roleLabels.senior, weight: 1.5, deps: ['应用依赖关系分析'], deliverable: '迁移策略文档' },
      { name: 'TCO对比分析', desc: `源端 vs 目标云三年TCO对比分析`, role: roleLabels.mid, weight: 1, deps: ['6R迁移策略制定'], deliverable: 'TCO分析报告' },
      { name: '迁移评估报告', desc: '汇总评估结果，输出迁移可行性结论', role: roleLabels.senior, weight: 1, deps: ['TCO对比分析'], deliverable: '迁移评估报告' },
    ]),
  })

  // ── P2: 迁移规划与设计 ──
  const p2Budget = p.phaseHours.planning || Math.round(p.totalHours * 0.18) || 20
  phases.push({
    name: 'P2 迁移规划与设计',
    duration: `${daysToWeeks(p2Budget)}周`,
    tasks: distributeDays(p2Budget, [
      { name: '目标云基础架构设计', desc: '设计目标云VPC、安全组、IAM、监控架构', role: roleLabels.senior, weight: 1.5, deps: ['迁移评估报告'], deliverable: '目标架构设计文档' },
      { name: '分批迁移波浪规划', desc: `将${vmCount}台VM分为3-5个迁移波浪，制定优先级`, role: roleLabels.senior, weight: 2, deps: ['目标云基础架构设计'], deliverable: '迁移波浪计划' },
      { name: '割接方案与回滚预案', desc: '制定逐应用割接步骤、回滚条件和操作流程', role: roleLabels.senior, weight: 1.5, deps: ['分批迁移波浪规划'], deliverable: '割接方案' },
      { name: '混合云网络方案', desc: '设计专线/VPN混合云网络连通方案', role: roleLabels.mid, weight: 1, deps: ['目标云基础架构设计'], deliverable: '网络方案' },
      { name: '迁移方案评审', desc: '客户评审迁移方案和割接计划', role: roleLabels.pm, weight: 0.5, deps: ['割接方案与回滚预案', '混合云网络方案'], deliverable: '评审纪要' },
    ]),
  })

  // ── P3: 迁移实施 ──
  const p3Budget = p.phaseHours.implementation || Math.round(p.totalHours * 0.45) || 40
  // 根据VM数量生成迁移波浪任务
  const wave1Count = Math.ceil(vmCount * 0.2)
  const wave2Count = Math.ceil(vmCount * 0.3)
  const wave3Count = vmCount - wave1Count - wave2Count
  const dbWave1 = Math.ceil(dbCount * 0.3)
  const dbWave2 = dbCount - dbWave1

  const implTasks = [
    { name: '目标环境搭建', desc: '搭建目标云VPC、安全组、迁移工具(CMS/DCM)', role: roleLabels.mid, weight: 1, deps: ['迁移方案评审'], deliverable: '环境就绪报告' },
    { name: '混合云网络打通', desc: '配置专线/VPN、DNS解析、路由策略', role: roleLabels.mid, weight: 1, deps: ['目标环境搭建'], deliverable: '网络连通确认' },
  ]

  // POC 迁移
  if (vmCount > 0) {
    implTasks.push({ name: 'POC迁移验证', desc: `选择3-5台VM进行POC迁移验证`, role: roleLabels.mid, weight: 1, deps: ['混合云网络打通'], deliverable: 'POC报告' })
  }

  // 第一波迁移
  if (wave1Count > 0) {
    implTasks.push({ name: `第一波迁移(${wave1Count}台VM)`, desc: `迁移${wave1Count}台VM，含验证`, role: roleLabels.mid, weight: 2, deps: ['POC迁移验证'], deliverable: '第一波迁移报告' })
  }
  // 第二波迁移(含DB)
  if (wave2Count > 0) {
    implTasks.push({ name: `第二波迁移(${wave2Count}台VM+${dbWave1}个DB)`, desc: `迁移${wave2Count}台VM和${dbWave1}个数据库`, role: roleLabels.mid, weight: 2.5, deps: [`第一波迁移(${wave1Count}台VM)`], deliverable: '第二波迁移报告' })
  }
  // 第三波迁移
  if (wave3Count > 0) {
    implTasks.push({ name: `第三波迁移(${wave3Count}台VM+${dbWave2}个DB)`, desc: `迁移剩余${wave3Count}台VM和${dbWave2}个数据库`, role: roleLabels.mid, weight: 2, deps: [`第二波迁移(${wave2Count}台VM+${dbWave1}个DB)`], deliverable: '第三波迁移报告' })
  }

  // 应用迁移任务(来自报价评估)
  const appCount = p.appAssessment?.summary?.count || 0
  if (appCount > 0) {
    const appDays = p.appDaysAvg || 0
    implTasks.push({ name: `应用迁移与重构(${appCount}个应用)`, desc: `基于报价评估(${appDays}人天)，对${appCount}个应用进行迁移/重构`, role: roleLabels.senior, weight: 3, deps: [`第三波迁移(${wave3Count}台VM+${dbWave2}个DB)`], deliverable: '应用迁移报告' })
  }

  phases.push({
    name: 'P3 迁移实施',
    duration: `${daysToWeeks(p3Budget)}周`,
    tasks: distributeDays(p3Budget, implTasks),
  })

  // ── P4: 割接与测试 ──
  const p4Budget = p.phaseHours.testing || Math.round(p.totalHours * 0.15) || 12
  phases.push({
    name: 'P4 割接与测试',
    duration: `${daysToWeeks(p4Budget)}周`,
    tasks: distributeDays(p4Budget, [
      { name: '数据一致性校验', desc: `校验${dbCount}个数据库数据一致性`, role: roleLabels.mid, weight: 1.5, deps: ['应用迁移与重构(' + appCount + '个应用)'.replace('应用迁移与重构(0个应用)', '第三波迁移(' + wave3Count + '台VM+' + dbWave2 + '个DB)')], deliverable: '数据校验报告' },
      { name: '业务割接演练', desc: '按割接方案进行割接演练，验证回滚预案', role: roleLabels.pm, weight: 1, deps: ['数据一致性校验'], deliverable: '割接演练报告' },
      { name: '正式割接切换', desc: '正式切换DNS/流量到目标云，监控业务运行', role: roleLabels.pm, weight: 1, deps: ['业务割接演练'], deliverable: '割接执行记录' },
      { name: '性能压测与调优', desc: '云上性能压测，与源端对比，调优配置', role: roleLabels.mid, weight: 1.5, deps: ['正式割接切换'], deliverable: '性能测试报告' },
    ]),
  })

  // ── P5: 验收交付 ──
  const p5Budget = p.phaseHours.acceptance || Math.round(p.totalHours * 0.10) || 5
  phases.push({
    name: 'P5 验收交付',
    duration: `${daysToWeeks(p5Budget)}周`,
    tasks: distributeDays(p5Budget, [
      { name: '迁移验收', desc: `确认${vmCount}台VM和${dbCount}个DB全部迁移完成`, role: roleLabels.pm, weight: 1, deps: ['性能压测与调优'], deliverable: '迁移验收报告' },
      { name: '运维文档交付', desc: '交付目标云运维手册、故障处理指南', role: roleLabels.senior, weight: 1, deps: ['迁移验收'], deliverable: '运维手册' },
      { name: '客户培训', desc: `培训客户团队云上运维`, role: roleLabels.senior, weight: 1, deps: ['运维文档交付'], deliverable: '培训记录' },
      { name: '项目结项', desc: '项目总结、遗留问题确认、经验沉淀', role: roleLabels.pm, weight: 0.5, deps: ['客户培训'], deliverable: '结项报告' },
    ]),
  })

  return { phases, source: 'quotation', totalQuotationHours: p.totalHours }
}


// ============================================================================
// 大数据平台 WBS 模板
// ============================================================================
function generateBigDataWBS(facts, quotation, sow, oppName) {
  const p = extractQuoteParams(quotation)
  const vmCount = facts.vm_count || p.vmCount || 0
  const dbCount = facts.database_count || p.dbCount || 0

  const phases = []

  const p1Budget = p.phaseHours.discovery || Math.round(p.totalHours * 0.12) || 12
  phases.push({
    name: 'P1 需求分析与架构设计',
    duration: `${daysToWeeks(p1Budget)}周`,
    tasks: distributeDays(p1Budget, [
      { name: '业务需求调研', desc: '梳理数据源、分析场景、确认数据量级和SLA要求', role: roleLabels.senior, weight: 1.5, deps: [], deliverable: '需求文档' },
      { name: '源系统数据调研', desc: `调研${dbCount}个源数据库的数据字典、数据量、更新频率`, role: roleLabels.mid, weight: 1.5, deps: ['业务需求调研'], deliverable: '数据调研报告' },
      { name: '湖仓一体架构设计', desc: `设计数据湖+数据仓库架构，${vmCount}节点集群规划`, role: roleLabels.senior, weight: 2, deps: ['源系统数据调研'], deliverable: '架构设计文档' },
      { name: '数据模型设计', desc: '设计ODS/DWD/DWS/ADS分层模型和主题域', role: roleLabels.senior, weight: 1.5, deps: ['湖仓一体架构设计'], deliverable: '数据模型文档' },
      { name: '架构评审', desc: '客户评审架构方案和数据模型', role: roleLabels.pm, weight: 0.5, deps: ['数据模型设计'], deliverable: '评审纪要' },
    ]),
  })

  const p2Budget = p.phaseHours.planning || Math.round(p.totalHours * 0.18) || 18
  phases.push({
    name: 'P2 平台搭建',
    duration: `${daysToWeeks(p2Budget)}周`,
    tasks: distributeDays(p2Budget, [
      { name: '大数据组件部署', desc: `部署EMR/Hologres/MaxCompute等组件，${vmCount}节点`, role: roleLabels.mid, weight: 2, deps: ['架构评审'], deliverable: '平台部署报告' },
      { name: '元数据管理搭建', desc: '部署元数据管理服务、数据目录', role: roleLabels.mid, weight: 1, deps: ['大数据组件部署'], deliverable: '元数据配置文档' },
      { name: 'ETL管道开发', desc: '开发数据采集、清洗、加载管道', role: roleLabels.mid, weight: 2, deps: ['大数据组件部署'], deliverable: 'ETL开发文档' },
      { name: '任务调度系统配置', desc: '配置Airflow/DolphinScheduler调度任务', role: roleLabels.mid, weight: 1, deps: ['ETL管道开发'], deliverable: '调度配置文档' },
      { name: '数据安全配置', desc: '配置数据权限、加密、脱敏规则', role: roleLabels.senior, weight: 1, deps: ['元数据管理搭建'], deliverable: '安全配置文档' },
    ]),
  })

  const p3Budget = p.phaseHours.implementation || Math.round(p.totalHours * 0.45) || 30
  phases.push({
    name: 'P3 数据迁移与治理',
    duration: `${daysToWeeks(p3Budget)}周`,
    tasks: distributeDays(p3Budget, [
      { name: `历史数据批量迁移(${dbCount}个库)`, desc: `从${dbCount}个源数据库批量迁移历史数据`, role: roleLabels.mid, weight: 2, deps: ['任务调度系统配置'], deliverable: '数据迁移报告' },
      { name: '增量数据同步', desc: '配置CDC/日志解析增量同步管道', role: roleLabels.mid, weight: 1.5, deps: ['历史数据批量迁移(' + dbCount + '个库)'], deliverable: '增量同步配置' },
      { name: '数据质量监控', desc: '配置数据质量规则、异常告警', role: roleLabels.mid, weight: 1, deps: ['增量数据同步'], deliverable: '质量监控配置' },
      { name: '数据治理体系', desc: '建立数据标准、质量规则、数据血缘', role: roleLabels.senior, weight: 1.5, deps: ['数据质量监控'], deliverable: '数据治理规范' },
      { name: '数据资产目录', desc: '构建数据资产目录、自助分析门户', role: roleLabels.mid, weight: 1, deps: ['数据治理体系'], deliverable: '资产目录' },
    ]),
  })

  const p4Budget = p.phaseHours.testing || Math.round(p.totalHours * 0.15) || 10
  phases.push({
    name: 'P4 测试验证',
    duration: `${daysToWeeks(p4Budget)}周`,
    tasks: distributeDays(p4Budget, [
      { name: '功能测试', desc: '验证ETL管道、调度任务、查询功能', role: roleLabels.mid, weight: 1.5, deps: ['数据资产目录'], deliverable: '功能测试报告' },
      { name: '性能压测', desc: `${vmCount}节点集群性能压测，验证查询SLA`, role: roleLabels.mid, weight: 1.5, deps: ['功能测试'], deliverable: '性能测试报告' },
      { name: '数据一致性校验', desc: '源端与目标端数据一致性校验', role: roleLabels.mid, weight: 1, deps: ['功能测试'], deliverable: '一致性校验报告' },
    ]),
  })

  const p5Budget = p.phaseHours.acceptance || Math.round(p.totalHours * 0.10) || 5
  phases.push({
    name: 'P5 验收交付',
    duration: `${daysToWeeks(p5Budget)}周`,
    tasks: distributeDays(p5Budget, [
      { name: 'UAT验收', desc: '客户按验收标准进行UAT测试', role: roleLabels.pm, weight: 1, deps: ['数据一致性校验', '性能压测'], deliverable: 'UAT报告' },
      { name: '运维文档交付', desc: '交付平台运维手册、开发规范', role: roleLabels.senior, weight: 1, deps: ['UAT验收'], deliverable: '运维手册' },
      { name: '培训与结项', desc: '数据平台运维培训和项目结项', role: roleLabels.pm, weight: 1, deps: ['运维文档交付'], deliverable: '结项报告' },
    ]),
  })

  return { phases, source: 'quotation', totalQuotationHours: p.totalHours }
}


// ============================================================================
// 通用 WBS 模板 (混合云/安全/成本优化)
// ============================================================================
function generateGenericWBS(facts, quotation, sow, oppName) {
  const p = extractQuoteParams(quotation)
  const projectType = facts.project_type || 'general'
  const typeLabels = {
    hybrid_cloud: '混合云', security: '安全加固', cost_optimization: '成本优化',
  }
  const typeLabel = typeLabels[projectType] || '云服务'

  const phases = []

  const p1Budget = p.phaseHours.discovery || Math.round(p.totalHours * 0.12) || 8
  phases.push({
    name: `P1 ${typeLabel}评估与调研`,
    duration: `${daysToWeeks(p1Budget)}周`,
    tasks: distributeDays(p1Budget, [
      { name: '项目启动会', desc: `确认${oppName} ${typeLabel}项目范围和目标`, role: roleLabels.pm, weight: 0.5, deps: [], deliverable: '项目章程' },
      { name: '现状调研', desc: `调研现有环境、资源配置、${typeLabel}现状`, role: roleLabels.senior, weight: 1.5, deps: ['项目启动会'], deliverable: '调研报告' },
      { name: '需求分析与基线', desc: '分析业务需求，确认技术基线和验收标准', role: roleLabels.senior, weight: 1, deps: ['现状调研'], deliverable: '需求规格书' },
      { name: '评估报告', desc: '汇总评估结果和改进建议', role: roleLabels.senior, weight: 1, deps: ['需求分析与基线'], deliverable: '评估报告' },
    ]),
  })

  const p2Budget = p.phaseHours.planning || Math.round(p.totalHours * 0.18) || 12
  phases.push({
    name: `P2 ${typeLabel}方案设计`,
    duration: `${daysToWeeks(p2Budget)}周`,
    tasks: distributeDays(p2Budget, [
      { name: '总体方案设计', desc: `设计${typeLabel}总体技术方案`, role: roleLabels.senior, weight: 2, deps: ['评估报告'], deliverable: '方案设计文档' },
      { name: '详细方案设计', desc: '编写详细实施方案和配置清单', role: roleLabels.senior, weight: 2, deps: ['总体方案设计'], deliverable: '详细设计文档' },
      { name: '方案评审', desc: '客户评审技术方案', role: roleLabels.pm, weight: 0.5, deps: ['详细方案设计'], deliverable: '评审纪要' },
    ]),
  })

  const p3Budget = p.phaseHours.implementation || Math.round(p.totalHours * 0.45) || 25
  phases.push({
    name: `P3 ${typeLabel}实施`,
    duration: `${daysToWeeks(p3Budget)}周`,
    tasks: distributeDays(p3Budget, [
      { name: '环境准备', desc: '准备实施环境、工具部署', role: roleLabels.mid, weight: 1, deps: ['方案评审'], deliverable: '环境就绪报告' },
      { name: '核心实施', desc: `${typeLabel}核心功能实施部署`, role: roleLabels.mid, weight: 3, deps: ['环境准备'], deliverable: '实施报告' },
      { name: '配置优化', desc: '根据测试结果优化配置', role: roleLabels.senior, weight: 1, deps: ['核心实施'], deliverable: '优化报告' },
    ]),
  })

  const p4Budget = p.phaseHours.testing || Math.round(p.totalHours * 0.15) || 8
  phases.push({
    name: 'P4 测试验证',
    duration: `${daysToWeeks(p4Budget)}周`,
    tasks: distributeDays(p4Budget, [
      { name: '功能测试', desc: '验证所有功能正常', role: roleLabels.mid, weight: 1.5, deps: ['配置优化'], deliverable: '功能测试报告' },
      { name: '性能测试', desc: '性能压测和稳定性验证', role: roleLabels.mid, weight: 1, deps: ['功能测试'], deliverable: '性能测试报告' },
      { name: '安全测试', desc: '安全扫描和合规检查', role: roleLabels.senior, weight: 1, deps: ['功能测试'], deliverable: '安全测试报告' },
    ]),
  })

  const p5Budget = p.phaseHours.acceptance || Math.round(p.totalHours * 0.10) || 5
  phases.push({
    name: 'P5 验收交付',
    duration: `${daysToWeeks(p5Budget)}周`,
    tasks: distributeDays(p5Budget, [
      { name: 'UAT验收', desc: '客户UAT测试', role: roleLabels.pm, weight: 1, deps: ['安全测试', '性能测试'], deliverable: 'UAT报告' },
      { name: '文档交付', desc: '交付运维文档和操作手册', role: roleLabels.senior, weight: 1, deps: ['UAT验收'], deliverable: '运维手册' },
      { name: '培训与结项', desc: '团队培训和项目结项', role: roleLabels.pm, weight: 1, deps: ['文档交付'], deliverable: '结项报告' },
    ]),
  })

  return { phases, source: 'quotation', totalQuotationHours: p.totalHours }
}


// ============================================================================
// 模板映射表
// ============================================================================
const templateGenerators = {
  landing_zone: generateLandingZoneWBS,
  migration: generateMigrationWBS,
  big_data: generateBigDataWBS,
  hybrid_cloud: generateGenericWBS,
  security: generateGenericWBS,
  cost_optimization: generateGenericWBS,
}

/**
 * 根据项目类型和报价数据生成 WBS
 * @param {string} projectType - 项目类型
 * @param {object} facts - FactSheet 数据
 * @param {object} quotation - 报价数据 (含 estimate/input/cost)
 * @param {object} sow - SOW 数据 (含 milestones/deliverables)
 * @param {string} oppName - 商机名称
 * @returns {object} WBS 数据 { phases, source, totalQuotationHours }
 */
export function generateWBSByType(projectType, facts, quotation, sow, oppName) {
  const generator = templateGenerators[projectType] || generateGenericWBS

  // 如果没有报价数据，使用估算默认值
  if (!quotation || !quotation.estimate) {
    quotation = {
      estimate: {
        phaseHours: {},
        totalHours: 0,
        appAssessment: { apps: [], summary: { count: 0 } },
        migrationServices: [],
        migrationDays: 0,
      },
      input: { resources: {}, counts: { junior: 1, mid: 2, senior: 1, pm: 1 } },
    }
  }

  return generator(facts, quotation, sow, oppName)
}

export { phaseLabels, roleLabels }

const typeNames = {
  landing_zone: 'Landing Zone', migration: '云迁移', big_data: '大数据平台',
  hybrid_cloud: '混合云', security: '安全加固', cost_optimization: '成本优化',
}

export function getProjectTypeName(projectType) {
  return typeNames[projectType] || projectType
}
