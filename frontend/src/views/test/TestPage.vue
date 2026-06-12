<template>
  <div class="test-page">
    <el-card shadow="never">
      <div class="page-header">
        <h2>🧪 平台测试页面</h2>
        <el-tag type="info">Mock 模式</el-tag>
      </div>
    </el-card>

    <el-tabs v-model="activeTab" type="border-card" style="margin-top: 16px">

      <el-tab-pane label="SOW 模板测试" name="sow">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-card shadow="never" class="filter-card">
              <template #header>产品线筛选</template>
              <el-radio-group v-model="sowFilter" @change="filterSowTemplates">
                <el-radio-button label="">全部</el-radio-button>
                <el-radio-button v-for="(label, key) in categoryMap" :key="key" :label="key">{{ label }}</el-radio-button>
              </el-radio-group>
            </el-card>
          </el-col>
          <el-col :span="18">
            <el-table :data="filteredSowTemplates" stripe size="small" row-key="id">
              <el-table-column type="expand">
                <template #default="{ row }">
                  <div class="expand-content">
                    <el-descriptions :column="2" border size="small" style="margin-bottom: 12px">
                      <el-descriptions-item label="文件">{{ row.file_name }}</el-descriptions-item>
                      <el-descriptions-item label="版本">v{{ row.version }}</el-descriptions-item>
                      <el-descriptions-item label="描述" :span="2">{{ row.description }}</el-descriptions-item>
                    </el-descriptions>
                    <div v-if="row.pricing?.length">
                      <h4>服务包定价</h4>
                      <el-table :data="row.pricing" size="small" border>
                        <el-table-column v-for="col in row.pricingColumns" :key="col.prop" :prop="col.prop" :label="col.label" :min-width="col.minWidth || 80" />
                      </el-table>
                    </div>
                    <div v-if="row.deliverables?.length" style="margin-top: 12px">
                      <h4>交付物清单 ({{ row.deliverables.length }})</h4>
                      <el-table :data="row.deliverables" size="small" border>
                        <el-table-column prop="id" label="编号" width="70" />
                        <el-table-column prop="name" label="交付物" min-width="200" />
                        <el-table-column prop="phase" label="阶段" width="100" />
                        <el-table-column prop="format" label="格式" width="80" />
                      </el-table>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="模板名称" min-width="280" />
              <el-table-column prop="category" label="产品线" width="140">
                <template #default="{ row }">
                  <el-tag size="small" :color="categoryColors[row.category]" effect="dark" style="border: none">{{ categoryMap[row.category] || row.category }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="服务包" width="300">
                <template #default="{ row }">
                  <el-tag v-for="pkg in (row.packages || []).slice(0, 2)" :key="pkg" size="small" type="warning" style="margin: 1px">{{ pkg }}</el-tag>
                  <el-tag v-if="(row.packages || []).length > 2" size="small" type="info" style="margin: 1px">+{{ row.packages.length - 2 }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="定价" width="80" align="center">
                <template #default="{ row }">
                  <el-icon v-if="row.pricing?.length" color="#67C23A"><Check /></el-icon>
                  <el-icon v-else color="#909399"><Close /></el-icon>
                </template>
              </el-table-column>
              <el-table-column label="交付物" width="80" align="center">
                <template #default="{ row }">
                  <el-badge :value="row.deliverables?.length || 0" :type="row.deliverables?.length ? 'success' : 'info'" />
                </template>
              </el-table-column>
            </el-table>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="Skill 执行测试" name="skill">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-card shadow="never">
              <template #header>选择 Skill</template>
              <div v-for="skill in skills" :key="skill.id" class="skill-item" :class="{ active: selectedSkill?.id === skill.id }" @click="selectSkill(skill)">
                <el-icon :size="20" color="#409EFF"><MagicStick /></el-icon>
                <div class="skill-info">
                  <div class="skill-name">{{ skill.name }}</div>
                  <div class="skill-desc">{{ skill.description }}</div>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="16">
            <el-card shadow="never" v-if="selectedSkill">
              <template #header>
                <span>{{ selectedSkill.name }} - 执行测试</span>
                <el-tag size="small" style="margin-left: 8px">{{ selectedSkill.category }}</el-tag>
              </template>

              <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
                <el-descriptions-item label="版本">v{{ selectedSkill.version }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="selectedSkill.status === 'active' ? 'success' : 'info'" size="small">{{ selectedSkill.status === 'active' ? '启用' : '停用' }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="描述" :span="2">{{ selectedSkill.description }}</el-descriptions-item>
              </el-descriptions>

              <el-divider content-position="left">Prompt Template</el-divider>
              <pre class="prompt-preview">{{ selectedSkill.prompt_template }}</pre>

              <el-divider content-position="left">输入参数</el-divider>
              <el-form label-width="100px" size="small">
                <el-form-item v-for="(type, key) in selectedSkill.input_schema" :key="key" :label="key">
                  <el-select v-if="key === 'project_type'" v-model="skillInputs[key]">
                    <el-option label="Landing Zone" value="landing_zone" />
                    <el-option label="Migration" value="migration" />
                    <el-option label="Big Data" value="big_data" />
                    <el-option label="Hybrid Cloud" value="hybrid_cloud" />
                    <el-option label="Security" value="security" />
                  </el-select>
                  <el-select v-else-if="key === 'current_cloud' || key === 'target_cloud'" v-model="skillInputs[key]">
                    <el-option label="本地机房" value="on_premise" />
                    <el-option label="AWS" value="aws" />
                    <el-option label="Azure" value="azure" />
                    <el-option label="阿里云" value="aliyun" />
                    <el-option label="华为云" value="huawei" />
                    <el-option label="腾讯云" value="tencent" />
                  </el-select>
                  <el-select v-else-if="key === 'security_level'" v-model="skillInputs[key]">
                    <el-option label="基础" value="basic" />
                    <el-option label="中等" value="medium" />
                    <el-option label="高级" value="advanced" />
                  </el-select>
                  <el-input-number v-else-if="type === 'integer'" v-model="skillInputs[key]" :min="0" />
                  <el-input v-else v-model="skillInputs[key]" />
                </el-form-item>
              </el-form>

              <el-button type="primary" :loading="executing" @click="executeSkill" style="margin-top: 12px">
                <el-icon><VideoPlay /></el-icon> 执行 Skill
              </el-button>

              <div v-if="executeResult" style="margin-top: 16px">
                <el-divider content-position="left">执行结果</el-divider>
                <el-alert :title="'执行成功 - ' + selectedSkill.name" type="success" :closable="false" style="margin-bottom: 12px" />
                <pre class="result-preview">{{ JSON.stringify(executeResult, null, 2) }}</pre>
              </div>
            </el-card>
            <el-empty v-else description="请先选择一个 Skill" />
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="Mock 数据测试" name="mock">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <span>客户数据 ({{ mockCustomers.length }})</span>
                <el-button type="primary" link size="small" @click="refreshMockData('customers')">刷新</el-button>
              </template>
              <el-table :data="mockCustomers" size="small" stripe max-height="300">
                <el-table-column prop="name" label="客户" min-width="120" />
                <el-table-column prop="industry" label="行业" width="80" />
                <el-table-column prop="contact_name" label="联系人" width="100" />
              </el-table>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <span>商机数据 ({{ mockOpportunities.length }})</span>
                <el-button type="primary" link size="small" @click="refreshMockData('opportunities')">刷新</el-button>
              </template>
              <el-table :data="mockOpportunities" size="small" stripe max-height="300">
                <el-table-column prop="name" label="商机" min-width="200" />
                <el-table-column prop="type" label="类型" width="100">
                  <template #default="{ row }">
                    <el-tag size="small">{{ typeLabels[row.type] || row.type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="80" />
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="16" style="margin-top: 16px">
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>Fact Sheet 数据 ({{ mockFactSheets.length }})</template>
              <el-table :data="mockFactSheets" size="small" stripe max-height="300">
                <el-table-column prop="opportunity_id" label="商机ID" width="100" />
                <el-table-column label="项目类型" width="100">
                  <template #default="{ row }">{{ typeLabels[row.facts?.project_type] || '-' }}</template>
                </el-table-column>
                <el-table-column label="目标云" width="80">
                  <template #default="{ row }">{{ cloudLabels[row.facts?.target_cloud] || '-' }}</template>
                </el-table-column>
                <el-table-column label="VM数" width="70">
                  <template #default="{ row }">{{ row.facts?.vm_count || 0 }}</template>
                </el-table-column>
                <el-table-column label="DB数" width="70">
                  <template #default="{ row }">{{ row.facts?.database_count || 0 }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>API 调用测试</template>
              <div class="api-test-list">
                <div v-for="api in apiTests" :key="api.name" class="api-test-item">
                  <span class="api-name">{{ api.name }}</span>
                  <el-button size="small" :type="api.loading ? 'info' : 'primary'" :loading="api.loading" @click="testApi(api)">
                    测试
                  </el-button>
                  <el-tag v-if="api.result" :type="api.success ? 'success' : 'danger'" size="small">
                    {{ api.success ? '✓ 成功' : '✗ 失败' }}
                  </el-tag>
                  <span v-if="api.duration" class="api-duration">{{ api.duration }}ms</span>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="SOW 生成模拟" name="generate">
        <el-card shadow="never">
          <template #header>SOW 文档生成模拟</template>
          <el-form :model="sowGenForm" label-width="120px" size="small">
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="客户名称">
                  <el-input v-model="sowGenForm.customerName" placeholder="如：中国银行" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="项目类型">
                  <el-select v-model="sowGenForm.projectType" style="width: 100%">
                    <el-option label="Landing Zone" value="landing_zone" />
                    <el-option label="Migration" value="migration" />
                    <el-option label="Big Data" value="big_data" />
                    <el-option label="Well-Architected" value="well_architected" />
                    <el-option label="IaC" value="iac" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="目标云平台">
                  <el-select v-model="sowGenForm.targetCloud" style="width: 100%">
                    <el-option label="AWS" value="aws" />
                    <el-option label="Azure" value="azure" />
                    <el-option label="阿里云" value="aliyun" />
                    <el-option label="华为云" value="huawei" />
                    <el-option label="腾讯云" value="tencent" />
                    <el-option label="火山引擎" value="volcengine" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="6">
                <el-form-item label="服务包">
                  <el-select v-model="sowGenForm.packageType" style="width: 100%">
                    <el-option v-for="pkg in currentPackages" :key="pkg.value" :label="pkg.label" :value="pkg.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="VM 数量">
                  <el-input-number v-model="sowGenForm.vmCount" :min="0" :step="10" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="数据库数量">
                  <el-input-number v-model="sowGenForm.dbCount" :min="0" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="账号数量">
                  <el-input-number v-model="sowGenForm.accountCount" :min="1" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item>
              <el-button type="primary" :loading="generating" @click="simulateGenerateSOW">
                <el-icon><MagicStick /></el-icon> 模拟生成 SOW
              </el-button>
              <el-button @click="resetSowGenForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px" v-if="generatedSow">
          <template #header>
            <span>生成结果预览</span>
            <div style="float: right">
              <el-button size="small" type="primary" @click="copySowResult">
                <el-icon><CopyDocument /></el-icon> 复制
              </el-button>
            </div>
          </template>
          <div class="generated-sow" v-html="generatedSow"></div>
        </el-card>
      </el-tab-pane>

    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { customerApi, opportunityApi, factsheetApi, skillApi, dashboardApi } from '@/api'
import { ElMessage } from 'element-plus'

const activeTab = ref('sow')
const sowFilter = ref('')
const executing = ref(false)
const generating = ref(false)
const executeResult = ref(null)
const selectedSkill = ref(null)
const skillInputs = reactive({})
const generatedSow = ref(null)

const categoryMap = {
  landing_zone: 'Landing Zone',
  well_architected: 'Well-Architected',
  big_data: 'Big Data',
  migration: 'Migration',
  iac: 'IaC',
  pricing: '定价目录',
  general: '通用',
}

const categoryColors = {
  landing_zone: '#409EFF',
  well_architected: '#67C23A',
  big_data: '#E6A23C',
  migration: '#F56C6C',
  iac: '#909399',
  pricing: '#9B59B6',
  general: '#C0C4CC',
}

const typeLabels = {
  landing_zone: 'LZ', migration: '迁移', big_data: '大数据',
  hybrid_cloud: '混合云', security: '安全', cost_optimization: '成本优化',
  well_architected: 'WA', iac: 'IaC',
}

const cloudLabels = {
  aws: 'AWS', azure: 'Azure', aliyun: '阿里云', huawei: '华为云',
  tencent: '腾讯云', on_premise: '本地', volcengine: '火山引擎',
}

const sowTemplates = ref([])
const skills = ref([])
const mockCustomers = ref([])
const mockOpportunities = ref([])
const mockFactSheets = ref([])

const filteredSowTemplates = computed(() => {
  if (!sowFilter.value) return sowTemplates.value
  return sowTemplates.value.filter(t => t.category === sowFilter.value)
})

const sowGenForm = reactive({
  customerName: '中国银行',
  projectType: 'landing_zone',
  targetCloud: 'aliyun',
  packageType: 'standard',
  vmCount: 500,
  dbCount: 30,
  accountCount: 15,
})

const currentPackages = computed(() => {
  const pkgMap = {
    landing_zone: [
      { label: '轻量版 (咨询 ¥80K)', value: 'light' },
      { label: '基础版 (咨询 ¥180K)', value: 'basic' },
      { label: '标准版 (咨询 ¥350K)', value: 'standard' },
      { label: 'S基础包 (咨询+实施 ¥150K)', value: 's_impl' },
      { label: 'M标准包 (咨询+实施 ¥380K)', value: 'm_impl' },
      { label: 'L增强包 (咨询+实施 ¥680K)', value: 'l_impl' },
    ],
    migration: [
      { label: 'S评估包 (咨询 ¥120K)', value: 's_eval' },
      { label: 'M规划包 (咨询 ¥280K)', value: 'm_plan' },
      { label: 'S迁移包 (咨询+实施 ¥380K)', value: 's_mig' },
      { label: 'M迁移包 (咨询+实施 ¥680K)', value: 'm_mig' },
      { label: 'L迁移包 (咨询+实施 ¥1.2M)', value: 'l_mig' },
    ],
    big_data: [
      { label: 'S咨询包 (¥200K)', value: 's_consult' },
      { label: 'M咨询包 (¥380K)', value: 'm_consult' },
      { label: 'S实施包 (¥500K)', value: 's_impl' },
      { label: 'M实施包 (¥800K)', value: 'm_impl' },
      { label: 'L实施包 (¥1.2M)', value: 'l_impl' },
    ],
    well_architected: [
      { label: '标准版 (¥120K)', value: 'standard' },
      { label: '专业版 (¥200K)', value: 'professional' },
      { label: '实施版 (¥380K)', value: 'implementation' },
    ],
    iac: [
      { label: 'S咨询包 (¥100K)', value: 's_consult' },
      { label: 'M开发包 (¥280K)', value: 'm_dev' },
      { label: 'L全栈包 (¥480K)', value: 'l_full' },
    ],
  }
  return pkgMap[sowGenForm.projectType] || []
})

const apiTests = reactive([
  { name: 'GET /customers', fn: () => customerApi.list(), loading: false, result: false, success: false, duration: 0 },
  { name: 'GET /opportunities', fn: () => opportunityApi.list(), loading: false, result: false, success: false, duration: 0 },
  { name: 'GET /opportunities/stats', fn: () => opportunityApi.stats(), loading: false, result: false, success: false, duration: 0 },
  { name: 'GET /fact-sheets/registry', fn: () => factsheetApi.registry(), loading: false, result: false, success: false, duration: 0 },
  { name: 'GET /skills', fn: () => skillApi.list(), loading: false, result: false, success: false, duration: 0 },
  { name: 'GET /dashboard/stats', fn: () => dashboardApi.stats(), loading: false, result: false, success: false, duration: 0 },
])

onMounted(async () => {
  loadSowTemplates()
  await loadMockData()
})

function loadSowTemplates() {
  sowTemplates.value = [
    {
      id: 'ac-lz', name: 'AC Landing Zone 云基础架构建设服务 SOW', category: 'landing_zone', source: 'standard',
      description: '覆盖账号治理、身份管理、网络架构、安全基线、合规审计、财务管理、运维监控 7 大域',
      file_name: 'AC_LandingZone_SOW_CN_V1.0.docx', version: 3,
      packages: ['轻量版 ¥80K', '基础版 ¥180K', '标准版 ¥350K', 'S基础包 ¥150K', 'M标准包 ¥380K', 'L增强包 ¥680K'],
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 }, { prop: 'type', label: '类型', minWidth: 70 },
        { prop: 'scope', label: '包含阶段', minWidth: 180 }, { prop: 'accounts', label: '账号上限', minWidth: 70 },
        { prop: 'duration', label: '工期', minWidth: 70 }, { prop: 'price', label: '定价(元)', minWidth: 80 },
      ],
      pricing: [
        { spec: '轻量版', type: '咨询包', scope: '调研+自动化落地+KT', accounts: '10', duration: '10工作日', price: '80,000' },
        { spec: '基础版', type: '咨询包', scope: '调研+方案设计+技术验证', accounts: '30', duration: '20工作日', price: '180,000' },
        { spec: '标准版', type: '咨询包', scope: '调研+方案设计(全7域)+验证', accounts: '50', duration: '30工作日', price: '350,000' },
        { spec: 'S基础包', type: '咨询+实施', scope: '轻量版咨询+基础实施', accounts: '10', duration: '20工作日', price: '150,000' },
        { spec: 'M标准包', type: '咨询+实施', scope: '基础版咨询+标准实施', accounts: '30', duration: '40工作日', price: '380,000' },
        { spec: 'L增强包', type: '咨询+实施', scope: '标准版咨询+完整实施+高阶', accounts: '50', duration: '60工作日', price: '680,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '项目需求确认书', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '云上IT治理现状调研报告', phase: '阶段一', format: 'Word' },
        { id: 'D-04', name: 'HLD 架构设计文档', phase: '阶段二', format: 'Word' },
        { id: 'D-05', name: 'LLD 实施方案', phase: '阶段二', format: 'Word' },
        { id: 'D-10', name: 'Landing Zone 基础架构', phase: '阶段三', format: '云上配置' },
        { id: 'D-11', name: 'IaC 代码仓库', phase: '阶段三', format: 'Git' },
        { id: 'D-17', name: '验收报告', phase: '阶段四', format: 'Word' },
      ],
    },
    {
      id: 'ac-wa', name: 'AC 云卓越架构评估服务 SOW', category: 'well_architected', source: 'standard',
      description: '基于云厂商 WA 框架进行六大支柱评估', file_name: 'AC_WellArchitected_SOW_CN_V1.0.docx', version: 3,
      packages: ['标准版 ¥120K', '专业版 ¥200K', '实施版 ¥380K'],
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 }, { prop: 'scope', label: '包含阶段', minWidth: 180 },
        { prop: 'workloads', label: '工作负载', minWidth: 80 }, { prop: 'duration', label: '工期', minWidth: 70 },
        { prop: 'price', label: '定价(元)', minWidth: 80 },
      ],
      pricing: [
        { spec: '标准版', scope: '启动+评估+报告', workloads: '1~3个', duration: '10工作日', price: '120,000' },
        { spec: '专业版', scope: '启动+评估+报告+知识转移', workloads: '1~5个', duration: '15工作日', price: '200,000' },
        { spec: '实施版', scope: '专业版+改进实施+UAT', workloads: '1~5个', duration: '30工作日', price: '380,000' },
      ],
      deliverables: [
        { id: 'D-01', name: 'WA 评估启动报告', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '六大支柱评估报告', phase: '阶段二', format: 'Word' },
        { id: 'D-03', name: '改进路线图', phase: '阶段二', format: 'PPT' },
      ],
    },
    {
      id: 'ac-bd', name: 'AC 大数据平台建设服务 SOW', category: 'big_data', source: 'standard',
      description: '湖仓一体架构设计、数据迁移、开发治理平台', file_name: 'AC_BigData_SOW_CN_V1.0.docx', version: 3,
      packages: ['S咨询 ¥200K', 'M咨询 ¥380K', 'S实施 ¥500K', 'M实施 ¥800K', 'L实施 ¥1.2M'],
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 }, { prop: 'type', label: '类型', minWidth: 70 },
        { prop: 'scope', label: '包含阶段', minWidth: 180 }, { prop: 'nodes', label: '集群', minWidth: 70 },
        { prop: 'migration', label: '迁移量', minWidth: 60 }, { prop: 'price', label: '定价(元)', minWidth: 80 },
      ],
      pricing: [
        { spec: 'S咨询包', type: '咨询', scope: '调研+方案设计', nodes: '50节点', migration: '—', price: '200,000' },
        { spec: 'M咨询包', type: '咨询', scope: '调研+方案设计+技术验证', nodes: '100节点', migration: '—', price: '380,000' },
        { spec: 'S实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移', nodes: '50节点', migration: '5TB', price: '500,000' },
        { spec: 'M实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移', nodes: '100节点', migration: '20TB', price: '800,000' },
        { spec: 'L实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移+治理', nodes: '200节点', migration: '50TB', price: '1,200,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '大数据平台调研报告', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '湖仓一体架构设计文档', phase: '阶段二', format: 'Word' },
        { id: 'D-04', name: '大数据平台(可运行环境)', phase: '阶段三', format: '云上配置' },
      ],
    },
    {
      id: 'ac-mig', name: 'AC 企业云迁移服务 SOW', category: 'migration', source: 'standard',
      description: '6R 迁移策略，迁移工厂模式，业务连续性保障', file_name: 'AC_Migration_SOW_CN_V1.0.docx', version: 3,
      packages: ['S评估 ¥120K', 'M规划 ¥280K', 'S迁移 ¥380K', 'M迁移 ¥680K', 'L迁移 ¥1.2M'],
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 }, { prop: 'type', label: '类型', minWidth: 70 },
        { prop: 'scope', label: '包含阶段', minWidth: 200 }, { prop: 'servers', label: '服务器', minWidth: 60 },
        { prop: 'dbs', label: '数据库', minWidth: 60 }, { prop: 'price', label: '定价(元)', minWidth: 80 },
      ],
      pricing: [
        { spec: 'S评估包', type: '咨询', scope: '迁移评估+规划', servers: '50台', dbs: '5个', price: '120,000' },
        { spec: 'M规划包', type: '咨询', scope: '评估+规划+架构设计+割接方案', servers: '100台', dbs: '10个', price: '280,000' },
        { spec: 'S迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(50台+5库)', servers: '50台', dbs: '5个', price: '380,000' },
        { spec: 'M迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(100台+10库)', servers: '100台', dbs: '10个', price: '680,000' },
        { spec: 'L迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(200台+20库)', servers: '200台', dbs: '20个', price: '1,200,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '迁移评估报告', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '迁移规划书', phase: '阶段一', format: 'Word' },
        { id: 'D-05', name: '目标云基础架构设计文档', phase: '阶段二', format: 'Word' },
        { id: 'D-06', name: '割接方案与回滚预案', phase: '阶段二', format: 'Word' },
        { id: 'D-08', name: '服务器迁移记录', phase: '阶段三', format: 'Excel' },
        { id: 'D-09', name: '数据库迁移验证报告', phase: '阶段三', format: 'Word' },
      ],
    },
    {
      id: 'ac-iac', name: 'AC 基础设施即代码开发服务 SOW', category: 'iac', source: 'standard',
      description: 'Terraform 模块库开发、CI/CD 流水线、策略即代码', file_name: 'AC_IaC_SOW_CN_V1.0.docx', version: 3,
      packages: ['S咨询 ¥100K', 'M开发 ¥280K', 'L全栈 ¥480K'],
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 }, { prop: 'type', label: '类型', minWidth: 80 },
        { prop: 'scope', label: '包含阶段', minWidth: 200 }, { prop: 'modules', label: '模块', minWidth: 50 },
        { prop: 'duration', label: '工期', minWidth: 70 }, { prop: 'price', label: '定价(元)', minWidth: 80 },
      ],
      pricing: [
        { spec: 'S咨询包', type: '咨询', scope: '调研+框架设计', modules: '—', duration: '10工作日', price: '100,000' },
        { spec: 'M开发包', type: '咨询+开发', scope: '调研+框架+核心模块(5个)+CI/CD', modules: '5', duration: '25工作日', price: '280,000' },
        { spec: 'L全栈包', type: '咨询+开发+实施', scope: 'M开发包+全部模块(10个)+验证+合规', modules: '10', duration: '40工作日', price: '480,000' },
      ],
      deliverables: [
        { id: 'D-01', name: 'IaC 调研与框架设计文档', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: 'Terraform 模块库', phase: '阶段二', format: 'Git' },
        { id: 'D-03', name: 'CI/CD 流水线配置', phase: '阶段二', format: '代码' },
      ],
    },
    {
      id: 'ac-pricing', name: '安畅标准咨询实施服务 定价与服务目录', category: 'pricing', source: 'standard',
      description: '5 大标准咨询实施服务体系完整定价目录', file_name: '安畅标准咨询实施服务_定价与服务目录_V1.0.docx', version: 3,
      packages: ['5大产品线全覆盖'], pricing: [], pricingColumns: [], deliverables: [],
    },
  ]
}

