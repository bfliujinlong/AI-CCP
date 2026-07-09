<template>
  <div class="sow-view" v-loading="loading">
    <el-page-header @back="$router.push(`/opportunities/${opportunityId}`)" :title="'返回商机'">
      <template #content>
        <span class="page-title">SOW 生成 - {{ opportunityName }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="6">
        <el-card shadow="never">
          <template #header>工作流进度</template>
          <el-steps direction="vertical" :active="workflowStep" finish-status="success">
            <el-step title="创建商机" />
            <el-step title="填写 Fact Sheet" />
            <el-step title="AI 报价" />
            <el-step title="生成 SOW" />
            <el-step title="生成 WBS" />
            <el-step title="导出文档" />
          </el-steps>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header>Fact Sheet 摘要</template>
          <div v-if="latestFactSheet">
            <div v-for="(value, key) in latestFactSheet.facts" :key="key" class="fact-brief">
              <span class="fact-key">{{ factLabel(key) }}</span>
              <span class="fact-val">{{ value }}</span>
            </div>
          </div>
          <el-empty v-else description="暂无" :image-size="40" />
        </el-card>
      </el-col>

      <el-col :span="18">
        <div v-if="!sowContent">
          <el-card shadow="never">
            <div style="text-align: center; padding: 40px 0">
              <el-icon :size="80" color="#dcdfe6"><Notebook /></el-icon>
              <h3 style="color: #606266; margin: 16px 0">AI 自动生成 SOW</h3>
              <p style="color: #909399; margin-bottom: 12px">
                基于报价评估数据和 Fact Sheet，AI 将自动生成完整的工作说明书（Statement of Work）
              </p>
              <div v-if="projectTypeName" style="margin-bottom: 12px">
                <span style="color: #606266; font-size: 14px; margin-right: 8px">项目类型:</span>
                <el-tag :style="{ background: projectTypeColors[projectType] || '#409EFF', border: 'none', color: '#fff' }" size="large">
                  {{ projectTypeName }}
                </el-tag>
              </div>
              <div v-if="hasQuotation" style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; border: 1px solid #d0e8ff">
                <div style="font-size: 14px; color: #409EFF; margin-bottom: 6px; font-weight: 600">已检测到报价数据</div>
                <div style="font-size: 13px; color: #606266">
                  总工时: <strong>{{ quotationTotalHours }} 人天</strong> |
                  预计周期: <strong>{{ quotationTotalWeeks }} 周</strong> |
                  <span style="color: #67C23A">SOW 将引用报价的阶段工时和团队配置</span>
                </div>
              </div>
              <div v-else style="margin-bottom: 16px; padding: 10px; background: #fdf6ec; border-radius: 8px; border: 1px solid #faecd8">
                <div style="font-size: 13px; color: #E6A23C">
                  未检测到报价数据，SOW 将使用默认估算生成。
                  <el-link type="primary" :underline="false" @click="$router.push(`/quotation/${opportunityId}`)">去生成报价</el-link>
                </div>
              </div>
              <el-button type="primary" size="large" :loading="generating" :disabled="!latestFactSheet" @click="generateSOW">
                <el-icon><MagicStick /></el-icon> 生成 SOW
              </el-button>
              <p v-if="!latestFactSheet" style="color: #F56C6C; margin-top: 12px; font-size: 13px">
                请先填写 Fact Sheet
              </p>
            </div>
          </el-card>
        </div>

        <div v-else>
          <el-card shadow="never">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span>SOW 文档预览</span>
                <div>
                  <el-button size="small" @click="generateSOW" :loading="generating">
                    <el-icon><Refresh /></el-icon> 重新生成
                  </el-button>
                  <el-button type="primary" size="small" @click="exportSOW('word')">
                    <el-icon><Download /></el-icon> 导出 Word
                  </el-button>
                  <el-button size="small" @click="exportSOW('pdf')">
                    <el-icon><Download /></el-icon> 导出 PDF
                  </el-button>
                </div>
              </div>
            </template>

            <div class="sow-document">
              <h1 class="sow-title">{{ sowContent.title }}</h1>
              <p class="sow-meta">客户: {{ opportunityName }} | 生成时间: {{ currentTime }}</p>

              <el-divider />

              <section class="sow-section">
                <h2>1. 项目概述</h2>
                <p>{{ sowContent.project_overview }}</p>
              </section>

              <section class="sow-section">
                <h2>2. 项目范围</h2>
                <p>{{ sowContent.scope }}</p>
                <el-table :data="sowContent.scope_items" stripe size="small" style="margin-top: 12px">
                  <el-table-column prop="category" label="类别" width="150" />
                  <el-table-column prop="item" label="工作项" min-width="250" />
                  <el-table-column prop="included" label="是否包含" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.included ? 'success' : 'info'" size="small">{{ row.included ? '包含' : '不包含' }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </section>

              <section class="sow-section">
                <h2>3. 交付物</h2>
                <el-table :data="sowContent.deliverables" stripe size="small">
                  <el-table-column prop="name" label="交付物名称" min-width="200" />
                  <el-table-column prop="description" label="描述" min-width="300" />
                  <el-table-column prop="milestone" label="里程碑" width="150" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>4. 前提假设</h2>
                <ul>
                  <li v-for="(item, idx) in sowContent.assumptions" :key="idx">{{ item }}</li>
                </ul>
              </section>

              <section class="sow-section">
                <h2>5. 风险与缓解</h2>
                <el-table :data="sowContent.risks" stripe size="small">
                  <el-table-column prop="risk" label="风险" min-width="200" />
                  <el-table-column prop="impact" label="影响" width="120">
                    <template #default="{ row }">
                      <el-tag :type="row.impact === '高' ? 'danger' : row.impact === '中' ? 'warning' : 'info'" size="small">{{ row.impact }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="mitigation" label="缓解措施" min-width="250" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>6. 项目时间线</h2>
                <p>{{ sowContent.timeline }}</p>
                <el-table :data="sowContent.milestones" stripe size="small" style="margin-top: 12px">
                  <el-table-column prop="phase" label="阶段" width="150" />
                  <el-table-column prop="duration" label="周期" width="120" />
                  <el-table-column prop="deliverable" label="交付物" min-width="200" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>7. 团队配置</h2>
                <el-table :data="sowContent.team" stripe size="small">
                  <el-table-column prop="role" label="角色" width="150" />
                  <el-table-column prop="count" label="人数" width="80" />
                  <el-table-column prop="responsibility" label="职责" min-width="300" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>8. 验收标准</h2>
                <ul>
                  <li v-for="(item, idx) in sowContent.acceptance_criteria" :key="idx">{{ item }}</li>
                </ul>
              </section>
            </div>
          </el-card>

          <el-card shadow="never" style="margin-top: 20px">
            <template #header>下一步</template>
            <div style="display: flex; gap: 12px">
              <el-button type="primary" @click="$router.push(`/wbs/${opportunityId}`)">
                <el-icon><Grid /></el-icon> 生成 WBS
              </el-button>
              <el-button @click="$router.push(`/quotation/${opportunityId}`)">
                <el-icon><Money /></el-icon> 查看报价
              </el-button>
              <el-button @click="$router.push(`/opportunities/${opportunityId}`)">
                <el-icon><Back /></el-icon> 返回商机
              </el-button>
            </div>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { opportunityApi, factsheetApi } from '@/api'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { exportDocument } from '@/utils/export'
import { getJSON, setJSON } from '@/utils/db'
import { generateSOWByType, getProjectTypeName } from '@/utils/sowTemplates'

const route = useRoute()
const opportunityId = route.params.opportunityId
const loading = ref(false)
const generating = ref(false)
const opportunityName = ref('')
const factSheets = ref([])
const sowContent = ref(null)
const workflowStep = ref(3)

const latestFactSheet = computed(() => factSheets.value.length > 0 ? factSheets.value[0] : null)
const currentTime = computed(() => dayjs().format('YYYY-MM-DD HH:mm'))
const projectType = computed(() => latestFactSheet.value?.facts?.project_type || '')
const projectTypeName = computed(() => projectType.value ? getProjectTypeName(projectType.value) : '')
const quotationData = computed(() => getJSON(`aicc_quotation_${opportunityId}`))
const hasQuotation = computed(() => !!quotationData.value?.estimate)
const quotationTotalHours = computed(() => quotationData.value?.estimate?.totalHours || 0)
const quotationTotalWeeks = computed(() => quotationData.value?.estimate?.totalWeeks || 0)

const projectTypeColors = {
  landing_zone: '#409EFF', migration: '#F56C6C', big_data: '#E6A23C',
  hybrid_cloud: '#67C23A', security: '#9B59B6', cost_optimization: '#909399',
}

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
  architecture_type: '架构类型', app_count: '业务应用数', microservice_count: '微服务数量',
  k8s_cluster_count: 'K8s集群数', container_count: '容器实例数', api_count: 'API数量',
  storage_tb: '存储容量(TB)', bandwidth_mbps: '带宽需求(Mbps)',
}
function factLabel(key) { return factLabels[key] || key }

onMounted(async () => {
  loading.value = true
  try {
    try {
      const opp = await opportunityApi.get(opportunityId)
      opportunityName.value = opp.name
    } catch (e) {
      console.warn('[SowView] 加载商机信息失败，使用默认数据:', e)
      opportunityName.value = '未知商机'
    }
    factSheets.value = await factsheetApi.list(opportunityId)
    if (factSheets.value.length > 0) workflowStep.value = 3
    // 加载已保存的 SOW
    const saved = getJSON(`aicc_sow_${opportunityId}`)
    if (saved) {
      sowContent.value = saved
      workflowStep.value = 4
    }
  } finally {
    loading.value = false
  }
})

async function generateSOW() {
  if (!latestFactSheet.value) return
  generating.value = true
  try {
    const facts = latestFactSheet.value.facts
    const projectType = facts.project_type || 'landing_zone'
    const typeName = getProjectTypeName(projectType)

    // 读取报价数据
    const quotation = getJSON(`aicc_quotation_${opportunityId}`)

    // 按项目类型 + 报价数据生成 SOW
    sowContent.value = generateSOWByType(projectType, facts, quotation, opportunityName.value)

    workflowStep.value = 4
    // 持久化到 IndexedDB
    setJSON(`aicc_sow_${opportunityId}`, sowContent.value)

    const sourceMsg = quotation?.estimate
      ? `（基于报价${quotation.estimate.totalHours}人天）`
      : '（使用默认估算）'
    ElMessage.success(`${typeName}项目 SOW 生成完成${sourceMsg}`)
  } finally {
    generating.value = false
  }
}

async function exportSOW(format) {
  if (!sowContent.value) {
    ElMessage.warning('请先生成 SOW')
    return
  }
  const s = sowContent.value
  const doc = {
    title: s.title,
    subtitle: `客户: ${opportunityName.value} | 生成时间: ${currentTime.value}`,
    sections: [
      { heading: '1. 项目概述', paragraphs: [s.project_overview] },
      {
        heading: '2. 项目范围',
        paragraphs: [s.scope],
        table: {
          headers: ['类别', '工作项', '是否包含'],
          rows: s.scope_items.map(i => [i.category, i.item, i.included ? '包含' : '不包含']),
        },
      },
      {
        heading: '3. 交付物',
        table: {
          headers: ['交付物名称', '描述', '里程碑'],
          rows: s.deliverables.map(d => [d.name, d.description, d.milestone]),
        },
      },
      { heading: '4. 前提假设', list: s.assumptions },
      {
        heading: '5. 风险与缓解',
        table: {
          headers: ['风险', '影响', '缓解措施'],
          rows: s.risks.map(r => [r.risk, r.impact, r.mitigation]),
        },
      },
      {
        heading: '6. 项目时间线',
        paragraphs: [s.timeline],
        table: {
          headers: ['阶段', '周期', '交付物'],
          rows: s.milestones.map(m => [m.phase, m.duration, m.deliverable]),
        },
      },
      {
        heading: '7. 团队配置',
        table: {
          headers: ['角色', '人数', '职责'],
          rows: s.team.map(t => [t.role, String(t.count), t.responsibility]),
        },
      },
      { heading: '8. 验收标准', list: s.acceptance_criteria },
    ],
  }
  try {
    ElMessage.info(`正在导出 ${format.toUpperCase()}...`)
    await exportDocument(format, doc, `SOW_${opportunityName.value}_${dayjs().format('YYYYMMDD')}`)
    ElMessage.success(`SOW 已导出为 ${format.toUpperCase()}`)
  } catch (e) {
    ElMessage.error(`导出失败: ${e.message}`)
  }
}
</script>

<style scoped>
.page-title {
  font-size: 18px;
  font-weight: 600;
}

.fact-brief {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.fact-key {
  color: #909399;
}

.fact-val {
  color: #303133;
  font-weight: 500;
}

.sow-document {
  max-width: 900px;
  margin: 0 auto;
}

.sow-title {
  text-align: center;
  font-size: 22px;
  color: #303133;
  margin-bottom: 8px;
}

.sow-meta {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 0;
}

.sow-section {
  margin-bottom: 24px;
}

.sow-section h2 {
  font-size: 16px;
  color: #303133;
  border-left: 3px solid #409EFF;
  padding-left: 10px;
  margin-bottom: 12px;
}

.sow-section p {
  color: #606266;
  line-height: 1.8;
}

.sow-section ul {
  padding-left: 20px;
}

.sow-section li {
  color: #606266;
  line-height: 2;
}
</style>
