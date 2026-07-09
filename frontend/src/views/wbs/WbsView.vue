<template>
  <div class="wbs-view" v-loading="loading">
    <el-page-header @back="$router.push(`/opportunities/${opportunityId}`)" :title="'返回商机'">
      <template #content>
        <span class="page-title">WBS 生成 - {{ opportunityName }}</span>
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
        <div v-if="!wbsData">
          <el-card shadow="never">
            <div style="text-align: center; padding: 40px 0">
              <el-icon :size="80" color="#dcdfe6"><Grid /></el-icon>
              <h3 style="color: #606266; margin: 16px 0">AI 自动生成 WBS</h3>
              <p style="color: #909399; margin-bottom: 12px">
                基于报价评估数据和 Fact Sheet，AI 将自动生成工作分解结构（Work Breakdown Structure）
              </p>
              <div v-if="projectTypeName" style="margin-bottom: 12px">
                <span style="color: #606266; font-size: 14px; margin-right: 8px">项目类型:</span>
                <el-tag type="primary" size="large" effect="dark">{{ projectTypeName }}</el-tag>
              </div>
              <div v-if="hasQuotation" style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; border: 1px solid #d0e8ff">
                <div style="font-size: 14px; color: #409EFF; margin-bottom: 6px; font-weight: 600">已检测到报价数据</div>
                <div style="font-size: 13px; color: #606266">
                  总工时: <strong>{{ quotationTotalHours }} 人天</strong> |
                  预计周期: <strong>{{ quotationTotalWeeks }} 周</strong> |
                  <span style="color: #67C23A">WBS 人天将按报价阶段工时分配</span>
                </div>
              </div>
              <div v-else style="margin-bottom: 16px; padding: 10px; background: #fdf6ec; border-radius: 8px; border: 1px solid #faecd8">
                <div style="font-size: 13px; color: #E6A23C">
                  未检测到报价数据，WBS 将使用默认估算生成。
                  <el-link type="primary" :underline="false" @click="$router.push(`/quotation/${opportunityId}`)">去生成报价</el-link>
                </div>
              </div>
              <el-button type="primary" size="large" :loading="generating" :disabled="!latestFactSheet" @click="generateWBS">
                <el-icon><MagicStick /></el-icon> 生成 WBS
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
                <span>WBS 工作分解结构</span>
                <div>
                  <el-button size="small" @click="generateWBS" :loading="generating">
                    <el-icon><Refresh /></el-icon> 重新生成
                  </el-button>
                  <el-button type="primary" size="small" @click="exportWBS('excel')">
                    <el-icon><Download /></el-icon> 导出 Excel
                  </el-button>
                  <el-button size="small" @click="exportWBS('word')">
                    <el-icon><Download /></el-icon> 导出 Word
                  </el-button>
                  <el-button size="small" @click="exportWBS('pdf')">
                    <el-icon><Download /></el-icon> 导出 PDF
                  </el-button>
                </div>
              </div>
            </template>

            <div class="wbs-summary">
              <el-row :gutter="16">
                <el-col :span="6">
                  <div class="summary-item">
                    <p class="summary-label">总阶段数</p>
                    <h3 class="summary-value">{{ wbsData.phases.length }}</h3>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="summary-item">
                    <p class="summary-label">总任务数</p>
                    <h3 class="summary-value">{{ totalTasks }}</h3>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="summary-item">
                    <p class="summary-label">总人天</p>
                    <h3 class="summary-value primary">{{ totalDays }}</h3>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="summary-item">
                    <p class="summary-label">预计周期</p>
                    <h3 class="summary-value success">{{ estimatedWeeks }}周</h3>
                  </div>
                </el-col>
              </el-row>
            </div>

            <el-divider />

            <div v-for="(phase, pIdx) in wbsData.phases" :key="pIdx" class="wbs-phase">
              <div class="phase-header" @click="togglePhase(pIdx)">
                <div class="phase-info">
                  <el-tag :type="phaseColors[pIdx % phaseColors.length]" size="large" effect="dark">
                    P{{ pIdx + 1 }}
                  </el-tag>
                  <span class="phase-name">{{ phase.name }}</span>
                  <span class="phase-meta">{{ phase.tasks.length }}个任务 | {{ phaseDays(phase) }}人天 | {{ phase.duration }}</span>
                </div>
                <el-icon><ArrowDown v-if="expandedPhases.includes(pIdx)" /><ArrowRight v-else /></el-icon>
              </div>

              <div v-show="expandedPhases.includes(pIdx)" class="phase-tasks">
                <el-table :data="phase.tasks" stripe size="small" show-summary :summary-method="getPhaseSummary">
                  <el-table-column type="index" label="#" width="50" />
                  <el-table-column prop="name" label="任务名称" min-width="220">
                    <template #default="{ row }">
                      <span :style="{ paddingLeft: (row.level || 0) * 16 + 'px' }">
                        {{ row.level === 1 ? '└ ' : '' }}{{ row.name }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="description" label="描述" min-width="200" />
                  <el-table-column prop="duration_days" label="人天" width="80" align="right" />
                  <el-table-column prop="role" label="角色" width="120" />
                  <el-table-column prop="dependencies" label="依赖" width="120">
                    <template #default="{ row }">
                      <span v-if="row.dependencies && row.dependencies.length">{{ row.dependencies.join(', ') }}</span>
                      <span v-else style="color: #c0c4cc">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="deliverable" label="交付物" width="150" />
                </el-table>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" style="margin-top: 20px">
            <template #header>甘特图视图</template>
            <div class="gantt-chart">
              <div v-for="(phase, pIdx) in wbsData.phases" :key="pIdx" class="gantt-row">
                <div class="gantt-label">{{ phase.name }}</div>
                <div class="gantt-bar-container">
                  <div
                    class="gantt-bar"
                    :style="{
                      left: getGanttLeft(pIdx) + '%',
                      width: getGanttWidth(phase) + '%',
                      backgroundColor: phaseBarColors[pIdx % phaseBarColors.length],
                    }"
                  >
                    {{ phase.duration }}
                  </div>
                </div>
              </div>
            </div>
          </el-card>

          <el-card shadow="never" style="margin-top: 20px">
            <template #header>下一步</template>
            <div style="display: flex; gap: 12px">
              <el-button type="success" @click="exportAll">
                <el-icon><Download /></el-icon> 导出全部文档
              </el-button>
              <el-button @click="$router.push(`/sow/${opportunityId}`)">
                <el-icon><Notebook /></el-icon> 查看 SOW
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
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import { exportDocument } from '@/utils/export'
import { getJSON, setJSON } from '@/utils/db'
import { generateWBSByType, getProjectTypeName } from '@/utils/wbsTemplates'

