const DEV_MODE = import.meta.env.DEV

const mockCustomers = [
  { id: 'c001', name: '中国银行', industry: '金融', contact_name: '张经理', contact_email: 'zhang@boc.com', contact_phone: '13800138001', address: '北京市西城区', description: '国有大型商业银行', owner_id: 'u001', is_active: true, created_at: '2024-01-15T10:00:00Z', updated_at: '2024-03-20T14:30:00Z' },
  { id: 'c002', name: '宝钢集团', industry: '制造', contact_name: '李总', contact_email: 'li@baosteel.com', contact_phone: '13900139002', address: '上海市宝山区', description: '大型钢铁制造企业', owner_id: 'u001', is_active: true, created_at: '2024-02-10T09:00:00Z', updated_at: '2024-04-15T16:00:00Z' },
  { id: 'c003', name: '永辉超市', industry: '零售', contact_name: '王总监', contact_email: 'wang@yonghui.com', contact_phone: '13700137003', address: '福州市台江区', description: '连锁零售企业', owner_id: 'u001', is_active: true, created_at: '2024-03-05T11:00:00Z', updated_at: '2024-05-10T09:30:00Z' },
  { id: 'c004', name: '字节跳动', industry: '互联网', contact_name: '赵架构师', contact_email: 'zhao@bytedance.com', contact_phone: '13600136004', address: '北京市海淀区', description: '互联网科技公司', owner_id: 'u001', is_active: true, created_at: '2024-03-20T08:30:00Z', updated_at: '2024-06-01T10:00:00Z' },
  { id: 'c005', name: '深圳市政府', industry: '政府', contact_name: '陈处长', contact_email: 'chen@sz.gov.cn', contact_phone: '13500135005', address: '深圳市福田区', description: '政务云项目', owner_id: 'u001', is_active: true, created_at: '2024-04-01T14:00:00Z', updated_at: '2024-06-15T11:30:00Z' },
  { id: 'c006', name: '浙江大学', industry: '教育', contact_name: '刘教授', contact_email: 'liu@zju.edu.cn', contact_phone: '13400134006', address: '杭州市西湖区', description: '高校科研云平台', owner_id: 'u001', is_active: false, created_at: '2024-01-20T10:00:00Z', updated_at: '2024-02-28T15:00:00Z' },
]

