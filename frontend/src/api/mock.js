import { getItem, setItem, getJSON, setJSON } from '../utils/db'

const DEV_MODE = import.meta.env.DEV

function loadFromStorage(key, defaultValue) {
  return getJSON(`aicc_mock_${key}`, defaultValue)
}

function saveToStorage(key, value) {
  setJSON(`aicc_mock_${key}`, value)
}

// ==================== LLM 对接 ====================
// 从 localStorage 读取 LLM 配置，若已配置则调用真实 LLM API

function loadLLMConfig() {
  try {
    const cfg = getJSON('aicc_llm_config', {})
    // 新版：按 provider 隔离存储
    if (cfg.providers && cfg.provider) {
      return {
        provider: cfg.provider,
        ...cfg.providers[cfg.provider],
      }
    }
    // 旧版兼容：直接存储了单 provider 配置
    return cfg
  } catch { return {} }
}

function isLLMEnabled() {
  const cfg = loadLLMConfig()
  return cfg.provider && cfg.provider !== 'mock' && cfg.api_key
}

async function callLLM(messages, options = {}) {
  const cfg = loadLLMConfig()
  const token = getItem('token')
  const res = await fetch('/api/v1/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      provider: cfg.provider,
      api_key: cfg.api_key,
      model: cfg.model || 'qwen-plus',
      base_url: cfg.base_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      messages,
      temperature: options.temperature ?? cfg.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? cfg.max_tokens ?? 2048,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM 代理请求失败 (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.content || ''
}

async function callLLMStructured(prompt, systemPrompt, outputHint) {
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: `${prompt}\n\n请返回严格的 JSON 格式${outputHint ? `，包含：${outputHint}` : ''}。不要返回 markdown 代码块。` })
  const raw = await callLLM(messages)
  try {
    return JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}') + 1
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end)) } catch {}
    }
    return { raw_response: raw }
  }
}

// ==================== Skill 学习系统 ====================
// 让报价 Skill "越用越好用"：保存执行历史 → 用户反馈 → 自动调优参数

function loadSkillHistory() {
  try {
    return JSON.parse(localStorage.getItem('aicc_skill_history') || '[]')
  } catch { return [] }
}

function saveSkillHistory(history) {
  localStorage.setItem('aicc_skill_history', JSON.stringify(history.slice(-200))) // 最多保留200条
}

function loadLearningParams() {
  try {
    const saved = localStorage.getItem('aicc_learning_params')
    if (saved) return JSON.parse(saved)
  } catch {}
  // 默认学习参数 - 各维度的调整系数（1.0 = 不调整）
  return {
    version: 1,
    daily_rate_factor: 1.0,        // 人天单价调整系数
    day_factors: {                   // 各工作项人天调整系数
      '架构设计': 1.0, '环境搭建': 1.0, '安全合规': 1.0,
      '网络配置': 1.0, 'IAM 配置': 1.0, '监控运维': 1.0,
      '培训交付': 1.0, '迁移评估': 1.0, '迁移方案设计': 1.0,
      '迁移实施': 1.0, '割接与验证': 1.0, '测试与优化': 1.0,
      '需求分析与评估': 1.0, '方案设计': 1.0, '实施与部署': 1.0,
      '测试与验证': 1.0, '项目管理': 1.0,
    },
    project_type_factors: {          // 按项目类型的整体调整系数
      landing_zone: 1.0, migration: 1.0, big_data: 1.0,
      hybrid_cloud: 1.0, security: 1.0, cost_optimization: 1.0,
    },
    feedback_count: 0,
    accuracy_trend: [],              // 准确率趋势 [{date, accuracy}]
    last_updated: null,
  }
}

function saveLearningParams(params) {
  params.last_updated = new Date().toISOString()
  localStorage.setItem('aicc_learning_params', JSON.stringify(params))
}

// 根据反馈调整学习参数
function applyFeedback(estimatedDays, actualDays, projectType, breakdownItems) {
  const params = loadLearningParams()
  const ratio = actualDays / estimatedDays // >1 = 低估, <1 = 高估

  // 按项目类型调整整体系数（指数移动平均，学习率0.15）
  const lr = 0.15
  if (projectType && params.project_type_factors[projectType] !== undefined) {
    const current = params.project_type_factors[projectType]
    params.project_type_factors[projectType] = current * (1 - lr) + ratio * lr
  }

  // 按工作项调整细粒度系数
  if (breakdownItems && breakdownItems.length > 0) {
    breakdownItems.forEach(item => {
      const name = item.item
      if (params.day_factors[name] !== undefined && item.days > 0) {
        const current = params.day_factors[name]
        // 用整体ratio调整每个工作项（假设偏差均匀分布）
        params.day_factors[name] = Math.max(0.3, Math.min(3.0, current * (1 - lr) + ratio * lr))
      }
    })
  }

  // 记录准确率趋势
  const accuracy = Math.max(0, 1 - Math.abs(ratio - 1))
  params.accuracy_trend.push({ date: new Date().toISOString(), accuracy: Math.round(accuracy * 100) / 100 })
  if (params.accuracy_trend.length > 50) params.accuracy_trend = params.accuracy_trend.slice(-50)

  params.feedback_count = (params.feedback_count || 0) + 1
  saveLearningParams(params)
  return { params, accuracy }
}

const defaultCustomers = [
  { id: 'c001', name: '中国银行', industry: '金融', contact_name: '张经理', contact_email: 'zhang@boc.com', contact_phone: '13800138001', address: '北京市西城区', description: '国有大型商业银行', owner_id: 'u001', is_active: true, created_at: '2024-01-15T10:00:00Z', updated_at: '2024-03-20T14:30:00Z' },
  { id: 'c002', name: '宝钢集团', industry: '制造', contact_name: '李总', contact_email: 'li@baosteel.com', contact_phone: '13900139002', address: '上海市宝山区', description: '大型钢铁制造企业', owner_id: 'u001', is_active: true, created_at: '2024-02-10T09:00:00Z', updated_at: '2024-04-15T16:00:00Z' },
  { id: 'c003', name: '永辉超市', industry: '零售', contact_name: '王总监', contact_email: 'wang@yonghui.com', contact_phone: '13700137003', address: '福州市台江区', description: '连锁零售企业', owner_id: 'u001', is_active: true, created_at: '2024-03-05T11:00:00Z', updated_at: '2024-05-10T09:30:00Z' },
  { id: 'c004', name: '字节跳动', industry: '互联网', contact_name: '赵架构师', contact_email: 'zhao@bytedance.com', contact_phone: '13600136004', address: '北京市海淀区', description: '互联网科技公司', owner_id: 'u001', is_active: true, created_at: '2024-03-20T08:30:00Z', updated_at: '2024-06-01T10:00:00Z' },
  { id: 'c005', name: '深圳市政府', industry: '政府', contact_name: '陈处长', contact_email: 'chen@sz.gov.cn', contact_phone: '13500135005', address: '深圳市福田区', description: '政务云项目', owner_id: 'u001', is_active: true, created_at: '2024-04-01T14:00:00Z', updated_at: '2024-06-15T11:30:00Z' },
  { id: 'c006', name: '浙江大学', industry: '教育', contact_name: '刘教授', contact_email: 'liu@zju.edu.cn', contact_phone: '13400134006', address: '杭州市西湖区', description: '高校科研云平台', owner_id: 'u001', is_active: false, created_at: '2024-01-20T10:00:00Z', updated_at: '2024-02-28T15:00:00Z' },
]