const route = useRoute()
const opportunityId = route.params.opportunityId
const loading = ref(false)
const generating = ref(false)
const opportunityName = ref('')
const factSheets = ref([])
const wbsData = ref(null)
const expandedPhases = ref([0, 1, 2, 3])
const workflowStep = ref(4)

const phaseColors = ['', 'success', 'warning', 'danger', 'info']
const phaseBarColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']

const latestFactSheet = computed(() => factSheets.value.length > 0 ? factSheets.value[0] : null)
const projectType = computed(() => latestFactSheet.value?.facts?.project_type || '')
const projectTypeName = computed(() => projectType.value ? getProjectTypeName(projectType.value) : '')
const quotationData = computed(() => getJSON(`aicc_quotation_${opportunityId}`))
const sowData = computed(() => getJSON(`aicc_sow_${opportunityId}`))
const hasQuotation = computed(() => !!quotationData.value?.estimate)
const quotationTotalHours = computed(() => quotationData.value?.estimate?.totalHours || 0)
const quotationTotalWeeks = computed(() => quotationData.value?.estimate?.totalWeeks || 0)

const totalTasks = computed(() => wbsData.value ? wbsData.value.phases.reduce((s, p) => s + p.tasks.length, 0) : 0)
const totalDays = computed(() => wbsData.value ? wbsData.value.phases.reduce((s, p) => s + phaseDays(p), 0) : 0)
const estimatedWeeks = computed(() => Math.ceil(totalDays.value / 5))

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
  architecture_type: '架构类型', app_count: '业务应用数', microservice_count: '微服务数量',
  k8s_cluster_count: 'K8s集群数', container_count: '容器实例数', api_count: 'API数量',
  storage_tb: '存储容量(TB)', bandwidth_mbps: '带宽需求(Mbps)',
}
function factLabel(key) { return factLabels[key] || key }