async function loadMockData() {
  try {
    const [customers, opportunities, factSheets, skillList] = await Promise.all([
      customerApi.list(),
      opportunityApi.list(),
      factsheetApi.list('o001'),
      skillApi.list(),
    ])
    mockCustomers.value = customers.items || customers || []
    mockOpportunities.value = opportunities.items || opportunities || []
    mockFactSheets.value = factSheets || []
    skills.value = skillList || []
  } catch (e) {
    console.error('加载 Mock 数据失败', e)
  }
}

async function refreshMockData(type) {
  try {
    if (type === 'customers') {
      const res = await customerApi.list()
      mockCustomers.value = res.items || res || []
    } else {
      const res = await opportunityApi.list()
      mockOpportunities.value = res.items || res || []
    }
    ElMessage.success('刷新成功')
  } catch {
    ElMessage.error('刷新失败')
  }
}

function selectSkill(skill) {
  selectedSkill.value = skill
  executeResult.value = null
  Object.keys(skillInputs).forEach(k => delete skillInputs[k])
  if (skill.input_schema) {
    Object.entries(skill.input_schema).forEach(([key, type]) => {
      if (key === 'facts') {
        skillInputs[key] = { project_type: 'landing_zone', target_cloud: 'aliyun', vm_count: 500 }
      } else if (type === 'integer') {
        skillInputs[key] = 10
      } else {
        skillInputs[key] = ''
      }
    })
  }
}

