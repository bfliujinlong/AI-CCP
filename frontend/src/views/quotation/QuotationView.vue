<template>
  <div class="quotation-view" v-loading="loading">
    <el-page-header @back="$router.push(`/opportunities/${opportunityId}`)" :title="'返回商机'">
      <template #content>
        <span class="page-title">AI 报价 - {{ opportunityName }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="8">
        <el-card shadow="never" class="facts-panel">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>Fact Sheet 数据源</span>
              <el-button type="primary" link @click="$router.push(`/factsheet/${opportunityId}`)">编辑</el-button>
            </div>
          </template>
          <div v-if="latestFactSheet">
            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item v-for="(value, key) in latestFactSheet.facts" :key="key" :label="factLabel(key)">
                <el-tag v-if="typeof value === 'string' && ['project_type','current_cloud','target_cloud','security_level'].includes(key)" size="small">{{ value }}</el-tag>
                <span v-else style="font-weight: 600">{{ value }}</span>
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂无 Fact Sheet，请先填写" :image-size="60">
            <el-button type="primary" size="small" @click="$router.push(`/factsheet/${opportunityId}`)">填写 Fact Sheet</el-button>
          </el-empty>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header>报价参数</template>
          <el-form :model="estimateParams" label-width="80px" size="small">
            <el-form-item label="人天单价">
              <el-input-number v-model="estimateParams.daily_rate" :min="1000" :step="500" style="width: 100%" />
            </el-form-item>
            <el-form-item label="折扣">
              <el-slider v-model="estimateParams.discount" :min="50" :max="100" :step="5" show-input />
            </el-form-item>
            <el-form-item label="税率(%)">
              <el-input-number v-model="estimateParams.tax_rate" :min="0" :max="20" :step="1" style="width: 100%" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="estimating" @click="generateEstimate" :disabled="!latestFactSheet" style="width: 100%">
                <el-icon><MagicStick /></el-icon> AI 智能报价
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="16">
        <div v-if="estimateResult">
          <el-card shadow="never" class="summary-card">
            <el-row :gutter="20">
              <el-col :span="6">
                <div class="summary-item">
                  <p class="summary-label">总人天</p>
                  <h2 class="summary-value">{{ estimateResult.total_person_days }}</h2>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="summary-item">
                  <p class="summary-label">折扣前总价</p>
                  <h2 class="summary-value">¥{{ formatMoney(estimateResult.total_before_discount) }}</h2>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="summary-item">
                  <p class="summary-label">折扣后总价</p>
                  <h2 class="summary-value primary">¥{{ formatMoney(estimateResult.total_after_discount) }}</h2>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="summary-item">
                  <p class="summary-label">含税总价</p>
                  <h2 class="summary-value success">¥{{ formatMoney(estimateResult.total_with_tax) }}</h2>
                </div>
              </el-col>
            </el-row>
          </el-card>

          <el-card shadow="never" style="margin-top: 20px">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span>成本明细</span>
                <el-button type="primary" size="small" @click="exportQuotation">
                  <el-icon><Download /></el-icon> 导出报价单
                </el-button>
              </div>
            </template>
            <el-table :data="estimateResult.cost_breakdown" stripe show-summary :summary-method="getSummary">
              <el-table-column prop="item" label="工作项" min-width="200" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="days" label="人天" width="100" align="right" />
              <el-table-column prop="rate" label="单价" width="120" align="right">
                <template #default="{ row }">¥{{ Number(row.rate).toLocaleString() }}</template>
              </el-table-column>
              <el-table-column prop="total" label="小计" width="140" align="right">
                <template #default="{ row }">¥{{ Number(row.total).toLocaleString() }}</template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-row :gutter="20" style="margin-top: 20px">
            <el-col :span="12">
              <el-card shadow="never">
                <template #header>成本分布</template>
                <v-chart :option="costPieOption" style="height: 300px" autoresize />
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="never">
                <template #header>下一步操作</template>
                <div class="next-actions">
                  <el-button type="primary" size="large" style="width: 100%; margin-bottom: 12px" @click="$router.push(`/sow/${opportunityId}`)">
                    <el-icon><Notebook /></el-icon> 生成 SOW
                  </el-button>
                  <el-button type="success" size="large" style="width: 100%; margin-bottom: 12px" @click="$router.push(`/wbs/${opportunityId}`)">
                    <el-icon><Grid /></el-icon> 生成 WBS
                  </el-button>
                  <el-button size="large" style="width: 100%" @click="$router.push(`/opportunities/${opportunityId}`)">
                    <el-icon><Back /></el-icon> 返回商机
                  </el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <el-card shadow="never" v-else>
          <el-empty description="点击左侧「AI 智能报价」按钮，基于 Fact Sheet 自动生成报价" :image-size="120">
            <template #image>
              <el-icon :size="120" color="#dcdfe6"><Money /></el-icon>
            </template>
          </el-empty>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { opportunityApi, factsheetApi, skillApi } from '@/api'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

const route = useRoute()
const opportunityId = route.params.opportunityId
const loading = ref(false)
const estimating = ref(false)
const opportunityName = ref('')
const factSheets = ref([])
const estimateResult = ref(null)

const latestFactSheet = computed(() => factSheets.value.length > 0 ? factSheets.value[0] : null)

const estimateParams = reactive({
  daily_rate: 3500,
  discount: 100,
  tax_rate: 6,
})

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
}

