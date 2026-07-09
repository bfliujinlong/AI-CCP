/**
 * 云迁移综合报价估算引擎
 *
 * 整合三套评估逻辑：
 * 1. HTML 评估系统 V6：资源规模因子 × 复杂度 = 工时
 * 2. BasicInfo 收集表：迁移服务计费项（主机/容器/存储/中间件/数据库/项目管理）
 * 3. 应用复杂度评估 V7：四维评分 → L1-L5 等级 → 基准人天 + 修正系数
 *
 * 核心公式：
 *   资源规模因子 = Σ(资源数量 × 资源权重)
 *   平均复杂度 = (技术 + 业务 + 集成 + 安全 + 合规) / 5
 *   基础工时 = 资源规模因子 × 平均复杂度
 *   阶段工时 = 基础工时 × 阶段占比
 *   应用迁移工时 = Σ(逐应用: 等级基准人天 × 修正系数)
 *   总工时 = 基础工时 + 应用迁移工时 + 迁移服务工时
 *   总成本 = 总工时 × Σ(各级人员数 × 各级日单价) + 培训 + 应急 + 硬件资源
 */

// ==================== 配置常量 ====================

export const CONFIG = {
  WORK_DAYS_PER_WEEK: 5,

  // 阶段工时占比
  HOUR_RATIOS: {
    discovery: 0.12,      // 需求调研
    planning: 0.18,       // 方案规划
    implementation: 0.45, // 实施部署
    testing: 0.15,        // 测试验证
    acceptance: 0.10,     // 验收交付
  },

  // 资源权重（来自 HTML V6）
  RESOURCE_WEIGHTS: {
    business_systems: 10,   // 业务系统数量（权重最高）
    vms: 0.2,               // 虚拟机
    kubernetes_nodes: 0.3,  // K8s 节点
    container_instances: 0.1, // 容器实例
    databases: 1.0,         // 数据库实例（合计）
  },

  // 应用复杂度等级映射（来自 Excel V7 参数页）
  APP_LEVELS: [
    { level: 'L1-简单型', min: 1.0, max: 1.8, daysLow: 5, daysHigh: 7 },
    { level: 'L2-普通型', min: 1.8, max: 2.6, daysLow: 7, daysHigh: 12 },
    { level: 'L3-中等型', min: 2.6, max: 3.4, daysLow: 15, daysHigh: 25 },
    { level: 'L4-复杂型', min: 3.4, max: 4.2, daysLow: 30, daysHigh: 50 },
    { level: 'L5-极高难度', min: 4.2, max: 5.01, daysLow: 60, daysHigh: 90 },
  ],

  // 应用阶段权重（来自 Excel V7 参数页）
  APP_PHASE_WEIGHTS: {
    discovery: 0.2,    // 调研设计
    migration: 0.3,    // 环境迁移
    adaptation: 0.3,   // 适配调试
    acceptance: 0.2,   // 验收割接
  },

  // 修正系数（来自 Excel V7 参数页）
  MODIFIERS: {
    automation: 0.8,   // 使用自动化迁移工具
    doc_missing: 1.5,  // 文档/源码缺失
    bandwidth: 1.2,    // 网络/带宽限制
    compliance: 1.3,   // 合规/安全额外要求
  },

  // 技术栈复杂度权重（来自 HTML V6）
  TECH_WEIGHTS: {
    languages: {
      java: 3.5, python: 2.5, net: 3.0, php: 2.0, nodejs: 2.5, go: 3.0, other: 4.0,
    },
    frameworks: {
      vue: 2.5, react: 3.0, angular: 3.5, jquery: 2.0, none: 1.5, other: 3.5,
    },
    multiLanguage: { no: 1.0, simple: 2.5, complex: 4.0 },
    architecture: { monolith: 2.0, micro: 4.0, hybrid: 3.5 },
    thirdParty: { none: 1.0, few: 2.5, medium: 3.5, many: 4.5 },
  },

  // 迁移服务计费项（来自 BasicInfo 迁移服务预估页）
  MIGRATION_SERVICE_ITEMS: [
    { id: 'host', name: '主机实例迁移', unit: '台', perUnitDays: 40, baseQuantity: 20000, role: 'B' },
    { id: 'container', name: '容器平台迁移(POD)', unit: '个', perUnitDays: 15, role: 'A' },
    { id: 'image_repo', name: '镜像仓库迁移', unit: '个', perUnitDays: 10, role: 'B' },
    { id: 'obj_storage', name: '对象/文件存储迁移', unit: '个', perUnitDays: 10, role: 'B' },
    { id: 'obj_storage_gb', name: '对象/文件存储迁移(GB)', unit: 'GB', perUnitDays: 2000, role: 'B' },
    { id: 'disk_storage', name: '存储迁移(磁盘)', unit: 'GB', perUnitDays: 1000, role: 'B' },
    { id: 'middleware', name: '中间件迁移(套)', unit: '套', perUnitDays: 2, role: 'B' },
    { id: 'middleware_gb', name: '中间件迁移(GB)', unit: 'GB', perUnitDays: 500, role: 'B' },
    { id: 'database', name: '数据库迁移(套)', unit: '套', perUnitDays: 2, role: 'D' },
    { id: 'database_gb', name: '数据库迁移(GB)', unit: 'GB', perUnitDays: 800, role: 'D' },
  ],

  // 人员角色（来自 BasicInfo 预算范围页）
  ROLES: {
    A: { name: '架构师', defaultRate: 4200 },
    B: { name: '实施工程师', defaultRate: 1900 },
    C: { name: '项目经理', defaultRate: 4200 },
    D: { name: 'DBA', defaultRate: 3300 },
  },

  // 服务等级人员配比（来自 BasicInfo 预算范围页）
  SERVICE_TIERS: {
    gold: { name: '金', formula: '2A+2B+3C+2D', counts: { A: 2, B: 2, C: 3, D: 2 } },
    silver: { name: '银', formula: '2A+2B+2C+2D', counts: { A: 2, B: 2, C: 2, D: 2 } },
    bronze: { name: '铜', formula: '2A+1B+2C+2D', counts: { A: 2, B: 1, C: 2, D: 2 } },
  },

  // 默认人员日单价（来自 HTML V6）
  DEFAULT_RATES: {
    junior: 2000,
    mid: 2500,
    senior: 3500,
    pm: 4000,
  },
}