async function executeSkill() {
  if (!selectedSkill.value) return
  executing.value = true
  executeResult.value = null
  try {
    const res = await skillApi.execute({
      skill_name: selectedSkill.value.name,
      inputs: { ...skillInputs },
    })
    executeResult.value = res.outputs || res
    ElMessage.success('执行完成')
  } catch (e) {
    ElMessage.error('执行失败: ' + e.message)
  } finally {
    executing.value = false
  }
}

async function testApi(api) {
  api.loading = true
  api.result = false
  const start = Date.now()
  try {
    await api.fn()
    api.success = true
    api.result = true
  } catch {
    api.success = false
    api.result = true
  } finally {
    api.duration = Date.now() - start
    api.loading = false
  }
}

function simulateGenerateSOW() {
  generating.value = true
  setTimeout(() => {
    const f = sowGenForm
    const cloud = cloudLabels[f.targetCloud] || f.targetCloud
    const type = typeLabels[f.projectType] || f.projectType
    const pkg = currentPackages.value.find(p => p.value === f.packageType)
    const pkgLabel = pkg ? pkg.label : f.packageType

    generatedSow.value = `
      <h1 style="text-align:center;color:#303133">${f.customerName} - ${cloud}${type}项目工作说明书</h1>
      <p style="text-align:center;color:#909399">服务包: ${pkgLabel} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <hr/>
      <h2 style="color:#409EFF;border-left:3px solid #409EFF;padding-left:10px">第一部分 协议基本信息</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border:1px solid #ddd;width:120px;background:#f5f7fa">客户名称</td><td style="padding:8px;border:1px solid #ddd">${f.customerName}</td><td style="padding:8px;border:1px solid #ddd;width:120px;background:#f5f7fa">服务提供商</td><td style="padding:8px;border:1px solid #ddd">上海安畅网络科技股份有限公司</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f7fa">项目类型</td><td style="padding:8px;border:1px solid #ddd">${type}</td><td style="padding:8px;border:1px solid #ddd;background:#f5f7fa">目标云平台</td><td style="padding:8px;border:1px solid #ddd">${cloud}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f5f7fa">服务包规格</td><td style="padding:8px;border:1px solid #ddd" colspan="3">${pkgLabel}</td></tr>
      </table>
      <h2 style="color:#409EFF;border-left:3px solid #409EFF;padding-left:10px">第二部分 背景与目标</h2>
      <p>本项目旨在为 <strong>${f.customerName}</strong> 构建 <strong>${cloud}${type}</strong> 解决方案。项目涵盖 ${f.vmCount} 台虚拟机、${f.dbCount} 个数据库的管理，跨 ${f.accountCount} 个云账号。</p>
      <h2 style="color:#409EFF;border-left:3px solid #409EFF;padding-left:10px">第三部分 服务范围</h2>
      <p><strong>阶段一：调研与评估</strong> — 现状调研、需求分析、需求确认</p>
      <p><strong>阶段二：方案设计</strong> — 架构设计、实施方案、技术验证</p>
      <p><strong>阶段三：实施落地</strong> — 自动化部署、配置、验证测试</p>
      <p><strong>阶段四：验收与知识转移</strong> — UAT验收、培训、文档交付</p>
      <h2 style="color:#409EFF;border-left:3px solid #409EFF;padding-left:10px">第四部分 交付物</h2>
      <ul><li>项目需求确认书</li><li>现状调研报告</li><li>架构设计文档(HLD)</li><li>实施方案(LLD)</li><li>已部署环境说明</li><li>IaC 代码仓库</li><li>验收报告</li><li>运维操作手册</li></ul>
      <h2 style="color:#409EFF;border-left:3px solid #409EFF;padding-left:10px">第五部分 费用与付款</h2>
      <p>服务包: <strong>${pkgLabel}</strong></p>
    `
    generating.value = false
    ElMessage.success('SOW 模拟生成完成')
  }, 1500)
}