function phaseDays(phase) {
  return phase.tasks.reduce((s, t) => s + (t.duration_days || 0), 0)
}

function togglePhase(idx) {
  const i = expandedPhases.value.indexOf(idx)
  if (i >= 0) expandedPhases.value.splice(i, 1)
  else expandedPhases.value.push(idx)
}

function getPhaseSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, index) => {
    if (index === 0) { sums[index] = ''; return }
    if (index === 1) { sums[index] = '小计'; return }
    if (index === 3) { sums[index] = data.reduce((s, r) => s + Number(r.duration_days || 0), 0); return }
    sums[index] = ''
  })
  return sums
}

function getGanttLeft(phaseIdx) {
  let offset = 0
  for (let i = 0; i < phaseIdx; i++) {
    offset += parseWeeks(wbsData.value.phases[i].duration)
  }
  const totalWeeks = wbsData.value.phases.reduce((s, p) => s + parseWeeks(p.duration), 0)
  return (offset / totalWeeks) * 100
}

function getGanttWidth(phase) {
  const totalWeeks = wbsData.value.phases.reduce((s, p) => s + parseWeeks(p.duration), 0)
  return (parseWeeks(phase.duration) / totalWeeks) * 95
}

function parseWeeks(durationStr) {
  const match = durationStr?.match(/(\d+)/)
  return match ? parseInt(match[1]) : 1
}

onMounted(async () => {
  loading.value = true
  try {
    try {
      const opp = await opportunityApi.get(opportunityId)
      opportunityName.value = opp.name
    } catch (e) {
      console.warn('[WbsView] 加载商机信息失败，使用默认数据:', e)
      opportunityName.value = '未知商机'
    }
    factSheets.value = await factsheetApi.list(opportunityId)
    // 加载已保存的 WBS
    const saved = getJSON(`aicc_wbs_${opportunityId}`)
    if (saved) {
      wbsData.value = saved
      workflowStep.value = 5
      expandedPhases.value = saved.phases.map((_, i) => i)
    }
  } finally {
    loading.value = false
  }
})

async function generateWBS() {
  if (!latestFactSheet.value) return
  generating.value = true
  try {
    const facts = latestFactSheet.value.facts
    const projectType = facts.project_type || 'landing_zone'
    const typeName = getProjectTypeName(projectType)

    // 读取报价数据和 SOW 数据
    const quotation = getJSON(`aicc_quotation_${opportunityId}`)
    const sow = getJSON(`aicc_sow_${opportunityId}`)

    // 按项目类型 + 报价数据生成 WBS
    wbsData.value = generateWBSByType(projectType, facts, quotation, sow, opportunityName.value)

    workflowStep.value = 5
    expandedPhases.value = wbsData.value.phases.map((_, i) => i)
    // 持久化到 IndexedDB
    setJSON(`aicc_wbs_${opportunityId}`, wbsData.value)

    const sourceMsg = wbsData.value.source === 'quotation' && hasQuotation.value
      ? `（基于报价${quotationTotalHours.value}人天分配）`
      : '（使用默认估算）'
    ElMessage.success(`${typeName}项目 WBS 生成完成${sourceMsg}`)
  } finally {
    generating.value = false
  }
}