// ==================== 资源规模因子计算 ====================

/**
 * 计算资源规模因子
 * @param {Object} resources - 资源数据
 * @param {number} resources.business_systems - 业务系统数量
 * @param {number} resources.vms - 虚拟机数量
 * @param {number} resources.kubernetes_nodes - K8s 节点数
 * @param {number} resources.container_instances - 容器实例数
 * @param {Object} resources.databases - 数据库实例 { mysql, oracle, sqlserver, redis, mongodb }
 * @returns {number} 资源规模因子
 */
export function calcResourceFactor(resources) {
  const dbTotal = Object.values(resources.databases || {}).reduce((s, c) => s + (Number(c) || 0), 0)
  return (
    (resources.business_systems || 0) * CONFIG.RESOURCE_WEIGHTS.business_systems +
    (resources.vms || 0) * CONFIG.RESOURCE_WEIGHTS.vms +
    (resources.kubernetes_nodes || 0) * CONFIG.RESOURCE_WEIGHTS.kubernetes_nodes +
    (resources.container_instances || 0) * CONFIG.RESOURCE_WEIGHTS.container_instances +
    dbTotal * CONFIG.RESOURCE_WEIGHTS.databases
  )
}

// ==================== 技术复杂度计算 ====================

/**
 * 计算技术复杂度（来自 HTML V6 逻辑）
 * @param {Object} techStack - 技术栈选择
 * @returns {number} 技术复杂度 (1-5)
 */