function resetSowGenForm() {
  Object.assign(sowGenForm, {
    customerName: '', projectType: 'landing_zone', targetCloud: 'aliyun',
    packageType: 'standard', vmCount: 0, dbCount: 0, accountCount: 1,
  })
  generatedSow.value = null
}

function copySowResult() {
  if (generatedSow.value) {
    const text = generatedSow.value.replace(/<[^>]+>/g, '')
    navigator.clipboard.writeText(text).then(() => ElMessage.success('已复制到剪贴板'))
  }
}

function filterSowTemplates() {}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}
.page-header h2 { margin: 0; font-size: 20px; }
.filter-card :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.expand-content { padding: 12px 20px; }
.expand-content h4 { margin: 8px 0; color: #303133; }
.skill-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: background 0.2s;
}
.skill-item:hover { background: #f5f7fa; }
.skill-item.active { background: #ecf5ff; border: 1px solid #409EFF; }
.skill-info { flex: 1; }
.skill-name { font-size: 14px; font-weight: 500; color: #303133; }
.skill-desc { font-size: 12px; color: #909399; margin-top: 2px; }
.prompt-preview {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}
.result-preview {
  background: #f0f9eb;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}
.api-test-list { display: flex; flex-direction: column; gap: 8px; }
.api-test-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 4px;
}
.api-name { font-family: monospace; font-size: 13px; flex: 1; }
.api-duration { font-size: 12px; color: #909399; }
.generated-sow {
  max-height: 600px;
  overflow-y: auto;
  padding: 20px;
  line-height: 1.8;
}
.generated-sow h1 { font-size: 20px; }
.generated-sow h2 { font-size: 16px; margin-top: 20px; }
.generated-sow p { color: #606266; }
.generated-sow ul { padding-left: 20px; }
.generated-sow li { color: #606266; line-height: 2; }
</style>