const defaultOpportunities = [
  { id: 'o001', name: '中国银行 Landing Zone 项目', customer_id: 'c001', customer_name: '中国银行', type: 'landing_zone', status: 'proposal', estimated_revenue: 2800000, probability: 70, description: '为国有银行构建多云 Landing Zone 架构', owner_id: 'u001', created_at: '2024-02-01T10:00:00Z', updated_at: '2024-05-15T14:00:00Z' },
  { id: 'o002', name: '宝钢集团云迁移项目', customer_id: 'c002', customer_name: '宝钢集团', type: 'migration', status: 'negotiation', estimated_revenue: 3500000, probability: 60, description: '核心业务系统从本地机房迁移至华为云', owner_id: 'u001', created_at: '2024-03-10T09:00:00Z', updated_at: '2024-06-01T16:00:00Z' },
  { id: 'o003', name: '永辉超市大数据平台', customer_id: 'c003', customer_name: '永辉超市', type: 'big_data', status: 'discovery', estimated_revenue: 1500000, probability: 40, description: '构建零售大数据分析平台', owner_id: 'u001', created_at: '2024-04-15T11:00:00Z', updated_at: '2024-05-20T09:30:00Z' },
  { id: 'o004', name: '字节跳动混合云架构', customer_id: 'c004', customer_name: '字节跳动', type: 'hybrid_cloud', status: 'discovery', estimated_revenue: 5000000, probability: 30, description: '混合云架构设计与实施', owner_id: 'u001', created_at: '2024-05-01T08:30:00Z', updated_at: '2024-06-10T10:00:00Z' },
  { id: 'o005', name: '深圳市政务云安全加固', customer_id: 'c005', customer_name: '深圳市政府', type: 'security', estimated_revenue: 1800000, probability: 80, status: 'proposal', description: '政务云安全合规加固项目', owner_id: 'u001', created_at: '2024-04-20T14:00:00Z', updated_at: '2024-06-05T11:30:00Z' },
  { id: 'o006', name: '中国银行成本优化', customer_id: 'c001', customer_name: '中国银行', type: 'cost_optimization', status: 'closed_won', estimated_revenue: 800000, probability: 100, description: '云资源成本优化咨询', owner_id: 'u001', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-03-30T15:00:00Z' },
  { id: 'o007', name: '浙江大学云迁移评估', customer_id: 'c006', customer_name: '浙江大学', type: 'migration', status: 'closed_lost', estimated_revenue: 600000, probability: 0, description: '科研系统云迁移评估', owner_id: 'u001', created_at: '2024-01-25T10:00:00Z', updated_at: '2024-02-28T15:00:00Z' },
]

const defaultFactSheets = [
  { id: 'fs001', opportunity_id: 'o001', category: 'general', version: 2, created_by: 'u001', created_at: '2024-05-10T10:00:00Z', updated_at: '2024-05-15T14:00:00Z', facts: { project_type: 'landing_zone', current_cloud: 'on_premise', target_cloud: 'aliyun', vm_count: 500, database_count: 30, region_count: 3, account_count: 15, vpc_count: 12, security_level: 'advanced' } },
  { id: 'fs002', opportunity_id: 'o002', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-10T09:00:00Z', updated_at: '2024-04-10T09:00:00Z', facts: { project_type: 'migration', current_cloud: 'on_premise', target_cloud: 'huawei', vm_count: 800, database_count: 45, region_count: 2, account_count: 8, vpc_count: 6, security_level: 'advanced', architecture_type: 'microservice', app_count: 12, microservice_count: 85, k8s_cluster_count: 3, container_count: 320, api_count: 150, storage_tb: 50, bandwidth_mbps: 1000 } },
  { id: 'fs003', opportunity_id: 'o003', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-20T11:00:00Z', updated_at: '2024-04-20T11:00:00Z', facts: { project_type: 'big_data', current_cloud: 'on_premise', target_cloud: 'aliyun', vm_count: 200, database_count: 10, region_count: 2, account_count: 5, vpc_count: 4, security_level: 'medium' } },
  { id: 'fs004', opportunity_id: 'o004', category: 'general', version: 1, created_by: 'u001', created_at: '2024-05-05T08:30:00Z', updated_at: '2024-05-05T08:30:00Z', facts: { project_type: 'hybrid_cloud', current_cloud: 'aws', target_cloud: 'aliyun', vm_count: 1200, database_count: 60, region_count: 4, account_count: 20, vpc_count: 18, security_level: 'advanced', architecture_type: 'hybrid', app_count: 25, microservice_count: 120, k8s_cluster_count: 5, container_count: 500, api_count: 300, storage_tb: 200, bandwidth_mbps: 5000 } },
  { id: 'fs005', opportunity_id: 'o005', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-25T14:00:00Z', updated_at: '2024-04-25T14:00:00Z', facts: { project_type: 'security', current_cloud: 'aliyun', target_cloud: 'huawei', vm_count: 300, database_count: 15, region_count: 2, account_count: 10, vpc_count: 8, security_level: 'advanced' } },
  { id: 'fs006', opportunity_id: 'o006', category: 'general', version: 1, created_by: 'u001', created_at: '2024-01-25T10:00:00Z', updated_at: '2024-01-25T10:00:00Z', facts: { project_type: 'migration', current_cloud: 'on_premise', target_cloud: 'tencent', vm_count: 150, database_count: 8, region_count: 1, account_count: 3, vpc_count: 2, security_level: 'medium' } },
]

// 懒加载：第一次访问时才从存储读取（此时 initStorage 已完成）
let _customers = null
let _opportunities = null
let _factSheets = null

function getMockCustomers() {
  if (!_customers) _customers = loadFromStorage('customers', defaultCustomers)
  return _customers
}
function getMockOpportunities() {
  if (!_opportunities) _opportunities = loadFromStorage('opportunities', defaultOpportunities)
  return _opportunities
}
function getMockFactSheets() {
  if (!_factSheets) _factSheets = loadFromStorage('factSheets', defaultFactSheets)
  return _factSheets
}

const mockSkills = [
  { id: 'sk001', name: 'LZ-Discovery', category: 'landing_zone', version: '1.0', description: 'Landing Zone 发现问题生成器 - 自动生成项目发现阶段的关键问题清单', prompt_template: 'Based on the following project context, generate discovery questions...\n\nProject Type: {project_type}\nCurrent Cloud: {current_cloud}\nTarget Cloud: {target_cloud}\nAccount Count: {account_count}\nRegion Count: {region_count}\nSecurity Level: {security_level}', input_schema: { project_type: 'string', current_cloud: 'string', target_cloud: 'string', account_count: 'integer', region_count: 'integer', security_level: 'string' }, output_schema: { questions: [{ category: 'string', question: 'string', purpose: 'string' }] }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk002', name: 'LZ-SOW', category: 'landing_zone', version: '1.0', description: 'Landing Zone SOW 生成器 - 基于 Fact Sheet 自动生成项目工作说明书', prompt_template: 'Generate a Statement of Work...\n\n{facts}', input_schema: { facts: 'object' }, output_schema: { scope: 'string', deliverables: ['string'], assumptions: ['string'], risks: ['string'], timeline: 'string', team: 'string' }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk003', name: 'Migration-WBS', category: 'migration', version: '1.0', description: '迁移项目 WBS 生成器 - 自动生成迁移项目工作分解结构', prompt_template: 'Generate a WBS for migration...\n\nVM Count: {vm_count}\nDatabase Count: {database_count}', input_schema: { vm_count: 'integer', database_count: 'integer', current_cloud: 'string', target_cloud: 'string' }, output_schema: { phases: [{ name: 'string', tasks: [{ name: 'string', duration_days: 'integer', dependencies: ['string'] }] }] }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk004', name: 'Estimate-LZ', category: 'landing_zone', version: '1.0', description: 'Landing Zone 成本估算器 - 基于 Fact Sheet 自动估算项目人天和成本', prompt_template: 'Estimate cost for LZ...\n\nAccount Count: {account_count}\nRegion Count: {region_count}', input_schema: { account_count: 'integer', region_count: 'integer', vpc_count: 'integer', security_level: 'string', target_cloud: 'string' }, output_schema: { person_days: 'number', cost_breakdown: [{ item: 'string', days: 'number', rate: 'number', total: 'number' }], total_cost: 'number' }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk005', name: 'Generate-FactSheet', category: 'general', version: '1.0', description: 'Fact Sheet 生成器 - 基于项目信息自动生成结构化 Fact Sheet', prompt_template: 'Generate a structured Fact Sheet based on project information...\n\nProject Type: {project_type}\nCurrent Cloud: {current_cloud}\nTarget Cloud: {target_cloud}\nVM Count: {vm_count}\nDatabase Count: {database_count}\nRegion Count: {region_count}\nAccount Count: {account_count}\nVPC Count: {vpc_count}\nSecurity Level: {security_level}', input_schema: { project_type: 'string', current_cloud: 'string', target_cloud: 'string', vm_count: 'integer', database_count: 'integer', region_count: 'integer', account_count: 'integer', vpc_count: 'integer', security_level: 'string' }, output_schema: { facts: 'object', recommendations: ['string'] }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk006', name: 'Generate-Quotation', category: 'general', version: '1.0', description: 'AI 报价生成器 - 基于 Fact Sheet 自动生成项目报价', prompt_template: 'Generate a detailed quotation based on Fact Sheet...\n\n{facts}', input_schema: { facts: 'object' }, output_schema: { cost_breakdown: [{ item: 'string', description: 'string', days: 'number', rate: 'number', total: 'number' }], total_cost: 'number', total_days: 'number', currency: 'string' }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk007', name: 'Generate-SOW', category: 'general', version: '1.0', description: 'SOW 生成器 - 基于 Fact Sheet 自动生成工作说明书', prompt_template: 'Generate a Statement of Work based on project facts...\n\n{facts}', input_schema: { facts: 'object' }, output_schema: { title: 'string', project_overview: 'string', scope: 'string', scope_items: [{ category: 'string', item: 'string', included: 'boolean' }], deliverables: [{ name: 'string', description: 'string', due_week: 'integer' }], assumptions: ['string'], risks: [{ description: 'string', mitigation: 'string' }], timeline: [{ phase: 'string', duration: 'string', milestones: ['string'] }], team: [{ role: 'string', count: 'integer', responsibility: 'string' }], acceptance_criteria: ['string'] }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'sk008', name: 'Generate-WBS', category: 'general', version: '1.0', description: 'WBS 生成器 - 基于项目信息自动生成工作分解结构', prompt_template: 'Generate a Work Breakdown Structure based on project facts...\n\n{facts}', input_schema: { facts: 'object' }, output_schema: { phases: [{ name: 'string', duration: 'string', tasks: [{ name: 'string', duration_days: 'integer', role: 'string', dependencies: 'string', deliverable: 'string', level: 'integer' }] }], total_days: 'integer', start_date: 'string', end_date: 'string' }, status: 'active', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
]

const mockDashboardStats = {
  customer_count: 6,
  opportunity_count: 7,
  active_opportunity_count: 5,
  total_revenue: 16000000,
  user_count: 3,
  opportunities_by_status: { discovery: 2, proposal: 2, negotiation: 1, closed_won: 1, closed_lost: 1 },
  opportunities_by_type: { landing_zone: 1, migration: 2, big_data: 1, hybrid_cloud: 1, security: 1, cost_optimization: 1 },
  recent_opportunities: [
    { id: 'o004', name: '字节跳动混合云架构', status: 'discovery', customer_name: '字节跳动', estimated_revenue: 5000000, created_at: '2024-05-01T08:30:00Z' },
    { id: 'o005', name: '深圳市政务云安全加固', status: 'proposal', customer_name: '深圳市政府', estimated_revenue: 1800000, created_at: '2024-04-20T14:00:00Z' },
    { id: 'o003', name: '永辉超市大数据平台', status: 'discovery', customer_name: '永辉超市', estimated_revenue: 1500000, created_at: '2024-04-15T11:00:00Z' },
    { id: 'o002', name: '宝钢集团云迁移项目', status: 'negotiation', customer_name: '宝钢集团', estimated_revenue: 3500000, created_at: '2024-03-10T09:00:00Z' },
    { id: 'o001', name: '中国银行 Landing Zone 项目', status: 'proposal', customer_name: '中国银行', estimated_revenue: 2800000, created_at: '2024-02-01T10:00:00Z' },
  ],
}

const mockFactRegistry = [
  { id: 'fr001', fact_name: 'vm_count', fact_type: 'integer', description: '虚拟机数量', validation_rule: { min: 0 }, required: true, category: 'infrastructure' },
  { id: 'fr002', fact_name: 'database_count', fact_type: 'integer', description: '数据库数量', validation_rule: { min: 0 }, required: true, category: 'infrastructure' },
  { id: 'fr003', fact_name: 'region_count', fact_type: 'integer', description: 'Region 数量', validation_rule: { min: 1 }, required: true, category: 'infrastructure' },
  { id: 'fr004', fact_name: 'vpc_count', fact_type: 'integer', description: 'VPC 数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr005', fact_name: 'security_level', fact_type: 'enum', description: '安全合规等级', validation_rule: { options: ['basic', 'medium', 'advanced'] }, required: true, category: 'security' },
  { id: 'fr006', fact_name: 'compliance_requirements', fact_type: 'array', description: '合规要求', validation_rule: { options: ['ISO27001', 'PCI-DSS', 'GDPR', 'MLPS', 'SOC2'] }, required: false, category: 'security' },
  { id: 'fr007', fact_name: 'account_count', fact_type: 'integer', description: '云账号数量', validation_rule: { min: 1 }, required: true, category: 'governance' },
  { id: 'fr008', fact_name: 'project_type', fact_type: 'enum', description: '项目类型', validation_rule: { options: ['landing_zone', 'migration', 'big_data', 'hybrid_cloud', 'security', 'cost_optimization'] }, required: true, category: 'general' },
  { id: 'fr009', fact_name: 'current_cloud', fact_type: 'enum', description: '当前云平台', validation_rule: { options: ['on_premise', 'aws', 'azure', 'aliyun', 'huawei', 'tencent'] }, required: true, category: 'general' },
  { id: 'fr010', fact_name: 'target_cloud', fact_type: 'enum', description: '目标云平台', validation_rule: { options: ['aws', 'azure', 'aliyun', 'huawei', 'tencent'] }, required: true, category: 'general' },
  { id: 'fr011', fact_name: 'budget_range', fact_type: 'string', description: '预算范围', validation_rule: {}, required: false, category: 'general' },
  { id: 'fr012', fact_name: 'timeline_months', fact_type: 'integer', description: '项目周期（月）', validation_rule: { min: 1 }, required: false, category: 'general' },
  { id: 'fr013', fact_name: 'architecture_type', fact_type: 'enum', description: '架构类型', validation_rule: { options: ['monolith', 'microservice', 'hybrid', 'serverless'] }, required: false, category: 'infrastructure' },
  { id: 'fr014', fact_name: 'app_count', fact_type: 'integer', description: '业务应用数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr015', fact_name: 'microservice_count', fact_type: 'integer', description: '微服务数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr016', fact_name: 'k8s_cluster_count', fact_type: 'integer', description: 'Kubernetes 集群数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr017', fact_name: 'container_count', fact_type: 'integer', description: '容器实例数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr018', fact_name: 'api_count', fact_type: 'integer', description: 'API 接口数量', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr019', fact_name: 'storage_tb', fact_type: 'integer', description: '存储容量(TB)', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
  { id: 'fr020', fact_name: 'bandwidth_mbps', fact_type: 'integer', description: '带宽需求(Mbps)', validation_rule: { min: 0 }, required: false, category: 'infrastructure' },
]

function paginate(list, page, pageSize) {
  const start = (page - 1) * pageSize
  return { items: list.slice(start, start + pageSize), total: list.length, page, page_size: pageSize }
}

export const mockApi = {
  dashboard: {
    stats: () => Promise.resolve(mockDashboardStats),
  },
  customers: {
    list: (params) => {
      let filtered = [...getMockCustomers()]
      if (params?.search) filtered = filtered.filter(c => c.name.includes(params.search))
      if (params?.is_active !== undefined) filtered = filtered.filter(c => c.is_active === params.is_active)
      return Promise.resolve(paginate(filtered, params?.page || 1, params?.page_size || 20))
    },
    get: (id) => {
      const c = getMockCustomers().find(c => c.id === id)
      return c ? Promise.resolve(c) : Promise.reject(new Error('Not found'))
    },
    create: (data) => {
      const newCustomer = { ...data, id: 'c' + Date.now(), owner_id: 'u001', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      getMockCustomers().push(newCustomer)
      saveToStorage('customers', getMockCustomers())
      return Promise.resolve(newCustomer)
    },
    update: (id, data) => {
      const idx = getMockCustomers().findIndex(c => c.id === id)
      if (idx >= 0) { Object.assign(getMockCustomers()[idx], data, { updated_at: new Date().toISOString() }); saveToStorage('customers', getMockCustomers()); return Promise.resolve(getMockCustomers()[idx]) }
      return Promise.reject(new Error('Not found'))
    },
    delete: (id) => {
      const idx = getMockCustomers().findIndex(c => c.id === id)
      if (idx >= 0) { getMockCustomers().splice(idx, 1); saveToStorage('customers', getMockCustomers()); return Promise.resolve() }
      return Promise.reject(new Error('Not found'))
    },
  },
  opportunities: {
    list: (params) => {
      let filtered = [...getMockOpportunities()]
      if (params?.search) filtered = filtered.filter(o => o.name.includes(params.search))
      if (params?.status) filtered = filtered.filter(o => o.status === params.status)
      if (params?.customer_id) filtered = filtered.filter(o => o.customer_id === params.customer_id)
      return Promise.resolve(paginate(filtered, params?.page || 1, params?.page_size || 20))
    },
    get: (id) => {
      const o = getMockOpportunities().find(o => o.id === id)
      return o ? Promise.resolve(o) : Promise.reject(new Error('Not found'))
    },
    create: (data) => {
      const customer = getMockCustomers().find(c => c.id === data.customer_id)
      const newOpp = { ...data, id: 'o' + Date.now(), customer_name: customer?.name || '', owner_id: 'u001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      getMockOpportunities().unshift(newOpp)
      saveToStorage('opportunities', getMockOpportunities())
      return Promise.resolve(newOpp)
    },
    update: (id, data) => {
      const idx = getMockOpportunities().findIndex(o => o.id === id)
      if (idx >= 0) { Object.assign(getMockOpportunities()[idx], data, { updated_at: new Date().toISOString() }); saveToStorage('opportunities', getMockOpportunities()); return Promise.resolve(getMockOpportunities()[idx]) }
      return Promise.reject(new Error('Not found'))
    },
    delete: (id) => {
      const idx = getMockOpportunities().findIndex(o => o.id === id)
      if (idx >= 0) { getMockOpportunities().splice(idx, 1); saveToStorage('opportunities', getMockOpportunities()); return Promise.resolve() }
      return Promise.reject(new Error('Not found'))
    },
    stats: () => Promise.resolve(mockDashboardStats),
  },
  factsheets: {
    list: (opportunityId) => {
      const list = getMockFactSheets()
        .filter(fs => fs.opportunity_id === opportunityId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return Promise.resolve(list)
    },
    create: (data) => {
      const newFs = { ...data, id: 'fs' + Date.now(), version: 1, created_by: 'u001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      getMockFactSheets().push(newFs)
      saveToStorage('factSheets', getMockFactSheets())
      return Promise.resolve(newFs)
    },
    registry: () => Promise.resolve(mockFactRegistry),
  },
  accounts: {
    list: (params) => Promise.resolve({ data: mockAccounts, total: mockAccounts.length, page: 1, page_size: 100 }),
    count: () => Promise.resolve({ count: mockAccounts.length }),
    create: (data) => {
      const newAccount = {
        ...data,
        id: 'u' + Date.now(),
        phone_verified: !!data.phone_code,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      mockAccounts.push(newAccount)
      return Promise.resolve(newAccount)
    },
    update: (id, data) => {
      const idx = mockAccounts.findIndex(a => a.id === id)
      if (idx >= 0) { Object.assign(mockAccounts[idx], data, { updated_at: new Date().toISOString() }); return Promise.resolve(mockAccounts[idx]) }
      return Promise.reject(new Error('Not found'))
    },
    delete: (id) => {
      const idx = mockAccounts.findIndex(a => a.id === id)
      if (idx >= 0) { mockAccounts.splice(idx, 1); return Promise.resolve() }
      return Promise.reject(new Error('Not found'))
    },
    resetPassword: (id, data) => Promise.resolve({ message: '密码已重置' }),
    sendPhoneCode: (phone) => Promise.resolve({ message: '验证码已发送', debug_code: '123456' }),
    verifyPhoneCode: (phone, code) => Promise.resolve({ valid: code === '123456' }),
    getSecurityConfig: () => Promise.resolve({ default_username: 'admin', default_password: 'admin123' }),
  },
  cloudPricing: {
    getProviders: () => Promise.resolve(mockCloudPricing.providers),
    getEcsPrices: (region) => Promise.resolve(mockCloudPricing.ecs(region)),
    getK8sPrices: (region) => Promise.resolve(mockCloudPricing.k8s(region)),
    getRdsPrices: (region) => Promise.resolve(mockCloudPricing.rds(region)),
    getOssPrices: (region) => Promise.resolve(mockCloudPricing.oss(region)),
    getNetworkPrices: (region) => Promise.resolve(mockCloudPricing.network(region)),
    calculateCost: (data) => Promise.resolve(mockCloudPricing.calculate(data)),
    getStatus: () => Promise.resolve(mockCloudPricing.status()),
  },
  skills: {
    list: () => Promise.resolve(mockSkills),
    get: (id) => {
      const s = mockSkills.find(s => s.id === id)
      return s ? Promise.resolve(s) : Promise.reject(new Error('Not found'))
    },
    execute: async (data) => {
      const skillName = data.skill_name
      let outputs = {}

      // 如果配置了 LLM，调用真实 LLM 生成
      if (isLLMEnabled()) {
        try {
          const skill = mockSkills.find(s => s.name === skillName)
          const promptText = skill?.prompt_template || ''
          // 替换模板变量
          let filledPrompt = promptText
          if (data.inputs) {
            for (const [k, v] of Object.entries(data.inputs)) {
              filledPrompt = filledPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), typeof v === 'object' ? JSON.stringify(v) : String(v))
            }
          }

          const systemPrompt = '你是安畅云咨询平台的 AI 助手，专注于云迁移、Landing Zone、大数据平台等项目的报价、SOW 和 WBS 生成。请根据用户提供的信息，生成专业、准确的结构化输出。'

          if (skillName === 'Generate-Quotation') {
            outputs = await callLLMStructured(filledPrompt, systemPrompt, 'cost_breakdown 数组(每项含 item,description,days,rate,total) 和 total_days, total_cost')
          } else if (skillName === 'Generate-SOW') {
            outputs = await callLLMStructured(filledPrompt, systemPrompt, 'title, project_overview, scope, scope_items, deliverables, assumptions, risks, timeline, team, acceptance_criteria')
          } else if (skillName === 'Generate-WBS') {
            outputs = await callLLMStructured(filledPrompt, systemPrompt, 'phases 数组(每项含 name,duration,tasks 数组含 name,duration_days,role,dependencies,deliverable,level) 和 total_days')
          } else if (skillName === 'Generate-FactSheet') {
            outputs = await callLLMStructured(filledPrompt, systemPrompt, 'facts 对象 和 recommendations 数组')
          } else {
            // 默认调用 LLM
            const raw = await callLLM([{ role: 'user', content: filledPrompt }])
            outputs = { raw_response: raw }
          }
          return Promise.resolve({ skill_name: data.skill_name, outputs, raw_response: 'Generated by LLM', llm_used: true })
        } catch (err) {
          // LLM 调用失败，回退到 Mock
          console.warn('LLM call failed, falling back to mock:', err.message)
          ElMessage?.warning?.(`LLM 调用失败，已回退到 Mock: ${err.message}`)
        }
      }

      // Mock 模式（原有逻辑）
      if (skillName === 'Generate-FactSheet') {
        outputs = {
          facts: { project_type: 'landing_zone', current_cloud: 'on_premise', target_cloud: 'aliyun', vm_count: 500, database_count: 30, region_count: 3, account_count: 15, vpc_count: 12, security_level: 'advanced' },
          recommendations: ['建议使用多账号架构', '需要设置安全合规基线', '建议采用自动化部署'],
        }
      } else if (skillName === 'Generate-Quotation') {
        outputs = {
          cost_breakdown: [
            { item: '架构设计', description: 'Landing Zone 架构设计与评审', days: 20, rate: 5000, total: 100000 },
            { item: '环境搭建', description: '基础环境搭建与配置', days: 30, rate: 4500, total: 135000 },
            { item: '安全合规', description: '安全策略配置与合规检查', days: 25, rate: 5000, total: 125000 },
            { item: '网络配置', description: 'VPC、子网、路由配置', days: 20, rate: 4500, total: 90000 },
            { item: 'IAM 配置', description: '身份认证与权限管理', days: 15, rate: 4500, total: 67500 },
            { item: '监控运维', description: '监控告警与运维体系', days: 15, rate: 4000, total: 60000 },
            { item: '培训交付', description: '知识转移与培训', days: 10, rate: 4000, total: 40000 },
          ],
          total_cost: 617500,
          total_days: 135,
          currency: 'CNY',
        }
      } else if (skillName === 'Generate-SOW') {
        outputs = {
          title: '中国银行 Landing Zone 项目工作说明书',
          project_overview: '本项目旨在为中国银行构建一套符合金融行业合规要求的云 Landing Zone 基础架构...',
          scope: '项目范围包括：云账号体系设计、网络架构规划、安全合规基线配置、IAM 体系构建、运维监控体系搭建。',
          scope_items: [
            { category: '账号治理', item: '多账号架构设计与实施', included: true },
            { category: '网络', item: 'VPC 网络规划与配置', included: true },
            { category: '安全', item: '安全合规基线配置', included: true },
            { category: '身份', item: 'IAM 体系设计与实施', included: true },
            { category: '运维', item: '监控告警体系搭建', included: true },
            { category: '培训', item: '知识转移与培训', included: true },
          ],
          deliverables: [
            { name: '架构设计文档', description: '包含详细架构图和配置说明', due_week: 2 },
            { name: '环境交付物', description: '可运行的基础环境', due_week: 6 },
            { name: '安全合规报告', description: '合规检查与整改报告', due_week: 8 },
            { name: '运维手册', description: '运维操作手册与应急预案', due_week: 10 },
          ],
          assumptions: ['客户提供必要的云账号权限', '客户配合进行需求确认', '项目期间云平台服务可用'],
          risks: [
            { description: '需求变更导致进度延迟', mitigation: '建立变更控制流程' },
            { description: '云平台服务不稳定', mitigation: '制定应急预案' },
          ],
          timeline: [
            { phase: '设计阶段', duration: '2周', milestones: ['架构设计评审通过'] },
            { phase: '实施阶段', duration: '6周', milestones: ['基础环境交付', '安全合规通过'] },
            { phase: '验收阶段', duration: '2周', milestones: ['用户验收通过'] },
          ],
          team: [
            { role: '架构师', count: 2, responsibility: '整体架构设计与技术决策' },
            { role: '云工程师', count: 3, responsibility: '环境搭建与配置' },
            { role: '安全工程师', count: 1, responsibility: '安全策略配置与合规检查' },
          ],
          acceptance_criteria: ['所有交付物通过客户验收', '系统性能满足设计要求', '安全合规检查通过'],
        }
      } else if (skillName === 'Generate-WBS') {
        outputs = {
          phases: [
            {
              name: '项目启动',
              duration: '1周',
              tasks: [
                { name: '项目启动会', duration_days: 1, role: '项目经理', dependencies: '-', deliverable: '会议纪要', level: 0 },
                { name: '需求确认', duration_days: 3, role: '架构师', dependencies: '项目启动会', deliverable: '需求确认书', level: 0 },
                { name: '环境准备', duration_days: 2, role: '云工程师', dependencies: '需求确认', deliverable: '环境就绪', level: 0 },
              ],
            },
            {
              name: '架构设计',
              duration: '2周',
              tasks: [
                { name: '现状调研', duration_days: 3, role: '架构师', dependencies: '环境准备', deliverable: '现状调研报告', level: 0 },
                { name: '架构设计', duration_days: 5, role: '架构师', dependencies: '现状调研', deliverable: '架构设计文档', level: 0 },
                { name: '架构评审', duration_days: 2, role: '架构师', dependencies: '架构设计', deliverable: '评审纪要', level: 0 },
              ],
            },
            {
              name: '环境实施',
              duration: '4周',
              tasks: [
                { name: '账号体系搭建', duration_days: 5, role: '云工程师', dependencies: '架构评审', deliverable: '账号体系', level: 0 },
                { name: '网络配置', duration_days: 7, role: '云工程师', dependencies: '账号体系搭建', deliverable: '网络配置', level: 0 },
                { name: '安全基线配置', duration_days: 5, role: '安全工程师', dependencies: '网络配置', deliverable: '安全基线', level: 0 },
                { name: 'IAM 配置', duration_days: 3, role: '云工程师', dependencies: '安全基线配置', deliverable: 'IAM 配置', level: 0 },
              ],
            },
            {
              name: '验收交付',
              duration: '1周',
              tasks: [
                { name: '集成测试', duration_days: 3, role: '云工程师', dependencies: 'IAM 配置', deliverable: '测试报告', level: 0 },
                { name: '用户验收', duration_days: 2, role: '项目经理', dependencies: '集成测试', deliverable: '验收报告', level: 0 },
              ],
            },
          ],
          total_days: 38,
          start_date: '2024-07-01',
          end_date: '2024-08-08',
        }
      } else {
        // 默认 Discovery 输出
        outputs = {
          questions: [
            { category: 'Governance', question: '需要多少个云账号？每个业务单元是否需要独立账号？', purpose: '确定治理范围' },
            { category: 'Network', question: '需要多少个 VPC？是否需要跨 Region 互联？', purpose: '规划网络架构' },
            { category: 'Security', question: '需要满足哪些合规标准？(等保2.0/ISO27001/PCI-DSS)', purpose: '定义安全要求' },
            { category: 'Identity', question: '预计有多少用户需要云平台访问权限？', purpose: '规划 IAM 体系' },
            { category: 'Operations', question: '是否有现有的运维监控体系？需要集成哪些工具？', purpose: '规划运维架构' },
          ],
        }
      }
      
      return Promise.resolve({
        skill_name: data.skill_name,
        outputs,
        raw_response: 'Mock AI response',
      })
    },
    // ===== Skill 学习系统接口 =====
    // 保存执行历史
    saveExecution: (data) => {
      const history = loadSkillHistory()
      const record = {
        id: 'exec_' + Date.now(),
        skill_name: data.skill_name,
        inputs: data.inputs || {},
        outputs: data.outputs || {},
        estimated_days: data.estimated_days || 0,
        estimated_cost: data.estimated_cost || 0,
        project_type: data.project_type || 'general',
        opportunity_id: data.opportunity_id || null,
        opportunity_name: data.opportunity_name || '',
        created_at: new Date().toISOString(),
        feedback: null, // null = 未反馈, {actual_days, actual_cost, rating} = 已反馈
      }
      history.push(record)
      saveSkillHistory(history)
      return Promise.resolve(record)
    },
    // 获取执行历史
    getHistory: (params) => {
      let history = loadSkillHistory()
      if (params?.skill_name) history = history.filter(h => h.skill_name === params.skill_name)
      if (params?.opportunity_id) history = history.filter(h => h.opportunity_id === params.opportunity_id)
      // 按时间倒序
      history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const page = params?.page || 1
      const pageSize = params?.page_size || 20
      const start = (page - 1) * pageSize
      return Promise.resolve({ items: history.slice(start, start + pageSize), total: history.length, page, page_size: pageSize })
    },
    // 提交反馈（核心学习入口）
    submitFeedback: (executionId, feedback) => {
      const history = loadSkillHistory()
      const idx = history.findIndex(h => h.id === executionId)
      if (idx < 0) return Promise.reject(new Error('Execution not found'))

      const exec = history[idx]
      exec.feedback = {
        actual_days: feedback.actual_days,
        actual_cost: feedback.actual_cost,
        rating: feedback.rating, // 'accurate' | 'overestimate' | 'underestimate'
        comment: feedback.comment || '',
        created_at: new Date().toISOString(),
      }

      // 触发学习：根据估算 vs 实际调整参数
      if (exec.estimated_days > 0 && feedback.actual_days > 0) {
        const result = applyFeedback(exec.estimated_days, feedback.actual_days, exec.project_type, exec.outputs?.cost_breakdown)
        exec.feedback.accuracy = result.accuracy
        exec.feedback.adjusted_params = result.params
      }

      saveSkillHistory(history)
      return Promise.resolve(exec)
    },
    // 获取学习统计
    getLearningStats: () => {
      const params = loadLearningParams()
      const history = loadSkillHistory()
      const feedbackCount = history.filter(h => h.feedback !== null).length
      const totalCount = history.length

      // 计算平均准确率
      const feedbacks = history.filter(h => h.feedback?.accuracy !== undefined)
      const avgAccuracy = feedbacks.length > 0
        ? Math.round(feedbacks.reduce((s, h) => s + h.feedback.accuracy, 0) / feedbacks.length * 100)
        : 0

      return Promise.resolve({
        total_executions: totalCount,
        feedback_count: feedbackCount,
        avg_accuracy: avgAccuracy,
        learning_level: Math.min(100, Math.floor(feedbackCount / 3)), // 每3次反馈提升1级，最高100
        params,
        accuracy_trend: params.accuracy_trend || [],
        project_type_factors: params.project_type_factors,
        day_factors: params.day_factors,
      })
    },
    // 获取学习后的报价参数（用于 QuotationView）
    getLearnedQuotationParams: (projectType) => {
      const params = loadLearningParams()
      const typeFactor = params.project_type_factors?.[projectType] || 1.0
      return Promise.resolve({
        daily_rate: Math.round(3500 * (params.daily_rate_factor || 1.0)),
        type_factor: typeFactor,
        day_factors: params.day_factors,
        feedback_count: params.feedback_count || 0,
        learning_active: (params.feedback_count || 0) >= 2,
      })
    },
  },
}

const mockAccounts = [
  { id: 'u001', username: 'admin', email: 'admin@aicc.com', full_name: 'System Admin', role: 'admin', phone: '13800138000', phone_verified: true, is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'u002', username: 'zhangsan', email: 'zhangsan@aicc.com', full_name: '张三', role: 'consultant', phone: '13900139001', phone_verified: true, is_active: true, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'u003', username: 'lisi', email: 'lisi@aicc.com', full_name: '李四', role: 'manager', phone: null, phone_verified: false, is_active: true, created_at: '2024-03-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
]

// 默认价格配置，与 SystemSettings.vue 中 defaultCloudPricing 保持一致
const PRICING_CONFIG_VERSION = 2 // 每次更新默认价格时递增此版本号

const defaultCloudPricingConfig = {
  version: PRICING_CONFIG_VERSION,
  mode: 'mock',
  refresh_interval_hours: '4',
  clouds: [
    { id: 'aliyun', name: '阿里云', enabled: true, unitPrices: { ecs: 338, rds: 880, storage: 12.0, network: 23.0 } },
    { id: 'huawei', name: '华为云', enabled: true, unitPrices: { ecs: 320, rds: 850, storage: 11.9, network: 22.5 } },
    { id: 'tencent', name: '腾讯云', enabled: true, unitPrices: { ecs: 318, rds: 820, storage: 11.8, network: 22.0 } },
    { id: 'aws', name: 'AWS', enabled: true, unitPrices: { ecs: 910, rds: 1900, storage: 16.7, network: 65.0 } },
    { id: 'azure', name: 'Azure', enabled: false, unitPrices: { ecs: 980, rds: 1850, storage: 13.4, network: 60.0 } },
    { id: 'baidu', name: '百度云', enabled: false, unitPrices: { ecs: 290, rds: 760, storage: 11.5, network: 21.0 } },
    { id: 'jd', name: '京东云', enabled: false, unitPrices: { ecs: 295, rds: 780, storage: 12.0, network: 21.5 } },
    { id: 'ucloud', name: 'UCloud', enabled: false, unitPrices: { ecs: 310, rds: 820, storage: 12.5, network: 22.0 } },
  ],
}

function loadCloudPricingConfig() {
  try {
    const saved = localStorage.getItem('aicc_cloud_pricing')
    if (!saved) {
      // 首次使用，写入默认配置
      localStorage.setItem('aicc_cloud_pricing', JSON.stringify(defaultCloudPricingConfig))
      return defaultCloudPricingConfig
    }
    const parsed = JSON.parse(saved)
    // 版本号低于当前版本时强制覆盖为新默认配置（仅升级默认值，不丢弃用户数据）
    if (!parsed.version || parsed.version < PRICING_CONFIG_VERSION) {
      const merged = { ...defaultCloudPricingConfig, ...parsed, version: PRICING_CONFIG_VERSION }
      // 保留用户已设置的 clouds 单价
      if (parsed.clouds) {
        merged.clouds = defaultCloudPricingConfig.clouds.map(dc => {
          const found = parsed.clouds.find(c => c.id === dc.id)
          return found ? { ...dc, ...found, unitPrices: { ...dc.unitPrices, ...(found.unitPrices || {}) } } : dc
        })
      }
      localStorage.setItem('aicc_cloud_pricing', JSON.stringify(merged))
      return merged
    }
    // 版本匹配，直接使用用户保存的配置
    const clouds = defaultCloudPricingConfig.clouds.map(dc => {
      const found = (parsed.clouds || []).find(c => c.id === dc.id)
      return found ? { ...dc, ...found, unitPrices: { ...dc.unitPrices, ...(found.unitPrices || {}) } } : dc
    })
    return { ...defaultCloudPricingConfig, ...parsed, clouds }
  } catch {
    return defaultCloudPricingConfig
  }
}

function getEnabledClouds() {
  return loadCloudPricingConfig().clouds.filter(c => c.enabled)
}

function buildPrices(unitPriceMap, multiplier) {
  const prices = {}
  // 为所有已配置单价的云厂商生成价格，方便前端随时勾选对比
  defaultCloudPricingConfig.clouds.forEach(c => {
    prices[c.id] = { monthly: Math.round(unitPriceMap[c.id] * multiplier * 100) / 100 }
  })
  return prices
}

const mockCloudPricing = {
  providers: [
    { id: 'aliyun', name: '阿里云', tier: 'tier1', domestic: true },
    { id: 'huawei', name: '华为云', tier: 'tier1', domestic: true },
    { id: 'tencent', name: '腾讯云', tier: 'tier1', domestic: true },
    { id: 'aws', name: 'AWS', tier: 'tier1', domestic: false },
    { id: 'azure', name: 'Azure', tier: 'tier1', domestic: false },
    { id: 'baidu', name: '百度云', tier: 'tier2', domestic: true },
    { id: 'jd', name: '京东云', tier: 'tier2', domestic: true },
    { id: 'ucloud', name: 'UCloud', tier: 'tier3', domestic: true },
  ],
  ecs: (region) => {
    const cfg = loadCloudPricingConfig()
    const ecsPrices = {}
    cfg.clouds.forEach(c => { if (c.enabled) ecsPrices[c.id] = c.unitPrices.ecs })
    return {
      data: [
        { spec: '2C4G 通用型', prices: buildPrices(ecsPrices, 0.5) },
        { spec: '4C8G 通用型', prices: buildPrices(ecsPrices, 1) },
        { spec: '8C16G 通用型', prices: buildPrices(ecsPrices, 2) },
      ],
      source: cfg.mode === 'api' ? 'api' : 'mock',
      cached_at: new Date().toISOString(),
      ttl_hours: Number(cfg.refresh_interval_hours) || 4,
    }
  },
  k8s: (region) => {
    const cfg = loadCloudPricingConfig()
    const ecsPrices = {}
    cfg.clouds.forEach(c => { if (c.enabled) ecsPrices[c.id] = c.unitPrices.ecs })
    return {
      data: [
        { spec: '托管集群 2 节点', prices: buildPrices(ecsPrices, 2.5) },
        { spec: '托管集群 4 节点', prices: buildPrices(ecsPrices, 5) },
        { spec: '托管集群 8 节点', prices: buildPrices(ecsPrices, 10) },
      ],
      source: cfg.mode === 'api' ? 'api' : 'mock',
      cached_at: new Date().toISOString(),
      ttl_hours: Number(cfg.refresh_interval_hours) || 4,
    }
  },
  rds: (region) => {
    const cfg = loadCloudPricingConfig()
    const rdsPrices = {}
    cfg.clouds.forEach(c => { if (c.enabled) rdsPrices[c.id] = c.unitPrices.rds })
    return {
      data: [
        { spec: 'MySQL 2C4G', prices: buildPrices(rdsPrices, 0.5) },
        { spec: 'MySQL 4C8G', prices: buildPrices(rdsPrices, 1) },
      ],
      source: cfg.mode === 'api' ? 'api' : 'mock',
      cached_at: new Date().toISOString(),
      ttl_hours: Number(cfg.refresh_interval_hours) || 4,
    }
  },
  oss: (region) => {
    const cfg = loadCloudPricingConfig()
    const storagePrices = {}
    cfg.clouds.forEach(c => { if (c.enabled) storagePrices[c.id] = c.unitPrices.storage })
    return {
      data: [
        { spec: '标准存储 100GB', prices: buildPrices(storagePrices, 1) },
      ],
      source: cfg.mode === 'api' ? 'api' : 'mock',
      cached_at: new Date().toISOString(),
      ttl_hours: Number(cfg.refresh_interval_hours) || 4,
    }
  },
  network: (region) => {
    const cfg = loadCloudPricingConfig()
    const networkPrices = {}
    cfg.clouds.forEach(c => { if (c.enabled) networkPrices[c.id] = c.unitPrices.network })
    return {
      data: [
        { spec: '公网带宽 10Mbps', prices: buildPrices(networkPrices, 10) },
      ],
      source: cfg.mode === 'api' ? 'api' : 'mock',
      cached_at: new Date().toISOString(),
      ttl_hours: Number(cfg.refresh_interval_hours) || 4,
    }
  },
  calculate: (data) => {
    const ecsCount = Number(data.ecs_count) || 0
    const rdsCount = Number(data.rds_count) || 0
    const storageTB = Number(data.storage_tb) || 0
    const bandwidth = Number(data.bandwidth) || 0

    const cfg = loadCloudPricingConfig()
    const enabledClouds = cfg.clouds.filter(c => c.enabled)

    // 支持按 selectedClouds 过滤，未传则默认全部启用云
    const requestedIds = data.clouds ? data.clouds.split(',').filter(Boolean) : enabledClouds.map(c => c.id)
    const cloudMap = {}
    enabledClouds.forEach(c => { cloudMap[c.id] = c })

    const cloudNameMap = { aliyun: '阿里云', huawei: '华为云', tencent: '腾讯云', aws: 'AWS', azure: 'Azure', baidu: '百度云', jd: '京东云', ucloud: 'UCloud' }

    const results = requestedIds.map(id => {
      const c = cloudMap[id]
      if (!c) return null
      const p = c.unitPrices
      const ecsCost = Math.round(ecsCount * p.ecs * 100) / 100
      const rdsCost = Math.round(rdsCount * p.rds * 100) / 100
      const storageCost = Math.round(storageTB * 10 * p.storage * 100) / 100
      const networkCost = Math.round(bandwidth * p.network * 100) / 100
      const monthly = Math.round((ecsCost + rdsCost + storageCost + networkCost) * 100) / 100
      return {
        cloud: cloudNameMap[id],
        monthly,
        annual: monthly * 12,
        cheapest: false,
        breakdown: {
          ecs: { count: ecsCount, unit: p.ecs, total: ecsCost },
          rds: { count: rdsCount, unit: p.rds, total: rdsCost },
          storage: { count: storageTB, unit: p.storage, total: storageCost },
          network: { count: bandwidth, unit: p.network, total: networkCost },
        }
      }
    }).filter(Boolean)

    // 标记最低价的云
    if (results.length > 0) {
      const minMonthly = Math.min(...results.map(r => r.monthly))
      results.forEach(r => { if (r.monthly === minMonthly) r.cheapest = true })
    }

    return results
  },
  status: () => {
    const cfg = loadCloudPricingConfig()
    return {
      status: 'ok',
      mode: cfg.mode,
      enabled_clouds: cfg.clouds.filter(c => c.enabled).map(c => c.id),
      message: cfg.mode === 'api' ? 'API pricing mode configured' : 'Mock pricing service is active',
    }
  },
}

export function isDevMode() {
  // 开发模式用 Mock，生产构建用真实 API
  return import.meta.env.DEV
}