export function calcTechComplexity(techStack) {
  let total = 0, count = 0

  // 开发语言（多选取平均）
  if (techStack.languages?.length) {
    const sum = techStack.languages.reduce((s, l) => s + (CONFIG.TECH_WEIGHTS.languages[l] || 3), 0)
    total += sum / techStack.languages.length
    count++
  }

  // 前端框架（多选取平均）
  if (techStack.frameworks?.length) {
    const sum = techStack.frameworks.reduce((s, f) => s + (CONFIG.TECH_WEIGHTS.frameworks[f] || 3), 0)
    total += sum / techStack.frameworks.length
    count++
  }

  // 多语言支持（单选）
  if (techStack.multiLanguage) {
    total += CONFIG.TECH_WEIGHTS.multiLanguage[techStack.multiLanguage] || 1
    count++
  }

  // 架构类型（单选）
  if (techStack.architecture) {
    total += CONFIG.TECH_WEIGHTS.architecture[techStack.architecture] || 3
    count++
  }

  // 第三方集成（单选）
  if (techStack.thirdParty) {
    total += CONFIG.TECH_WEIGHTS.thirdParty[techStack.thirdParty] || 2
    count++
  }

  return count ? Math.min(5, Math.max(1, parseFloat((total / count).toFixed(1)))) : 3
}

// ==================== 应用复杂度评估（Excel V7）====================

/**
 * 计算单个应用的平均分和等级
 * @param {Object} app - 应用评分 { name, d1, d2, d3, d4, modifiers: {automation, docMissing, bandwidth, compliance, other} }
 * @returns {Object} { avgScore, level, daysLow, daysHigh, modifiedDaysLow, modifiedDaysHigh, phaseBreakdown }
 */
export function assessApp(app) {
  const total = (app.d1 || 1) + (app.d2 || 1) + (app.d3 || 1) + (app.d4 || 1)
  const avgScore = parseFloat((total / 4).toFixed(2))

  // 等级映射
  const levelInfo = CONFIG.APP_LEVELS.find(l => avgScore >= l.min && avgScore < l.max) || CONFIG.APP_LEVELS[CONFIG.APP_LEVELS.length - 1]

  // 修正系数（连乘）
  const m = app.modifiers || {}
  const modFactor = [
    m.automation ? CONFIG.MODIFIERS.automation : 1,
    m.docMissing ? CONFIG.MODIFIERS.doc_missing : 1,
    m.bandwidth ? CONFIG.MODIFIERS.bandwidth : 1,
    m.compliance ? CONFIG.MODIFIERS.compliance : 1,
    m.other || 1,
  ].reduce((product, val) => product * val, 1)

  const modifiedDaysLow = Math.round(levelInfo.daysLow * modFactor)
  const modifiedDaysHigh = Math.round(levelInfo.daysHigh * modFactor)

  // 阶段分解
  const phaseBreakdown = {
    discovery: { low: Math.round(modifiedDaysLow * CONFIG.APP_PHASE_WEIGHTS.discovery), high: Math.round(modifiedDaysHigh * CONFIG.APP_PHASE_WEIGHTS.discovery) },
    migration: { low: Math.round(modifiedDaysLow * CONFIG.APP_PHASE_WEIGHTS.migration), high: Math.round(modifiedDaysHigh * CONFIG.APP_PHASE_WEIGHTS.migration) },
    adaptation: { low: Math.round(modifiedDaysLow * CONFIG.APP_PHASE_WEIGHTS.adaptation), high: Math.round(modifiedDaysHigh * CONFIG.APP_PHASE_WEIGHTS.adaptation) },
    acceptance: { low: Math.round(modifiedDaysLow * CONFIG.APP_PHASE_WEIGHTS.acceptance), high: Math.round(modifiedDaysHigh * CONFIG.APP_PHASE_WEIGHTS.acceptance) },
  }

  return {
    name: app.name || '未命名应用',
    d1: app.d1 || 1, d2: app.d2 || 1, d3: app.d3 || 1, d4: app.d4 || 1,
    total, avgScore,
    level: levelInfo.level,
    daysLow: levelInfo.daysLow, daysHigh: levelInfo.daysHigh,
    modFactor: parseFloat(modFactor.toFixed(2)),
    modifiedDaysLow, modifiedDaysHigh,
    phaseBreakdown,
  }
}

/**
 * 批量评估应用并汇总
 * @param {Array} apps - 应用评分数组
 * @returns {Object} { apps: [...assessResults], summary: { count, totalDaysLow, totalDaysHigh, ... } }
 */