async function exportWBS(format) {
  if (format === 'excel') {
    exportToExcel()
  } else if (format === 'word' || format === 'pdf') {
    if (!wbsData.value) {
      ElMessage.warning('请先生成 WBS')
      return
    }
    const sections = []
    wbsData.value.phases.forEach((phase, pIdx) => {
      sections.push({
        heading: `阶段 ${pIdx + 1}: ${phase.name} (${phase.duration})`,
        paragraphs: [`任务数: ${phase.tasks.length} | 人天: ${phaseDays(phase)}`],
        table: {
          headers: ['序号', '任务名称', '描述', '人天', '角色', '依赖', '交付物'],
          rows: phase.tasks.map((t, tIdx) => [
            String(tIdx + 1),
            t.name,
            t.description,
            String(t.duration_days),
            t.role,
            Array.isArray(t.dependencies) ? t.dependencies.join(', ') : (t.dependencies || '-'),
            t.deliverable || '-',
          ]),
        },
      })
    })
    const doc = {
      title: `WBS - ${opportunityName.value || '项目'}`,
      subtitle: `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm')} | 总任务: ${totalTasks.value} | 总人天: ${totalDays.value}`,
      sections,
    }
    try {
      ElMessage.info(`正在导出 ${format.toUpperCase()}...`)
      await exportDocument(format, doc, `WBS_${opportunityName.value || '项目'}_${dayjs().format('YYYYMMDD')}`, { orientation: 'landscape' })
      ElMessage.success(`WBS 已导出为 ${format.toUpperCase()}`)
    } catch (e) {
      ElMessage.error(`导出失败: ${e.message}`)
    }
  }
}

function exportToExcel() {
  if (!wbsData.value) {
    ElMessage.warning('请先生成 WBS')
    return
  }

  const detailRows = []
  const phaseRows = []

  wbsData.value.phases.forEach((phase, pIdx) => {
    phaseRows.push({
      阶段编号: `P${pIdx + 1}`,
      阶段名称: phase.name,
      周期: phase.duration,
      任务数: phase.tasks.length,
      人天: phaseDays(phase),
    })

    phase.tasks.forEach((task, tIdx) => {
      detailRows.push({
        阶段编号: `P${pIdx + 1}`,
        阶段名称: phase.name,
        序号: tIdx + 1,
        任务名称: task.name,
        描述: task.description,
        人天: task.duration_days,
        角色: task.role,
        依赖: Array.isArray(task.dependencies) ? task.dependencies.join(', ') : (task.dependencies || '-'),
        交付物: task.deliverable,
      })
    })
  })

  const wb = XLSX.utils.book_new()
  const detailWs = XLSX.utils.json_to_sheet(detailRows)
  const phaseWs = XLSX.utils.json_to_sheet(phaseRows)

  detailWs['!cols'] = [
    { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 24 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ]
  phaseWs['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ]

  XLSX.utils.book_append_sheet(wb, detailWs, 'WBS明细')
  XLSX.utils.book_append_sheet(wb, phaseWs, '阶段汇总')

  const fileName = `WBS_${opportunityName.value || '项目'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)

  ElMessage.success(`已导出 ${fileName}`)
}

function exportAll() {
  ElMessage.success('全部文档导出功能开发中...')
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

.wbs-summary {
  margin-bottom: 8px;
}

.summary-item {
  text-align: center;
  padding: 8px;
}

.summary-label {
  color: #909399;
  font-size: 12px;
  margin: 0 0 4px;
}

.summary-value {
  font-size: 22px;
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

.wbs-phase {
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  cursor: pointer;
  transition: background 0.2s;
}

.phase-header:hover {
  background: #f0f2f5;
}

.phase-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.phase-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.phase-meta {
  color: #909399;
  font-size: 13px;
}

.phase-tasks {
  padding: 0 16px 16px;
}

.gantt-chart {
  padding: 8px 0;
}

.gantt-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.gantt-label {
  width: 120px;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}

.gantt-bar-container {
  flex: 1;
  height: 28px;
  background: #f5f7fa;
  border-radius: 4px;
  position: relative;
}

.gantt-bar {
  position: absolute;
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  min-width: 40px;
}
</style>
