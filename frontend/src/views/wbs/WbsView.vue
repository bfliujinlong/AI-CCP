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
              <p style="color: #909399; margin-bottom: 24px">
                基于 Fact Sheet 数据，AI 将自动生成工作分解结构（Work Breakdown Structure）
              </p>
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

const totalTasks = computed(() => wbsData.value ? wbsData.value.phases.reduce((s, p) => s + p.tasks.length, 0) : 0)
const totalDays = computed(() => wbsData.value ? wbsData.value.phases.reduce((s, p) => s + phaseDays(p), 0) : 0)
const estimatedWeeks = computed(() => Math.ceil(totalDays.value / 5))

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
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
    const opp = await opportunityApi.get(opportunityId)
    opportunityName.value = opp.name
    factSheets.value = await factsheetApi.list(opportunityId)
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
    const vmCount = facts.vm_count || 0
    const dbCount = facts.database_count || 0
    const regionCount = facts.region_count || 1
    const accountCount = facts.account_count || 1
    const vpcCount = facts.vpc_count || 0

    if (projectType === 'landing_zone') {
      wbsData.value = {
        phases: [
          {
            name: '项目启动与评估', duration: '1周',
            tasks: [
              { name: '项目启动会', description: '确认项目范围、目标、团队', duration_days: 1, role: '项目经理', dependencies: [], deliverable: '项目章程' },
              { name: '现状调研', description: `调研${accountCount}个账号现状、${vmCount}台VM分布`, duration_days: 2, role: '云架构师', dependencies: ['项目启动会'], deliverable: '调研报告' },
              { name: '需求确认', description: '确认安全等级、合规要求、网络需求', duration_days: 2, role: '云架构师', dependencies: ['现状调研'], deliverable: '需求规格书' },
            ],
          },
          {
            name: '架构设计', duration: '2周',
            tasks: [
              { name: '账号体系设计', description: `设计${accountCount}个云账号的组织结构`, duration_days: 2, role: '云架构师', dependencies: ['需求确认'], deliverable: '账号架构图' },
              { name: '网络架构设计', description: `设计${regionCount}个Region、${vpcCount}个VPC的网络拓扑`, duration_days: 3, role: '网络工程师', dependencies: ['需求确认'], deliverable: '网络架构图' },
              { name: '安全架构设计', description: '设计IAM策略、安全组、加密方案', duration_days: 2, role: '安全顾问', dependencies: ['需求确认'], deliverable: '安全架构图' },
              { name: '治理架构设计', description: '设计标签策略、成本管理、合规审计', duration_days: 2, role: '云架构师', dependencies: ['账号体系设计'], deliverable: '治理方案' },
              { name: '架构评审', description: '客户评审架构方案', duration_days: 1, role: '项目总监', dependencies: ['网络架构设计', '安全架构设计', '治理架构设计'], deliverable: '评审纪要' },
            ],
          },
          {
            name: '实施部署', duration: '3周',
            tasks: [
              { name: 'Landing Zone 基础部署', description: '部署账号结构、Organization', duration_days: 2, role: '云工程师', dependencies: ['架构评审'], deliverable: '部署报告' },
              { name: '网络配置', description: `配置${regionCount}个Region的VPC和子网`, duration_days: 3, role: '网络工程师', dependencies: ['Landing Zone 基础部署'], deliverable: '网络配置文档' },
              { name: '安全配置', description: '配置IAM、安全组、WAF', duration_days: 3, role: '安全顾问', dependencies: ['Landing Zone 基础部署'], deliverable: '安全配置文档' },
              { name: '监控告警部署', description: '部署CloudMonitor、日志服务', duration_days: 2, role: '云工程师', dependencies: ['网络配置'], deliverable: '监控配置文档' },
              { name: '治理工具部署', description: '配置标签策略、成本管理工具', duration_days: 2, role: '云工程师', dependencies: ['安全配置'], deliverable: '治理配置文档' },
              { name: '集成测试', description: '端到端功能测试', duration_days: 3, role: '云工程师', dependencies: ['监控告警部署', '治理工具部署'], deliverable: '测试报告' },
            ],
          },
          {
            name: '验收与交付', duration: '1周',
            tasks: [
              { name: '安全审计', description: '执行安全合规审计', duration_days: 1, role: '安全顾问', dependencies: ['集成测试'], deliverable: '安全审计报告' },
              { name: '用户验收测试', description: '客户UAT测试', duration_days: 2, role: '项目经理', dependencies: ['安全审计'], deliverable: 'UAT报告' },
              { name: '文档交付', description: '交付运维手册、培训材料', duration_days: 1, role: '云架构师', dependencies: ['用户验收测试'], deliverable: '运维手册' },
              { name: '培训', description: '客户团队培训', duration_days: 1, role: '云架构师', dependencies: ['文档交付'], deliverable: '培训记录' },
              { name: '项目结项', description: '项目总结、经验沉淀', duration_days: 0.5, role: '项目总监', dependencies: ['培训'], deliverable: '结项报告' },
            ],
          },
        ],
      }
    } else if (projectType === 'migration') {
      wbsData.value = {
        phases: [
          {
            name: '迁移评估', duration: '2周',
            tasks: [
              { name: '资产盘点', description: `盘点${vmCount}台VM和${dbCount}个数据库`, duration_days: 3, role: '云架构师', dependencies: [], deliverable: '资产清单' },
              { name: '迁移可行性分析', description: '分析每台VM/DB的迁移可行性', duration_days: 3, role: '云架构师', dependencies: ['资产盘点'], deliverable: '可行性报告' },
              { name: '迁移策略制定', description: '制定Rehost/Replatform/Refactor策略', duration_days: 2, role: '云架构师', dependencies: ['迁移可行性分析'], deliverable: '迁移策略文档' },
              { name: '工具选型', description: '选择迁移工具和方案', duration_days: 2, role: '云工程师', dependencies: ['迁移策略制定'], deliverable: '工具选型报告' },
            ],
          },
          {
            name: '迁移设计', duration: '2周',
            tasks: [
              { name: '目标架构设计', description: '设计云上目标架构', duration_days: 3, role: '云架构师', dependencies: ['工具选型'], deliverable: '目标架构图' },
              { name: '迁移方案设计', description: '设计分批迁移方案和回滚策略', duration_days: 3, role: '云架构师', dependencies: ['目标架构设计'], deliverable: '迁移方案' },
              { name: '网络方案设计', description: '设计混合云网络连通方案', duration_days: 2, role: '网络工程师', dependencies: ['目标架构设计'], deliverable: '网络方案' },
              { name: '方案评审', description: '客户评审迁移方案', duration_days: 1, role: '项目总监', dependencies: ['迁移方案设计', '网络方案设计'], deliverable: '评审纪要' },
            ],
          },
          {
            name: '迁移实施', duration: '4周',
            tasks: [
              { name: '环境准备', description: '准备目标云环境', duration_days: 2, role: '云工程师', dependencies: ['方案评审'], deliverable: '环境就绪报告' },
              { name: 'POC迁移', description: '选择3-5台VM进行POC', duration_days: 3, role: '云工程师', dependencies: ['环境准备'], deliverable: 'POC报告' },
              { name: '第一批迁移', description: `迁移${Math.ceil(vmCount * 0.3)}台VM`, duration_days: 5, role: '云工程师', dependencies: ['POC迁移'], deliverable: '迁移报告' },
              { name: '第二批迁移', description: `迁移${Math.ceil(vmCount * 0.4)}台VM和${Math.ceil(dbCount * 0.5)}个DB`, duration_days: 5, role: '云工程师', dependencies: ['第一批迁移'], deliverable: '迁移报告' },
              { name: '第三批迁移', description: `迁移剩余VM和DB`, duration_days: 5, role: '云工程师', dependencies: ['第二批迁移'], deliverable: '迁移报告' },
            ],
          },
          {
            name: '割接与验证', duration: '2周',
            tasks: [
              { name: '数据同步验证', description: '验证数据一致性', duration_days: 2, role: '云工程师', dependencies: ['第三批迁移'], deliverable: '验证报告' },
              { name: '业务割接', description: '正式切换流量到云上', duration_days: 2, role: '项目经理', dependencies: ['数据同步验证'], deliverable: '割接报告' },
              { name: '性能测试', description: '云上性能压测', duration_days: 2, role: '云工程师', dependencies: ['业务割接'], deliverable: '性能报告' },
              { name: '优化调整', description: '根据测试结果优化配置', duration_days: 2, role: '云架构师', dependencies: ['性能测试'], deliverable: '优化报告' },
              { name: '项目结项', description: '项目总结与交付', duration_days: 1, role: '项目总监', dependencies: ['优化调整'], deliverable: '结项报告' },
            ],
          },
        ],
      }
    } else {
      wbsData.value = {
        phases: [
          {
            name: '需求分析', duration: '2周',
            tasks: [
              { name: '需求调研', description: '业务需求梳理', duration_days: 3, role: '云架构师', dependencies: [], deliverable: '需求文档' },
              { name: '技术评估', description: '技术可行性评估', duration_days: 3, role: '云架构师', dependencies: ['需求调研'], deliverable: '评估报告' },
              { name: '方案设计', description: '整体方案设计', duration_days: 4, role: '云架构师', dependencies: ['技术评估'], deliverable: '方案文档' },
            ],
          },
          {
            name: '实施部署', duration: '4周',
            tasks: [
              { name: '环境搭建', description: '基础环境搭建', duration_days: 3, role: '云工程师', dependencies: ['方案设计'], deliverable: '环境报告' },
              { name: '核心功能实施', description: '核心功能开发部署', duration_days: 10, role: '云工程师', dependencies: ['环境搭建'], deliverable: '实施报告' },
              { name: '测试验证', description: '功能与性能测试', duration_days: 5, role: '云工程师', dependencies: ['核心功能实施'], deliverable: '测试报告' },
            ],
          },
          {
            name: '交付验收', duration: '1周',
            tasks: [
              { name: '文档交付', description: '交付运维文档', duration_days: 2, role: '云架构师', dependencies: ['测试验证'], deliverable: '运维手册' },
              { name: '培训与结项', description: '团队培训和项目结项', duration_days: 2, role: '项目总监', dependencies: ['文档交付'], deliverable: '结项报告' },
            ],
          },
        ],
      }
    }

    workflowStep.value = 5
    expandedPhases.value = wbsData.value.phases.map((_, i) => i)
    ElMessage.success('WBS 生成完成')
  } finally {
    generating.value = false
  }
}

function exportWBS(format) {
  ElMessage.success(`${format.toUpperCase()} 导出功能开发中...`)
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