export function assessApps(apps) {
  const results = apps.map(assessApp)
  const summary = {
    count: results.length,
    totalDaysLow: results.reduce((s, a) => s + a.modifiedDaysLow, 0),
    totalDaysHigh: results.reduce((s, a) => s + a.modifiedDaysHigh, 0),
    avgScore: results.length ? parseFloat((results.reduce((s, a) => s + a.avgScore, 0) / results.length).toFixed(2)) : 0,
    byLevel: {},
    byPhase: { discovery: { low: 0, high: 0 }, migration: { low: 0, high: 0 }, adaptation: { low: 0, high: 0 }, acceptance: { low: 0, high: 0 } },
  }
  results.forEach(a => {
    summary.byLevel[a.level] = (summary.byLevel[a.level] || 0) + 1
    Object.keys(summary.byPhase).forEach(phase => {
      summary.byPhase[phase].low += a.phaseBreakdown[phase].low
      summary.byPhase[phase].high += a.phaseBreakdown[phase].high
    })
  })
  return { apps: results, summary }
}

// ==================== 迁移服务计费项计算（BasicInfo）====================

/**
 * 计算迁移服务工时
 * @param {Object} items - 各计费项数量 { host, container, image_repo, obj_storage, obj_storage_gb, disk_storage, middleware, middleware_gb, database, database_gb }
 * @returns {Array} 计费明细 [{ id, name, quantity, perUnitDays, totalDays, role }]
 */
export function calcMigrationServices(items) {
  return CONFIG.MIGRATION_SERVICE_ITEMS.map(item => {
    const qty = Number(items[item.id]) || 0
    const totalDays = qty > 0 ? Math.ceil(qty / item.perUnitDays) : 0
    return {
      ...item,
      quantity: qty,
      totalDays,
    }
  }).filter(i => i.quantity > 0)
}

// ==================== 综合工时计算 ====================

/**
 * 综合计算总工时
 * @param {Object} input - 完整输入
 * @param {Object} input.resources - 资源数据
 * @param {Object} input.techStack - 技术栈
 * @param {Object} input.complexity - 其他复杂度 { business, integration, security, compliance }
 * @param {Array} input.apps - 应用复杂度评分数组
 * @param {Object} input.migrationItems - 迁移服务计费项
 * @param {number} input.appModifierDays - 应用迁移工时修正（取 low 或 high）
 * @returns {Object} 完整估算结果
 */
export function calculateEstimate(input) {
  const { resources, techStack, complexity, apps, migrationItems } = input

  // 1. 资源规模因子
  const resourceFactor = calcResourceFactor(resources)

  // 2. 技术复杂度
  const techComplexity = calcTechComplexity(techStack)

  // 3. 平均复杂度（5 维度平均）
  const allComplexity = [
    techComplexity,
    complexity.business || 3,
    complexity.integration || 3,
    complexity.security || 3,
    complexity.compliance || 3,
  ]
  const avgComplexity = allComplexity.reduce((s, v) => s + v, 0) / 5

  // 4. 基础工时 = 资源规模因子 × 平均复杂度
  const baseHours = Math.round(resourceFactor * avgComplexity)

  // 5. 阶段工时分配
  const phaseHours = {}
  let totalBaseHours = 0
  Object.entries(CONFIG.HOUR_RATIOS).forEach(([phase, ratio]) => {
    phaseHours[phase] = Math.round(baseHours * ratio)
    totalBaseHours += phaseHours[phase]
  })

  // 6. 应用迁移工时
  const appAssessment = apps?.length ? assessApps(apps) : { apps: [], summary: { totalDaysLow: 0, totalDaysHigh: 0, count: 0 } }
  const appDaysLow = appAssessment.summary.totalDaysLow
  const appDaysHigh = appAssessment.summary.totalDaysHigh

  // 7. 迁移服务工时
  const migrationServices = migrationItems ? calcMigrationServices(migrationItems) : []
  const migrationDays = migrationServices.reduce((s, i) => s + i.totalDays, 0)

  // 8. 总工时（取中间值）
  const appDaysAvg = Math.round((appDaysLow + appDaysHigh) / 2)
  const totalHours = totalBaseHours + appDaysAvg + migrationDays

  // 9. 项目周期
  const totalWeeks = Math.ceil(totalHours / CONFIG.WORK_DAYS_PER_WEEK)

  return {
    resourceFactor: parseFloat(resourceFactor.toFixed(2)),
    techComplexity,
    avgComplexity: parseFloat(avgComplexity.toFixed(2)),
    baseHours: totalBaseHours,
    phaseHours,
    appAssessment,
    appDaysLow,
    appDaysHigh,
    appDaysAvg,
    migrationServices,
    migrationDays,
    totalHours,
    totalWeeks,
    complexity: {
      technical: techComplexity,
      business: complexity.business || 3,
      integration: complexity.integration || 3,
      security: complexity.security || 3,
      compliance: complexity.compliance || 3,
    },
  }
}