function factLabel(key) { return factLabels[key] || key }

function formatMoney(val) {
  if (!val) return '0'
  return Number(val).toLocaleString()
}

function getSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, index) => {
    if (index === 0) { sums[index] = '合计'; return }
    if (index === 2) { sums[index] = data.reduce((s, r) => s + Number(r.days || 0), 0); return }
    if (index === 4) { sums[index] = '¥' + data.reduce((s, r) => s + Number(r.total || 0), 0).toLocaleString(); return }
    sums[index] = ''
  })
  return sums
}

const costPieOption = computed(() => {
  if (!estimateResult.value?.cost_breakdown) return {}
  const data = estimateResult.value.cost_breakdown.map(item => ({
    name: item.item,
    value: Number(item.total),
  }))
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n¥{c}' },
      data,
    }],
  }
})

onMounted(async () => {
  loading.value = true
  try {
    const opp = await opportunityApi.get(opportunityId)
    opportunityName.value = opp.name
    factSheets.value = await factsheetApi.list(opportunityId)
  } finally {
    loading.value = false
  }
})

async function generateEstimate() {
  if (!latestFactSheet.value) return
  estimating.value = true
  try {
    const facts = latestFactSheet.value.facts
    const vmCount = facts.vm_count || 0
    const dbCount = facts.database_count || 0
    const regionCount = facts.region_count || 1
    const accountCount = facts.account_count || 1
    const vpcCount = facts.vpc_count || 0
    const securityLevel = facts.security_level || 'basic'
    const projectType = facts.project_type || 'landing_zone'

    let breakdown = []
    let totalDays = 0

    if (projectType === 'landing_zone') {
      const lzDesign = 5 + accountCount * 1.5 + regionCount * 2
      const lzNetwork = 3 + vpcCount * 1
      const lzSecurity = securityLevel === 'advanced' ? 10 : securityLevel === 'medium' ? 6 : 3
      const lzGovernance = 4 + accountCount * 0.5
      const lzOps = 3 + regionCount * 1
      const lzTest = 5
      const lzProject = Math.ceil((lzDesign + lzNetwork + lzSecurity + lzGovernance + lzOps + lzTest) * 0.15)
      breakdown = [
        { item: 'Landing Zone 架构设计', description: '多云账号体系、网络架构、安全架构设计', days: Math.ceil(lzDesign), rate: estimateParams.daily_rate, total: Math.ceil(lzDesign) * estimateParams.daily_rate },
        { item: '网络规划与实施', description: 'VPC、子网、安全组、VPN/专线配置', days: Math.ceil(lzNetwork), rate: estimateParams.daily_rate, total: Math.ceil(lzNetwork) * estimateParams.daily_rate },
        { item: '安全合规配置', description: `等保${securityLevel === 'advanced' ? '三级' : securityLevel === 'medium' ? '二级' : '一级'}合规、IAM策略、加密配置`, days: Math.ceil(lzSecurity), rate: estimateParams.daily_rate, total: Math.ceil(lzSecurity) * estimateParams.daily_rate },
        { item: '治理体系搭建', description: '标签策略、成本管理、合规审计', days: Math.ceil(lzGovernance), rate: estimateParams.daily_rate, total: Math.ceil(lzGovernance) * estimateParams.daily_rate },
        { item: '运维体系搭建', description: '监控告警、日志分析、自动化运维', days: Math.ceil(lzOps), rate: estimateParams.daily_rate, total: Math.ceil(lzOps) * estimateParams.daily_rate },
        { item: '测试与验证', description: '功能测试、性能测试、安全测试', days: Math.ceil(lzTest), rate: estimateParams.daily_rate, total: Math.ceil(lzTest) * estimateParams.daily_rate },
        { item: '项目管理', description: '项目协调、进度管理、风险管理', days: Math.ceil(lzProject), rate: estimateParams.daily_rate, total: Math.ceil(lzProject) * estimateParams.daily_rate },
      ]
    } else if (projectType === 'migration') {
      const mAssess = 3 + Math.ceil(vmCount / 100) * 2
      const mDesign = 5 + Math.ceil(dbCount / 10) * 1
      const mMigrate = 10 + Math.ceil(vmCount / 50) * 3 + Math.ceil(dbCount / 5) * 2
      const mCutover = 3 + regionCount * 1
      const mTest = 5 + Math.ceil(vmCount / 100) * 1
      const mProject = Math.ceil((mAssess + mDesign + mMigrate + mCutover + mTest) * 0.15)
      breakdown = [
        { item: '迁移评估', description: `评估${vmCount}台VM和${dbCount}个数据库的迁移可行性`, days: Math.ceil(mAssess), rate: estimateParams.daily_rate, total: Math.ceil(mAssess) * estimateParams.daily_rate },
        { item: '迁移方案设计', description: '迁移策略、工具选型、回滚方案设计', days: Math.ceil(mDesign), rate: estimateParams.daily_rate, total: Math.ceil(mDesign) * estimateParams.daily_rate },
        { item: '迁移实施', description: `分批迁移${vmCount}台VM和${dbCount}个数据库`, days: Math.ceil(mMigrate), rate: estimateParams.daily_rate, total: Math.ceil(mMigrate) * estimateParams.daily_rate },
        { item: '割接与验证', description: '业务割接、数据一致性验证', days: Math.ceil(mCutover), rate: estimateParams.daily_rate, total: Math.ceil(mCutover) * estimateParams.daily_rate },
        { item: '测试与优化', description: '性能测试、功能验证、优化调整', days: Math.ceil(mTest), rate: estimateParams.daily_rate, total: Math.ceil(mTest) * estimateParams.daily_rate },
        { item: '项目管理', description: '项目协调、进度管理、风险管理', days: Math.ceil(mProject), rate: estimateParams.daily_rate, total: Math.ceil(mProject) * estimateParams.daily_rate },
      ]
    } else {
      const baseDays = 15 + Math.ceil(vmCount / 50) * 2 + Math.ceil(dbCount / 10) * 1
      const projectDays = Math.ceil(baseDays * 0.15)
      breakdown = [
        { item: '需求分析与评估', description: '业务需求梳理、技术可行性评估', days: 5, rate: estimateParams.daily_rate, total: 5 * estimateParams.daily_rate },
        { item: '方案设计', description: '架构设计、技术选型、实施计划', days: 8, rate: estimateParams.daily_rate, total: 8 * estimateParams.daily_rate },
        { item: '实施与部署', description: '核心功能实施与部署', days: baseDays, rate: estimateParams.daily_rate, total: baseDays * estimateParams.daily_rate },
        { item: '测试与验证', description: '功能测试、性能测试、安全测试', days: 5, rate: estimateParams.daily_rate, total: 5 * estimateParams.daily_rate },
        { item: '项目管理', description: '项目协调、进度管理', days: projectDays, rate: estimateParams.daily_rate, total: projectDays * estimateParams.daily_rate },
      ]
    }

    totalDays = breakdown.reduce((s, r) => s + r.days, 0)
    const totalBeforeDiscount = breakdown.reduce((s, r) => s + r.total, 0)
    const totalAfterDiscount = Math.ceil(totalBeforeDiscount * estimateParams.discount / 100)
    const totalWithTax = Math.ceil(totalAfterDiscount * (1 + estimateParams.tax_rate / 100))

    estimateResult.value = {
      total_person_days: totalDays,
      total_before_discount: totalBeforeDiscount,
      total_after_discount: totalAfterDiscount,
      total_with_tax: totalWithTax,
      cost_breakdown: breakdown,
    }
    ElMessage.success('报价生成完成')
  } finally {
    estimating.value = false
  }
}

function exportQuotation() {
  if (!estimateResult.value) return

  const rows = estimateResult.value.cost_breakdown.map(r => [
    r.item, r.description, r.days, r.rate, r.total
  ])

  const csvContent = [
    ['工作项', '描述', '人天', '单价(¥)', '小计(¥)'],
    ...rows,
    ['合计', '', estimateResult.value.total_person_days, '', estimateResult.value.total_before_discount],
    ['折扣后', '', '', '', estimateResult.value.total_after_discount],
    ['含税总价', '', '', '', estimateResult.value.total_with_tax],
  ].map(e => e.join(',')).join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `报价单_${opportunityName.value}_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
  ElMessage.success('报价单已导出为 CSV')
}
</script>

<style scoped>
.page-title {
  font-size: 18px;
  font-weight: 600;
}

.facts-panel {
  max-height: 400px;
  overflow-y: auto;
}

.summary-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.summary-item {
  text-align: center;
  padding: 12px;
}

.summary-label {
  color: #909399;
  font-size: 13px;
  margin: 0 0 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.summary-value.primary {
  color: #409EFF;
}

.summary-value.success {
  color: #67C23A;
}

.next-actions {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}
</style>