const mockOpportunities = [
  { id: 'o001', name: '中国银行 Landing Zone 项目', customer_id: 'c001', customer_name: '中国银行', type: 'landing_zone', status: 'proposal', estimated_revenue: 2800000, probability: 70, description: '为国有银行构建多云 Landing Zone 架构', owner_id: 'u001', created_at: '2024-02-01T10:00:00Z', updated_at: '2024-05-15T14:00:00Z' },
  { id: 'o002', name: '宝钢集团云迁移项目', customer_id: 'c002', customer_name: '宝钢集团', type: 'migration', status: 'negotiation', estimated_revenue: 3500000, probability: 60, description: '核心业务系统从本地机房迁移至华为云', owner_id: 'u001', created_at: '2024-03-10T09:00:00Z', updated_at: '2024-06-01T16:00:00Z' },
  { id: 'o003', name: '永辉超市大数据平台', customer_id: 'c003', customer_name: '永辉超市', type: 'big_data', status: 'discovery', estimated_revenue: 1500000, probability: 40, description: '构建零售大数据分析平台', owner_id: 'u001', created_at: '2024-04-15T11:00:00Z', updated_at: '2024-05-20T09:30:00Z' },
  { id: 'o004', name: '字节跳动混合云架构', customer_id: 'c004', customer_name: '字节跳动', type: 'hybrid_cloud', status: 'discovery', estimated_revenue: 5000000, probability: 30, description: '混合云架构设计与实施', owner_id: 'u001', created_at: '2024-05-01T08:30:00Z', updated_at: '2024-06-10T10:00:00Z' },
  { id: 'o005', name: '深圳市政务云安全加固', customer_id: 'c005', customer_name: '深圳市政府', type: 'security', estimated_revenue: 1800000, probability: 80, status: 'proposal', description: '政务云安全合规加固项目', owner_id: 'u001', created_at: '2024-04-20T14:00:00Z', updated_at: '2024-06-05T11:30:00Z' },
  { id: 'o006', name: '中国银行成本优化', customer_id: 'c001', customer_name: '中国银行', type: 'cost_optimization', status: 'closed_won', estimated_revenue: 800000, probability: 100, description: '云资源成本优化咨询', owner_id: 'u001', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-03-30T15:00:00Z' },
  { id: 'o007', name: '浙江大学云迁移评估', customer_id: 'c006', customer_name: '浙江大学', type: 'migration', status: 'closed_lost', estimated_revenue: 600000, probability: 0, description: '科研系统云迁移评估', owner_id: 'u001', created_at: '2024-01-25T10:00:00Z', updated_at: '2024-02-28T15:00:00Z' },
]

const mockFactSheets = [
  { id: 'fs001', opportunity_id: 'o001', category: 'general', version: 2, created_by: 'u001', created_at: '2024-05-10T10:00:00Z', updated_at: '2024-05-15T14:00:00Z', facts: { project_type: 'landing_zone', current_cloud: 'on_premise', target_cloud: 'aliyun', vm_count: 500, database_count: 30, region_count: 3, account_count: 15, vpc_count: 12, security_level: 'advanced' } },
  { id: 'fs002', opportunity_id: 'o002', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-10T09:00:00Z', updated_at: '2024-04-10T09:00:00Z', facts: { project_type: 'migration', current_cloud: 'on_premise', target_cloud: 'huawei', vm_count: 800, database_count: 45, region_count: 2, account_count: 8, vpc_count: 6, security_level: 'advanced' } },
  { id: 'fs003', opportunity_id: 'o003', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-20T11:00:00Z', updated_at: '2024-04-20T11:00:00Z', facts: { project_type: 'big_data', current_cloud: 'on_premise', target_cloud: 'aliyun', vm_count: 200, database_count: 10, region_count: 2, account_count: 5, vpc_count: 4, security_level: 'medium' } },
  { id: 'fs004', opportunity_id: 'o004', category: 'general', version: 1, created_by: 'u001', created_at: '2024-05-05T08:30:00Z', updated_at: '2024-05-05T08:30:00Z', facts: { project_type: 'hybrid_cloud', current_cloud: 'aws', target_cloud: 'aliyun', vm_count: 1200, database_count: 60, region_count: 4, account_count: 20, vpc_count: 18, security_level: 'advanced' } },
  { id: 'fs005', opportunity_id: 'o005', category: 'general', version: 1, created_by: 'u001', created_at: '2024-04-25T14:00:00Z', updated_at: '2024-04-25T14:00:00Z', facts: { project_type: 'security', current_cloud: 'aliyun', target_cloud: 'huawei', vm_count: 300, database_count: 15, region_count: 2, account_count: 10, vpc_count: 8, security_level: 'advanced' } },
  { id: 'fs006', opportunity_id: 'o006', category: 'general', version: 1, created_by: 'u001', created_at: '2024-01-25T10:00:00Z', updated_at: '2024-01-25T10:00:00Z', facts: { project_type: 'migration', current_cloud: 'on_premise', target_cloud: 'tencent', vm_count: 150, database_count: 8, region_count: 1, account_count: 3, vpc_count: 2, security_level: 'medium' } },
]

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
      let filtered = [...mockCustomers]
      if (params?.search) filtered = filtered.filter(c => c.name.includes(params.search))
      if (params?.is_active !== undefined) filtered = filtered.filter(c => c.is_active === params.is_active)
      return Promise.resolve(paginate(filtered, params?.page || 1, params?.page_size || 20))
    },
    get: (id) => {
      const c = mockCustomers.find(c => c.id === id)
      return c ? Promise.resolve(c) : Promise.reject(new Error('Not found'))
    },
    create: (data) => {
      const newCustomer = { ...data, id: 'c' + Date.now(), owner_id: 'u001', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      mockCustomers.push(newCustomer)
      return Promise.resolve(newCustomer)
    },
    update: (id, data) => {
      const idx = mockCustomers.findIndex(c => c.id === id)
      if (idx >= 0) { Object.assign(mockCustomers[idx], data, { updated_at: new Date().toISOString() }); return Promise.resolve(mockCustomers[idx]) }
      return Promise.reject(new Error('Not found'))
    },
    delete: (id) => {
      const idx = mockCustomers.findIndex(c => c.id === id)
      if (idx >= 0) { mockCustomers.splice(idx, 1); return Promise.resolve() }
      return Promise.reject(new Error('Not found'))
    },
  },
  opportunities: {
    list: (params) => {
      let filtered = [...mockOpportunities]
      if (params?.search) filtered = filtered.filter(o => o.name.includes(params.search))
      if (params?.status) filtered = filtered.filter(o => o.status === params.status)
      if (params?.customer_id) filtered = filtered.filter(o => o.customer_id === params.customer_id)
      return Promise.resolve(paginate(filtered, params?.page || 1, params?.page_size || 20))
    },
    get: (id) => {
      const o = mockOpportunities.find(o => o.id === id)
      return o ? Promise.resolve(o) : Promise.reject(new Error('Not found'))
    },
    create: (data) => {
      const customer = mockCustomers.find(c => c.id === data.customer_id)
      const newOpp = { ...data, id: 'o' + Date.now(), customer_name: customer?.name || '', owner_id: 'u001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      mockOpportunities.unshift(newOpp)
      return Promise.resolve(newOpp)
    },
    update: (id, data) => {
      const idx = mockOpportunities.findIndex(o => o.id === id)
      if (idx >= 0) { Object.assign(mockOpportunities[idx], data, { updated_at: new Date().toISOString() }); return Promise.resolve(mockOpportunities[idx]) }
      return Promise.reject(new Error('Not found'))
    },
    delete: (id) => {
      const idx = mockOpportunities.findIndex(o => o.id === id)
      if (idx >= 0) { mockOpportunities.splice(idx, 1); return Promise.resolve() }
      return Promise.reject(new Error('Not found'))
    },
    stats: () => Promise.resolve(mockDashboardStats),
  },
  factsheets: {
    list: (opportunityId) => {
      return Promise.resolve(mockFactSheets.filter(fs => fs.opportunity_id === opportunityId))
    },
    create: (data) => {
      const newFs = { ...data, id: 'fs' + Date.now(), version: 1, created_by: 'u001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      mockFactSheets.push(newFs)
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
    getK8sPrices: (region) => Promise.resolve({ data: [], source: 'mock', cached_at: new Date().toISOString(), ttl_hours: 4 }),
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
    execute: (data) => {
      const skillName = data.skill_name
      let outputs = {}
      
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
  },
}

const mockAccounts = [
  { id: 'u001', username: 'admin', email: 'admin@aicc.com', full_name: 'System Admin', role: 'admin', phone: '13800138000', phone_verified: true, is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'u002', username: 'zhangsan', email: 'zhangsan@aicc.com', full_name: '张三', role: 'consultant', phone: '13900139001', phone_verified: true, is_active: true, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'u003', username: 'lisi', email: 'lisi@aicc.com', full_name: '李四', role: 'manager', phone: null, phone_verified: false, is_active: true, created_at: '2024-03-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
]

const mockCloudPricing = {
  providers: [
    { id: 'aliyun', name: '阿里云', tier: 'tier1', domestic: true },
    { id: 'huawei', name: '华为云', tier: 'tier1', domestic: true },
    { id: 'tencent', name: '腾讯云', tier: 'tier1', domestic: true },
    { id: 'aws', name: 'AWS', tier: 'tier1', domestic: false },
  ],
  ecs: (region) => ({
    data: [
      { spec: '2C4G 通用型', prices: { aliyun: { monthly: 168 }, huawei: { monthly: 165 }, tencent: { monthly: 159 }, aws: { monthly: 198 } } },
      { spec: '4C8G 通用型', prices: { aliyun: { monthly: 336 }, huawei: { monthly: 330 }, tencent: { monthly: 318 }, aws: { monthly: 396 } } },
      { spec: '8C16G 通用型', prices: { aliyun: { monthly: 672 }, huawei: { monthly: 660 }, tencent: { monthly: 636 }, aws: { monthly: 792 } } },
    ],
    source: 'mock',
    cached_at: new Date().toISOString(),
    ttl_hours: 4,
  }),
  rds: (region) => ({
    data: [
      { spec: 'MySQL 2C4G', prices: { aliyun: { monthly: 420 }, huawei: { monthly: 410 }, tencent: { monthly: 398 }, aws: { monthly: 520 } } },
      { spec: 'MySQL 4C8G', prices: { aliyun: { monthly: 840 }, huawei: { monthly: 820 }, tencent: { monthly: 796 }, aws: { monthly: 1040 } } },
    ],
    source: 'mock',
    cached_at: new Date().toISOString(),
    ttl_hours: 4,
  }),
  oss: (region) => ({
    data: [
      { spec: '标准存储 100GB', prices: { aliyun: { monthly: 12 }, huawei: { monthly: 11.9 }, tencent: { monthly: 11.8 }, aws: { monthly: 15 } } },
    ],
    source: 'mock',
    cached_at: new Date().toISOString(),
    ttl_hours: 4,
  }),
  network: (region) => ({
    data: [
      { spec: '公网带宽 10Mbps', prices: { aliyun: { monthly: 230 }, huawei: { monthly: 225 }, tencent: { monthly: 220 }, aws: { monthly: 280 } } },
    ],
    source: 'mock',
    cached_at: new Date().toISOString(),
    ttl_hours: 4,
  }),
  calculate: (data) => [
    { cloud: '阿里云', monthly: 16800, annual: 201600, cheapest: true },
    { cloud: '华为云', monthly: 16500, annual: 198000, cheapest: false },
    { cloud: '腾讯云', monthly: 15900, annual: 190800, cheapest: false },
    { cloud: 'AWS', monthly: 19800, annual: 237600, cheapest: false },
  ],
  status: () => ({ status: 'ok', message: 'Mock pricing service is active' }),
}

export function isDevMode() {
  return DEV_MODE
}