// ==================== 成本计算 ====================

/**
 * 计算项目成本
 * @param {Object} estimate - calculateEstimate 的结果
 * @param {Object} rates - 人员日单价 { junior, mid, senior, pm }
 * @param {Object} counts - 各级人员数量 { junior, mid, senior, pm }
 * @param {Object} extraCosts - 额外成本 { training, contingency, resource }
 * @returns {Object} 成本明细
 */
export function calculateCost(estimate, rates, counts, extraCosts) {
  const r = { ...CONFIG.DEFAULT_RATES, ...rates }
  const c = { junior: 1, mid: 2, senior: 1, pm: 1, ...counts }
  const ec = { training: 45000, contingency: 75000, resource: 100000, ...extraCosts }

  const totalHours = estimate.totalHours

  const juniorCost = totalHours * c.junior * r.junior
  const midCost = totalHours * c.mid * r.mid
  const seniorCost = totalHours * c.senior * r.senior
  const pmCost = totalHours * c.pm * r.pm

  const personnelCost = juniorCost + midCost + seniorCost + pmCost
  const totalCost = personnelCost + ec.training + ec.contingency + ec.resource

  return {
    personnel: {
      junior: { count: c.junior, rate: r.junior, cost: juniorCost },
      mid: { count: c.mid, rate: r.mid, cost: midCost },
      senior: { count: c.senior, rate: r.senior, cost: seniorCost },
      pm: { count: c.pm, rate: r.pm, cost: pmCost },
    },
    personnelCost,
    training: ec.training,
    contingency: ec.contingency,
    resource: ec.resource,
    totalCost,
    perDayCost: Math.round(totalCost / totalHours),
  }
}

// ==================== 辅助函数 ====================

/**
 * 获取应用等级说明
 */
export function getAppLevelDescription(score) {
  const level = CONFIG.APP_LEVELS.find(l => score >= l.min && score < l.max)
  if (!level) return ''
  return `${level.level} (${level.daysLow}-${level.daysHigh} 人天)`
}

/**
 * 生成默认输入数据
 */
export function getDefaultInput() {
  return {
    resources: {
      business_systems: 10,
      vms: 80,
      kubernetes_nodes: 100,
      container_instances: 4,
      databases: { mysql: 2, oracle: 3, sqlserver: 1, redis: 5, mongodb: 2 },
    },
    techStack: {
      languages: ['java'],
      frameworks: ['vue'],
      multiLanguage: 'simple',
      architecture: 'micro',
      thirdParty: 'medium',
    },
    complexity: {
      business: 3.5,
      integration: 3.8,
      security: 4.2,
      compliance: 3.7,
    },
    apps: [],
    migrationItems: {
      host: 0, container: 0, image_repo: 0,
      obj_storage: 0, obj_storage_gb: 0, disk_storage: 0,
      middleware: 0, middleware_gb: 0,
      database: 0, database_gb: 0,
    },
    rates: { ...CONFIG.DEFAULT_RATES },
    counts: { junior: 1, mid: 2, senior: 1, pm: 1 },
    extraCosts: { training: 45000, contingency: 75000, resource: 100000 },
  }
}
