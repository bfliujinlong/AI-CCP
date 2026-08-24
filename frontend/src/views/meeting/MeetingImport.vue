<template>
  <div class="meeting-import">
    <!-- Header -->
    <div class="page-header">
      <h2>会议智能导入</h2>
      <p class="sub-title">上传会议录音/录屏/纪要，AI 自动创建客户、商机，并生成报价单、WBS、SOW 和项目计划</p>
    </div>

    <!-- LLM 未配置警告 -->
    <el-alert
      v-if="!llmEnabled"
      title="LLM 未配置"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <template #default>
        当前未配置 LLM，将使用 Mock 数据演示。请前往
        <el-link type="primary" @click="router.push('/settings')">系统设置</el-link>
        配置 LLM 后再使用。
      </template>
    </el-alert>

    <!-- Step 1: 输入 -->
    <el-card v-if="currentStep === 'input'" shadow="never">
      <el-tabs v-model="inputTab" @tab-change="(name) => name === 'history' && loadHistory()">
        <!-- 粘贴文本 -->
        <el-tab-pane label="粘贴会议纪要" name="text">
          <el-input
            v-model="meetingText"
            type="textarea"
            :rows="12"
            placeholder="请粘贴会议纪要、客户沟通记录、需求访谈记录等文本内容...&#10;&#10;例如：&#10;今天和XX公司的张总开了项目沟通会，他们计划将现有300台虚拟机从IDC迁移到阿里云，涉及15个数据库，需要在3个月内完成..."
            maxlength="50000"
            show-word-limit
          />
          <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center">
            <span style="color: #909399; font-size: 13px">
              <el-icon><InfoFilled /></el-icon>
              支持会议纪要、沟通记录、需求文档等任意文本
            </span>
            <el-button
              type="primary"
              size="large"
              :disabled="!meetingText.trim()"
              @click="startAnalysis"
            >
              <el-icon><MagicStick /></el-icon>
              开始 AI 分析
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 上传文件 -->
        <el-tab-pane label="上传文件" name="file">
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept=".txt,.md,.csv,.json,.log,.docx,.mp3,.wav,.m4a,.flac,.ogg,.webm,.mp4"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持文本文件 (.txt/.md/.docx) 和音频文件 (.mp3/.wav/.m4a)
              </div>
            </template>
          </el-upload>

          <!-- 音频转录配置 -->
          <div v-if="selectedFile && isAudioFile(selectedFile)" style="margin-top: 16px">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>音频文件需要转录为文本</template>
              <template #default>
                将使用已配置的 LLM Provider 调用音频转录 API。
                <span v-if="!llmEnabled" style="color: #e6a23c">请先配置 LLM。</span>
              </template>
            </el-alert>
          </div>

          <div style="margin-top: 16px; display: flex; justify-content: flex-end">
            <el-button
              type="primary"
              size="large"
              :disabled="!selectedFile"
              @click="startAnalysis"
            >
              <el-icon><MagicStick /></el-icon>
              开始 AI 分析
            </el-button>
          </div>
        </el-tab-pane>

        <!-- 示例 -->
        <el-tab-pane label="使用示例" name="example">
          <el-card shadow="never" style="background: #f5f7fa">
            <pre style="white-space: pre-wrap; font-size: 13px; line-height: 1.8">{{ exampleText }}</pre>
          </el-card>
          <div style="margin-top: 12px; text-align: right">
            <el-button type="primary" @click="useExample">使用此示例</el-button>
          </div>
        </el-tab-pane>

        <!-- 导入历史 -->
        <el-tab-pane label="导入历史" name="history">
          <div v-loading="historyLoading">
            <el-table v-if="historyList.length > 0" :data="historyList" border size="small" style="width: 100%">
              <el-table-column prop="created_at" label="导入时间" width="160">
                <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
              </el-table-column>
              <el-table-column prop="username" label="操作人" width="100" />
              <el-table-column prop="customer_name" label="客户名称" min-width="120" />
              <el-table-column prop="opportunity_name" label="商机名称" min-width="150" />
              <el-table-column prop="project_type" label="项目类型" width="100">
                <template #default="{ row }">{{ formatProjectType(row.project_type) }}</template>
              </el-table-column>
              <el-table-column prop="input_type" label="输入方式" width="90">
                <template #default="{ row }">{{ formatInputType(row.input_type) }}</template>
              </el-table-column>
              <el-table-column label="生成结果" width="140" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.has_quotation" size="small" type="success" style="margin-right: 2px">报价</el-tag>
                  <el-tag v-if="row.has_sow" size="small" type="warning" style="margin-right: 2px">SOW</el-tag>
                  <el-tag v-if="row.has_wbs" size="small" type="info">WBS</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120" align="center">
                <template #default="{ row }">
                  <el-button v-if="row.opportunity_id" size="small" link type="primary" @click="router.push(`/opportunities/${row.opportunity_id}`)">查看商机</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无导入记录" />
            <div v-if="historyTotal > 20" style="margin-top: 12px; text-align: center">
              <el-pagination
                v-model:current-page="historyPage"
                :total="historyTotal"
                :page-size="20"
                layout="prev, pager, next"
                @current-change="loadHistory"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- Step 2: 处理中 -->
    <el-card v-if="currentStep === 'processing'" shadow="never">
      <div style="text-align: center; margin-bottom: 24px">
        <h3>AI 正在分析会议内容...</h3>
        <p style="color: #909399">请稍候，整个流程约需 1-3 分钟</p>
      </div>

      <div class="pipeline-steps">
        <div
          v-for="(step, index) in pipelineSteps"
          :key="index"
          class="pipeline-step"
          :class="step.status"
        >
          <div class="step-icon">
            <el-icon v-if="step.status === 'completed'"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="step.status === 'processing'" class="is-loading"><Loading /></el-icon>
            <el-icon v-else-if="step.status === 'failed'"><CircleCloseFilled /></el-icon>
            <el-icon v-else><Clock /></el-icon>
          </div>
          <div class="step-content">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-desc">{{ step.desc }}</div>
            <div v-if="step.detail" class="step-detail">{{ step.detail }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Step 3: 结果展示 -->
    <div v-if="currentStep === 'results'">
      <!-- 成功提示 -->
      <el-alert
        title="分析完成！已自动创建客户和商机，并生成报价单、SOW、WBS"
        type="success"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />

      <!-- 客户 & 商机 -->
      <el-row :gutter="16" style="margin-bottom: 16px">
        <el-col :span="12">
          <el-card shadow="never" class="result-card">
            <template #header>
              <div class="card-header">
                <el-icon><OfficeBuilding /></el-icon>
                <span>客户信息</span>
                <el-tag v-if="results.customer" type="success" size="small">已创建</el-tag>
              </div>
            </template>
            <div v-if="results.customer" class="info-grid">
              <div class="info-item"><label>客户名称</label><span>{{ results.customer.name }}</span></div>
              <div class="info-item"><label>行业</label><span>{{ results.customer.industry || '-' }}</span></div>
              <div class="info-item"><label>联系人</label><span>{{ results.customer.contact_name || '-' }}</span></div>
              <div class="info-item"><label>联系电话</label><span>{{ results.customer.contact_phone || '-' }}</span></div>
              <div class="info-item" v-if="results.customer.description"><label>描述</label><span class="desc">{{ results.customer.description }}</span></div>
            </div>
            <el-button v-if="results.customer" type="primary" link @click="router.push(`/customers/${results.customer.id}`)">
              查看详情 →
            </el-button>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never" class="result-card">
            <template #header>
              <div class="card-header">
                <el-icon><Opportunity /></el-icon>
                <span>商机信息</span>
                <el-tag v-if="results.opportunity" type="success" size="small">已创建</el-tag>
              </div>
            </template>
            <div v-if="results.opportunity" class="info-grid">
              <div class="info-item"><label>商机名称</label><span>{{ results.opportunity.name }}</span></div>
              <div class="info-item"><label>类型</label><span>{{ formatOppType(results.opportunity.type) }}</span></div>
              <div class="info-item"><label>预估金额</label><span>¥{{ formatNumber(results.opportunity.estimated_revenue) }}</span></div>
              <div class="info-item"><label>成交概率</label><span>{{ results.opportunity.probability }}%</span></div>
              <div class="info-item" v-if="results.opportunity.description"><label>描述</label><span class="desc">{{ results.opportunity.description }}</span></div>
            </div>
            <el-button v-if="results.opportunity" type="primary" link @click="router.push(`/opportunities/${results.opportunity.id}`)">
              查看详情 →
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <!-- 报价单 -->
      <el-card shadow="never" class="result-card" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <el-icon><Money /></el-icon>
            <span>报价单</span>
            <el-tag v-if="results.quotation" type="success" size="small">已生成</el-tag>
          </div>
        </template>
        <div v-if="results.quotation">
          <el-table :data="results.quotation.cost_breakdown" border size="small" style="width: 100%">
            <el-table-column prop="item" label="项目" min-width="120" />
            <el-table-column prop="description" label="描述" min-width="200" />
            <el-table-column prop="days" label="人天" width="80" align="center" />
            <el-table-column prop="rate" label="单价" width="100" align="right">
              <template #default="{ row }">¥{{ formatNumber(row.rate) }}</template>
            </el-table-column>
            <el-table-column prop="total" label="小计" width="120" align="right">
              <template #default="{ row }">¥{{ formatNumber(row.total) }}</template>
            </el-table-column>
          </el-table>
          <div class="quotation-summary">
            <span>总人天: <strong>{{ results.quotation.total_days }}</strong> 天</span>
            <span>总费用: <strong class="total-cost">¥{{ formatNumber(results.quotation.total_cost) }}</strong></span>
          </div>
        </div>
        <el-button v-if="results.opportunity" type="primary" link @click="router.push(`/quotation/${results.opportunity.id}`)">
          查看完整报价 →
        </el-button>
      </el-card>

      <!-- SOW -->
      <el-card shadow="never" class="result-card" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <el-icon><Notebook /></el-icon>
            <span>工作说明书 (SOW)</span>
            <el-tag v-if="results.sow" type="success" size="small">已生成</el-tag>
          </div>
        </template>
        <div v-if="results.sow">
          <h4>{{ results.sow.title }}</h4>
          <p class="sow-overview">{{ results.sow.project_overview }}</p>
          <el-row :gutter="16">
            <el-col :span="12">
              <h5>项目范围</h5>
              <ul class="scope-list">
                <li v-for="(item, i) in results.sow.scope_items" :key="i">
                  <el-tag size="small" :type="item.included ? 'success' : 'info'">{{ item.category }}</el-tag>
                  {{ item.item }}
                </li>
              </ul>
            </el-col>
            <el-col :span="12">
              <h5>交付物</h5>
              <ul class="deliverable-list">
                <li v-for="(d, i) in results.sow.deliverables" :key="i">
                  <strong>{{ d.name }}</strong> — {{ d.description }}
                  <el-tag size="small" type="warning">第{{ d.due_week }}周</el-tag>
                </li>
              </ul>
            </el-col>
          </el-row>
          <h5 style="margin-top: 12px">项目时间线</h5>
          <el-timeline>
            <el-timeline-item v-for="(t, i) in results.sow.timeline" :key="i" :timestamp="t.duration" placement="top">
              <strong>{{ t.phase }}</strong>
              <div v-if="t.milestones" style="font-size: 13px; color: #606266">
                里程碑: {{ Array.isArray(t.milestones) ? t.milestones.join('、') : t.milestones }}
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
        <el-button v-if="results.opportunity" type="primary" link @click="router.push(`/sow/${results.opportunity.id}`)">
          查看完整 SOW →
        </el-button>
      </el-card>

      <!-- WBS -->
      <el-card shadow="never" class="result-card" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <el-icon><Grid /></el-icon>
            <span>工作分解结构 (WBS)</span>
            <el-tag v-if="results.wbs" type="success" size="small">已生成</el-tag>
          </div>
        </template>
        <div v-if="results.wbs">
          <el-table :data="flattenWbs(results.wbs.phases)" border size="small" style="width: 100%">
            <el-table-column prop="phase" label="阶段" width="120" />
            <el-table-column prop="name" label="任务" min-width="180" />
            <el-table-column prop="duration_days" label="工期(天)" width="80" align="center" />
            <el-table-column prop="role" label="角色" width="100" />
            <el-table-column prop="dependencies" label="依赖" width="120" />
            <el-table-column prop="deliverable" label="交付物" min-width="120" />
          </el-table>
          <div class="quotation-summary">
            <span>总工期: <strong>{{ results.wbs.total_days }}</strong> 天</span>
          </div>
        </div>
        <el-button v-if="results.opportunity" type="primary" link @click="router.push(`/wbs/${results.opportunity.id}`)">
          查看完整 WBS →
        </el-button>
      </el-card>

      <!-- 操作按钮 -->
      <div style="text-align: center; margin-top: 24px">
        <el-button @click="resetAll">重新分析</el-button>
        <el-button type="primary" @click="goToDashboard">返回 Dashboard</el-button>
      </div>
    </div>

    <!-- 错误提示 -->
    <el-dialog v-model="showError" title="分析失败" width="500px">
      <el-alert :title="errorMsg" type="error" show-icon :closable="false" />
      <div style="text-align: center; margin-top: 16px">
        <el-button @click="showError = false">关闭</el-button>
        <el-button type="primary" @click="resetAll">重新开始</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { customerApi, opportunityApi, skillApi, factsheetApi, meetingApi, meetingHistoryApi } from '@/api'
import { callLLMStructured, isLLMEnabled, loadLLMConfig } from '@/api/mock'
import { getJSON, setJSON } from '@/utils/db'

const router = useRouter()
const llmEnabled = computed(() => isLLMEnabled())

// --- 状态 ---
const currentStep = ref('input') // input | processing | results
const inputTab = ref('text')
const meetingText = ref('')
const selectedFile = ref(null)
const uploadRef = ref(null)
const showError = ref(false)
const errorMsg = ref('')

// --- 历史记录 ---
const historyList = ref([])
const historyLoading = ref(false)
const historyTotal = ref(0)
const historyPage = ref(1)

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await meetingHistoryApi.list({ page: historyPage.value, page_size: 20 })
    historyList.value = res.data.items || []
    historyTotal.value = res.data.total || 0
  } catch (err) {
    console.warn('加载历史记录失败:', err)
    // 静默失败，不影响页面
  } finally {
    historyLoading.value = false
  }
}

function formatDateTime(dt) {
  if (!dt) return '-'
  const d = new Date(dt)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatInputType(t) {
  return { text: '文本粘贴', file: '文件上传', example: '示例' }[t] || t || '-'
}

function formatProjectType(t) {
  return { landing_zone: 'Landing Zone', migration: '云迁移', big_data: '大数据', hybrid_cloud: '混合云', security: '安全合规', cost_optimization: '成本优化' }[t] || t || '-'
}

onMounted(() => {
  loadHistory()
})

// --- Pipeline 步骤 ---
const pipelineSteps = reactive([
  { title: '内容解析', desc: '提取/转录文件内容', status: 'pending', detail: '' },
  { title: 'AI 信息提取', desc: '从会议内容中提取客户、商机、需求信息', status: 'pending', detail: '' },
  { title: '创建客户', desc: '自动创建客户记录', status: 'pending', detail: '' },
  { title: '创建商机', desc: '自动创建商机记录', status: 'pending', detail: '' },
  { title: '生成报价单', desc: 'AI 基于需求生成项目报价', status: 'pending', detail: '' },
  { title: '生成 SOW', desc: 'AI 生成工作说明书', status: 'pending', detail: '' },
  { title: '生成 WBS', desc: 'AI 生成工作分解结构', status: 'pending', detail: '' },
])

// --- 结果 ---
const results = reactive({
  customer: null,
  opportunity: null,
  quotation: null,
  sow: null,
  wbs: null,
  extractedData: null,
})

// --- 示例文本 ---
const exampleText = `2026年7月15日 项目沟通会议纪要

参会人员：
- 甲方：张明（CIO）、李华（IT总监）、王芳（架构师）
- 乙方：陈顾问（云架构师）、刘经理（项目经理）

会议内容：
1. 客户背景：中通快递集团，物流行业，总部在上海，全国有200+转运中心
2. 当前痛点：现有IDC机房即将到期，300台物理服务器和50台虚拟机需要迁移，15个Oracle数据库需要上云，运维成本居高不下
3. 项目目标：将核心业务系统迁移到阿里云，建设Landing Zone基础架构，3个月内完成
4. 预算：约500万人民币
5. 技术要求：
   - 需要多账号体系（预计5个账号）
   - 需要满足等保2.0三级要求
   - 需要跨2个Region部署（上海、北京）
   - 预计10个VPC
   - 需要自动化运维体系
6. 联系方式：张明 zhangming@zto.com 138-xxxx-xxxx
7. 下一步：本周内完成需求确认，下周出方案和报价`

// --- 方法 ---
function isAudioFile(file) {
  if (!file) return false
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'mp4'].includes(ext)
}

function handleFileChange(file) {
  selectedFile.value = file.raw
}

function handleFileRemove() {
  selectedFile.value = null
}

function useExample() {
  meetingText.value = exampleText
  inputTab.value = 'text'
  ElMessage.success('已填入示例文本')
}

function formatNumber(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toLocaleString('zh-CN')
}

function formatOppType(type) {
  const map = {
    landing_zone: 'Landing Zone',
    migration: '云迁移',
    big_data: '大数据',
    hybrid_cloud: '混合云',
    security: '安全合规',
    cost_optimization: '成本优化',
  }
  return map[type] || type || '-'
}

function flattenWbs(phases) {
  if (!phases) return []
  const rows = []
  for (const phase of phases) {
    if (phase.tasks) {
      for (const task of phase.tasks) {
        rows.push({
          phase: phase.name,
          name: task.name,
          duration_days: task.duration_days,
          role: task.role,
          dependencies: task.dependencies,
          deliverable: task.deliverable,
        })
      }
    } else {
      rows.push({ phase: phase.name, name: '-', duration_days: '-', role: '-', dependencies: '-', deliverable: '-' })
    }
  }
  return rows
}

function updateStep(index, status, detail = '') {
  pipelineSteps[index].status = status
  pipelineSteps[index].detail = detail
}

// --- 核心：开始分析 ---
async function startAnalysis() {
  currentStep.value = 'processing'
  // 重置步骤
  pipelineSteps.forEach(s => { s.status = 'pending'; s.detail = '' })

  try {
    // Step 0: 内容解析
    let text = ''
    if (selectedFile.value) {
      updateStep(0, 'processing', `正在处理文件: ${selectedFile.value.name}`)
      text = await resolveFileContent(selectedFile.value)
      updateStep(0, 'completed', `提取到 ${text.length} 个字符`)
    } else {
      text = meetingText.value
      updateStep(0, 'completed', `文本输入: ${text.length} 个字符`)
    }

    if (!text || text.trim().length < 10) {
      throw new Error('会议内容过短，请提供更多文本信息')
    }

    // Step 1: AI 信息提取
    updateStep(1, 'processing', '正在调用 AI 提取结构化信息...')
    const extracted = await extractMeetingInfo(text)
    results.extractedData = extracted
    updateStep(1, 'completed', `客户: ${extracted.customer.name} | 商机: ${extracted.opportunity.name}`)

    // Step 2: 创建客户
    updateStep(2, 'processing', `正在创建客户: ${extracted.customer.name}`)
    const customer = await customerApi.create({
      name: extracted.customer.name,
      industry: extracted.customer.industry || null,
      contact_name: extracted.customer.contact_name || null,
      contact_email: extracted.customer.contact_email || null,
      contact_phone: extracted.customer.contact_phone || null,
      address: extracted.customer.address || null,
      description: extracted.customer.description || null,
    })
    results.customer = customer
    updateStep(2, 'completed', `客户创建成功 (ID: ${customer.id?.toString().slice(0, 8)}...)`)

    // Step 3: 创建商机
    updateStep(3, 'processing', `正在创建商机: ${extracted.opportunity.name}`)
    const opportunity = await opportunityApi.create({
      name: extracted.opportunity.name,
      customer_id: customer.id,
      type: extracted.opportunity.type || 'landing_zone',
      status: 'discovery',
      estimated_revenue: extracted.opportunity.estimated_revenue || null,
      probability: extracted.opportunity.probability || 50,
      description: extracted.opportunity.description || null,
    })
    results.opportunity = opportunity
    updateStep(3, 'completed', `商机创建成功 (ID: ${opportunity.id?.toString().slice(0, 8)}...)`)

    // 准备 facts 数据供后续生成
    const facts = buildFacts(extracted, opportunity)

    // Step 3.5: 保存 FactSheet 到后端数据库（供 SOW/WBS 页面读取）
    updateStep(3, 'completed', `商机+FactSheet已创建 (ID: ${opportunity.id?.toString().slice(0, 8)}...)`)
    try {
      await factsheetApi.create({
        opportunity_id: opportunity.id,
        category: 'meeting_import',
        facts: facts,
      })
    } catch (err) {
      console.warn('FactSheet 保存到后端失败（不影响后续步骤）:', err.message)
    }

    // Step 4: 生成报价单（始终使用本地模板生成，确保一定有完整内容）
    // LLM 仅在本地模板生成完成后，作为可选的覆盖增强（如果 LLM 返回完整数据）
    updateStep(4, 'processing', '正在生成报价单...')
    let quotationResult = generateQuotationLocal(extracted.requirements, opportunity)
    if (llmEnabled.value) {
      try {
        const quotResult = await skillApi.execute({
          skill_name: 'Generate-Quotation',
          inputs: { facts: JSON.stringify(facts) },
        })
        if (isQuotationValid(quotResult.outputs) && quotResult.outputs.cost_breakdown.length >= 5) {
          quotationResult = quotResult.outputs
          updateStep(4, 'completed', `AI 生成: 总费用 ¥${formatNumber(quotationResult.total_cost)}`)
        } else {
          updateStep(4, 'completed', `本地生成: 总费用 ¥${formatNumber(quotationResult.total_cost)}`)
        }
      } catch (err) {
        updateStep(4, 'completed', `本地生成: 总费用 ¥${formatNumber(quotationResult.total_cost)}`)
      }
    } else {
      updateStep(4, 'completed', `本地生成: 总费用 ¥${formatNumber(quotationResult.total_cost)}`)
    }
    results.quotation = quotationResult

    // Step 5: 生成 SOW（始终使用本地模板，确保完整）
    updateStep(5, 'processing', '正在生成工作说明书...')
    let sowResultFinal = generateSowLocal(extracted.requirements, opportunity)
    if (llmEnabled.value) {
      try {
        const sowResult = await skillApi.execute({
          skill_name: 'Generate-SOW',
          inputs: { facts: JSON.stringify(facts) },
        })
        if (isSowValid(sowResult.outputs) && sowResult.outputs.scope_items.length >= 3 && sowResult.outputs.deliverables?.length >= 3) {
          sowResultFinal = sowResult.outputs
          updateStep(5, 'completed', `AI 生成: ${sowResultFinal.title?.slice(0, 30) || ''}`)
        } else {
          updateStep(5, 'completed', `本地生成: ${sowResultFinal.title.slice(0, 30)}`)
        }
      } catch (err) {
        updateStep(5, 'completed', `本地生成: ${sowResultFinal.title.slice(0, 30)}`)
      }
    } else {
      updateStep(5, 'completed', `本地生成: ${sowResultFinal.title.slice(0, 30)}`)
    }
    results.sow = sowResultFinal

    // Step 6: 生成 WBS（始终使用本地模板，确保完整）
    updateStep(6, 'processing', '正在生成工作分解结构...')
    let wbsResultFinal = generateWbsLocal(extracted.requirements, opportunity)
    if (llmEnabled.value) {
      try {
        const wbsResult = await skillApi.execute({
          skill_name: 'Generate-WBS',
          inputs: { facts: JSON.stringify(facts) },
        })
        if (isWbsValid(wbsResult.outputs) && wbsResult.outputs.phases.length >= 3) {
          wbsResultFinal = wbsResult.outputs
          updateStep(6, 'completed', `AI 生成: ${wbsResultFinal.total_days} 天`)
        } else {
          updateStep(6, 'completed', `本地生成: ${wbsResultFinal.total_days} 天`)
        }
      } catch (err) {
        updateStep(6, 'completed', `本地生成: ${wbsResultFinal.total_days} 天`)
      }
    } else {
      updateStep(6, 'completed', `本地生成: ${wbsResultFinal.total_days} 天`)
    }
    results.wbs = wbsResultFinal

    // 保存结果到 IndexedDB（便于后续页面读取）
    saveResultsToStorage(opportunity.id, results)

    // 记录导入历史到后端数据库
    try {
      await meetingHistoryApi.record({
        customer_id: customer.id,
        customer_name: customer.name,
        opportunity_id: opportunity.id,
        opportunity_name: opportunity.name,
        project_type: extracted.opportunity?.type || 'landing_zone',
        input_type: selectedFile.value ? 'file' : 'text',
        input_filename: selectedFile.value?.name || null,
        meeting_summary: text.slice(0, 500),
        status: 'completed',
        has_quotation: !!results.quotation,
        has_sow: !!results.sow,
        has_wbs: !!results.wbs,
      })
      loadHistory() // 刷新历史列表
    } catch (err) {
      console.warn('记录导入历史失败（不影响结果）:', err)
    }

    // 完成
    currentStep.value = 'results'
    ElMessage.success('分析完成！')
  } catch (err) {
    console.error('Meeting analysis failed:', err)
    errorMsg.value = err.message || '分析过程中出现未知错误'
    showError.value = true
    currentStep.value = 'input'
  }
}

// --- 文件内容解析 ---
async function resolveFileContent(file) {
  if (isAudioFile(file)) {
    // 音频转录
    if (!llmEnabled.value) {
      throw new Error('音频转录需要配置 LLM，请先在系统设置中配置')
    }
    const cfg = loadLLMConfig()
    const res = await meetingApi.transcribe(file, cfg)
    return res.data.transcript
  } else {
    // 文本/文档提取
    const res = await meetingApi.extractText(file)
    return res.data.text
  }
}

// --- AI 提取会议信息 ---
async function extractMeetingInfo(text) {
  const systemPrompt = `你是一位资深的云咨询业务分析师。请分析会议内容，提取结构化的客户和商机信息。

要求：
1. 从会议纪要/沟通记录中识别客户信息（名称、行业、联系人等）
2. 识别商机信息（项目名称、类型、预算等）
3. 提取技术需求（基础设施规模、云平台、安全要求等）
4. 如果某些信息在文本中未明确提及，请根据上下文合理推断，或填入 null

项目类型必须从以下选项中选择：
- landing_zone: Landing Zone 基础架构建设
- migration: 云迁移
- big_data: 大数据平台
- hybrid_cloud: 混合云
- security: 安全合规
- cost_optimization: 成本优化`

  const userPrompt = `请分析以下会议内容并提取结构化信息：

---会议内容---
${text}
---会议内容结束---

请返回严格的 JSON 格式（不要 markdown 代码块），结构如下：
{
  "customer": {
    "name": "客户名称（必填）",
    "industry": "所属行业",
    "contact_name": "联系人姓名",
    "contact_email": "联系人邮箱",
    "contact_phone": "联系人电话",
    "address": "地址",
    "description": "客户简要描述"
  },
  "opportunity": {
    "name": "商机/项目名称（必填，简洁专业）",
    "type": "项目类型(landing_zone/migration/big_data/hybrid_cloud/security/cost_optimization)",
    "estimated_revenue": 预估金额(数字，无引号),
    "probability": 成交概率(0-100整数),
    "description": "商机简要描述"
  },
  "requirements": {
    "project_type": "项目类型",
    "current_cloud": "当前云平台(on_premise/aws/azure/aliyun/huawei/tencent)",
    "target_cloud": "目标云平台(aws/azure/aliyun/huawei/tencent)",
    "vm_count": 虚拟机数量(整数),
    "database_count": 数据库数量(整数),
    "region_count": Region数量(整数),
    "account_count": 云账号数量(整数),
    "vpc_count": VPC数量(整数),
    "security_level": "安全等级(basic/medium/advanced)",
    "compliance_requirements": ["合规要求"],
    "timeline_months": 项目周期月数(整数),
    "budget": "预算范围",
    "key_technologies": ["关键技术"],
    "pain_points": ["痛点"],
    "goals": ["目标"]
  }
}`

  const result = await callLLMStructured(userPrompt, systemPrompt, 'customer 对象、opportunity 对象、requirements 对象')

  // 验证必要字段
  if (!result.customer?.name) {
    throw new Error('AI 未能从会议内容中提取到客户名称，请提供更详细的会议信息')
  }
  if (!result.opportunity?.name) {
    throw new Error('AI 未能从会议内容中提取到商机名称，请提供更详细的会议信息')
  }

  return result
}

// --- 构建 facts 对象 ---
function buildFacts(extracted, opportunity) {
  const req = extracted.requirements || {}
  return {
    project_type: req.project_type || opportunity.type || 'landing_zone',
    current_cloud: req.current_cloud || 'on_premise',
    target_cloud: req.target_cloud || 'aliyun',
    vm_count: req.vm_count || 100,
    database_count: req.database_count || 10,
    region_count: req.region_count || 1,
    account_count: req.account_count || 1,
    vpc_count: req.vpc_count || 2,
    security_level: req.security_level || 'medium',
    compliance_requirements: req.compliance_requirements || [],
    timeline_months: req.timeline_months || 3,
    budget: req.budget || '',
    key_technologies: req.key_technologies || [],
    pain_points: req.pain_points || [],
    goals: req.goals || [],
    customer_name: extracted.customer?.name || '',
    opportunity_name: opportunity.name,
    raw_text: 'meeting analysis',
  }
}

// --- 保存结果到 IndexedDB（按各页面的期望格式转换）---
function saveResultsToStorage(opportunityId, results) {
  try {
    // 1) 报价单：QuotationView 期望 { input: {...}, saved_at }
    //    - 它的 onMounted 会读 saved.input 合并到表单，然后 recalculate()
    //    - 所以必须把 AI 提取的 requirements 映射成 QuotationView 的 input 格式
    if (results.extractedData?.requirements) {
      const quotationInput = buildQuotationInput(results.extractedData.requirements)
      setJSON(`aicc_quotation_${opportunityId}`, {
        input: quotationInput,
        saved_at: new Date().toISOString(),
        source: 'meeting_import',
      })
    }

    // 2) SOW：SowView 期望 sowContent 含 title/project_overview/scope/scope_items/
    //    deliverables(render 'milestone' 字段)/assumptions/risks(render 'risk' 字段)/
    //    timeline(字符串)/milestones(独立数组)/team/acceptance_criteria
    if (results.sow) {
      const sowForView = transformSowForView(results.sow)
      setJSON(`aicc_sow_${opportunityId}`, sowForView)
    }

    // 3) WBS：WbsView 期望 { phases: [{ name, duration, tasks: [...] }] }
    //    AI 输出已兼容，仅需确保 duration 是可被 parseWeeks() 解析的字符串
    if (results.wbs) {
      const wbsForView = transformWbsForView(results.wbs)
      setJSON(`aicc_wbs_${opportunityId}`, wbsForView)
    }

    // 4) FactSheet 快照（IndexedDB 备份，供前端其他页面用）
    if (results.extractedData?.requirements) {
      setJSON(`aicc_factsheet_${opportunityId}`, results.extractedData.requirements)
    }
  } catch (err) {
    console.warn('Failed to save results to storage:', err)
  }
}

// --- 把 AI 提取的 requirements 映射成 QuotationView 的 input 格式 ---
function buildQuotationInput(req) {
  // QuotationView 的 getDefaultInput() 结构：{ resources, techStack, complexity, apps, migrationItems, rates, counts }
  const dbTotal = Number(req.database_count) || 0
  // 简单按总数拆分到 MySQL/Oracle（实际项目里可以更细化）
  const databases = { mysql: Math.ceil(dbTotal * 0.5), oracle: Math.floor(dbTotal * 0.3), sqlserver: 0, redis: Math.max(1, Math.floor(dbTotal * 0.1)), mongodb: Math.max(1, Math.floor(dbTotal * 0.1)) }

  // 根据项目类型推断架构
  const isMicro = (req.architecture_type === 'microservice') || (Number(req.microservice_count) > 0)
  const isBigData = req.project_type === 'big_data'

  // 根据安全等级推断复杂度
  const isAdvanced = req.security_level === 'advanced'
  const hasCompliance = Array.isArray(req.compliance_requirements) && req.compliance_requirements.length > 0

  return {
    resources: {
      business_systems: Number(req.app_count) || 5,
      vms: Number(req.vm_count) || 0,
      kubernetes_nodes: Number(req.k8s_cluster_count) || 0,
      container_instances: Number(req.container_count) || 0,
      databases: databases,
    },
    techStack: {
      languages: isBigData ? ['python', 'java'] : ['java'],
      frameworks: ['vue'],
      multiLanguage: isMicro ? 'medium' : 'simple',
      architecture: isMicro ? 'micro' : (isBigData ? 'soa' : 'monolith'),
      thirdParty: 'medium',
    },
    complexity: {
      business: isAdvanced ? 4.0 : 3.0,
      integration: (Number(req.api_count) > 50) ? 4.0 : 3.0,
      security: isAdvanced ? 4.5 : 3.5,
      compliance: hasCompliance ? 4.0 : 3.0,
    },
    apps: [],
    migrationItems: {
      host: Number(req.vm_count) || 0,
      container: Number(req.container_count) || 0,
      image_repo: isMicro ? 1 : 0,
      obj_storage: 1,
      obj_storage_gb: Number(req.storage_tb) ? Number(req.storage_tb) * 1000 : 0,
      disk_storage: 0,
      middleware: isBigData ? 3 : 1,
      middleware_gb: 0,
      database: dbTotal,
      database_gb: 0,
    },
    rates: { junior: 2500, mid: 4500, senior: 7000, architect: 9000, pm: 6000 },
    counts: { junior: 1, mid: 2, senior: 1, pm: 1 },
  }
}

// --- 转换 SOW 字段以匹配 SowView ---
function transformSowForView(sow) {
  if (!sow) return null
  const out = { ...sow }
  // deliverables: AI 用 due_week, SowView 用 milestone
  if (Array.isArray(out.deliverables)) {
    out.deliverables = out.deliverables.map(d => ({
      name: d.name || '',
      description: d.description || '',
      milestone: d.due_week ? `第${d.due_week}周` : (d.milestone || ''),
    }))
  }
  // risks: AI 用 description, SowView 用 risk
  if (Array.isArray(out.risks)) {
    out.risks = out.risks.map(r => ({
      risk: r.description || r.risk || '',
      impact: r.impact || '中',
      mitigation: r.mitigation || '',
    }))
  }
  // timeline: AI 输出数组，SowView 期望字符串（+ 独立 milestones 数组）
  if (Array.isArray(out.timeline)) {
    // 先把原始数组保存到本地变量
    const timelineArr = out.timeline
    out.timeline = timelineArr
      .map(t => `${t.phase || ''} (${t.duration || ''})`)
      .join('；')
    // SowView 还有一个 milestones 字段（数组），用原始数组构造
    if (!Array.isArray(out.milestones)) {
      out.milestones = timelineArr.map(t => ({
        phase: t.phase || '',
        duration: t.duration || '',
        deliverable: Array.isArray(t.milestones) ? t.milestones.join('、') : (t.milestone || ''),
      }))
    }
  }
  return out
}

// --- 转换 WBS 字段以匹配 WbsView ---
function transformWbsForView(wbs) {
  if (!wbs) return null
  const out = { ...wbs }
  if (Array.isArray(out.phases)) {
    out.phases = out.phases.map(p => ({
      ...p,
      // WbsView 调用 parseWeeks(p.duration)，支持 "N周" / "N weeks"
      duration: p.duration || (p.total_days ? `${Math.ceil(p.total_days / 5)}周` : '1周'),
      tasks: Array.isArray(p.tasks) ? p.tasks.map(t => ({
        ...t,
        // WbsView 用 phaseDays(task) 计算工期，需要 duration_days 字段
        duration_days: Number(t.duration_days) || Number(t.days) || 1,
      })) : [],
    }))
  }
  return out
}

// =====================================================================
// 本地模板生成器（不依赖 LLM，作为兜底确保一定能生成内容）
// =====================================================================

const PROJECT_TYPE_NAMES = {
  landing_zone: 'Landing Zone 基础架构',
  migration: '云迁移',
  big_data: '大数据平台',
  hybrid_cloud: '混合云',
  security: '安全合规',
  cost_optimization: '成本优化',
}

const SECURITY_LEVEL_FACTOR = { basic: 1.0, medium: 1.3, advanced: 1.6 }

// 报价单工作项模板（按项目类型）
const QUOTATION_TEMPLATES = {
  landing_zone: [
    { item: '现状调研与需求分析', role: '高级架构师', rate: 8000, baseDays: 10 },
    { item: 'Landing Zone 总体架构设计', role: '高级架构师', rate: 8000, baseDays: 15 },
    { item: '多账号体系搭建', role: '云工程师', rate: 5000, baseDays: 10 },
    { item: '网络规划与 VPC 配置', role: '云工程师', rate: 5000, baseDays: 15 },
    { item: '安全合规基线落地', role: '安全工程师', rate: 7000, baseDays: 12 },
    { item: '身份与权限 IAM 实施', role: '云工程师', rate: 5000, baseDays: 8 },
    { item: '监控与日志体系搭建', role: '运维工程师', rate: 5500, baseDays: 10 },
    { item: '运维自动化与 Runbook', role: '运维工程师', rate: 5500, baseDays: 8 },
    { item: '联调测试与试运行', role: '测试工程师', rate: 5000, baseDays: 10 },
    { item: '知识转移与培训', role: '高级架构师', rate: 8000, baseDays: 6 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 15 },
  ],
  migration: [
    { item: '现状调研与业务梳理', role: '高级架构师', rate: 8000, baseDays: 12 },
    { item: '迁移评估与方案设计', role: '高级架构师', rate: 8000, baseDays: 15 },
    { item: '目标架构与网络规划', role: '高级架构师', rate: 8000, baseDays: 10 },
    { item: '应用迁移实施', role: '云工程师', rate: 5000, baseDays: 25 },
    { item: '数据迁移与校验', role: 'DBA', rate: 7000, baseDays: 20 },
    { item: '数据库迁移与兼容性改造', role: 'DBA', rate: 7000, baseDays: 15 },
    { item: '中间件与存储迁移', role: '云工程师', rate: 5000, baseDays: 12 },
    { item: '安全策略与合规加固', role: '安全工程师', rate: 7000, baseDays: 10 },
    { item: '集成测试与性能调优', role: '测试工程师', rate: 5000, baseDays: 15 },
    { item: '割接切换与试运行', role: '云工程师', rate: 5000, baseDays: 10 },
    { item: '知识转移与培训', role: '高级架构师', rate: 8000, baseDays: 6 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 18 },
  ],
  big_data: [
    { item: '数据现状调研', role: '高级架构师', rate: 8000, baseDays: 8 },
    { item: '大数据平台架构设计', role: '高级架构师', rate: 8000, baseDays: 12 },
    { item: '数据采集与同步实施', role: '数据工程师', rate: 6000, baseDays: 15 },
    { item: '数据建模与 ETL 开发', role: '数据工程师', rate: 6000, baseDays: 25 },
    { item: '实时计算与流处理', role: '数据工程师', rate: 6000, baseDays: 18 },
    { item: '数据仓库与数据集市', role: 'DBA', rate: 7000, baseDays: 20 },
    { item: '数据治理与质量管控', role: '数据工程师', rate: 6000, baseDays: 12 },
    { item: '可视化报表与 BI', role: '数据工程师', rate: 6000, baseDays: 12 },
    { item: '性能调优与压测', role: '测试工程师', rate: 5000, baseDays: 10 },
    { item: '知识转移与培训', role: '高级架构师', rate: 8000, baseDays: 6 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 15 },
  ],
  hybrid_cloud: [
    { item: '混合云架构规划', role: '高级架构师', rate: 8000, baseDays: 12 },
    { item: '专线与网络互联', role: '网络工程师', rate: 6500, baseDays: 15 },
    { item: '统一身份认证集成', role: '安全工程师', rate: 7000, baseDays: 12 },
    { item: '跨云资源调度', role: '云工程师', rate: 5000, baseDays: 18 },
    { item: '数据流转与同步', role: '数据工程师', rate: 6000, baseDays: 15 },
    { item: '统一监控与运维', role: '运维工程师', rate: 5500, baseDays: 12 },
    { item: '安全合规加固', role: '安全工程师', rate: 7000, baseDays: 10 },
    { item: '灾备与高可用', role: '高级架构师', rate: 8000, baseDays: 10 },
    { item: '联调测试与优化', role: '测试工程师', rate: 5000, baseDays: 12 },
    { item: '知识转移与培训', role: '高级架构师', rate: 8000, baseDays: 5 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 15 },
  ],
  security: [
    { item: '安全现状评估', role: '安全工程师', rate: 7000, baseDays: 10 },
    { item: '安全架构与方案设计', role: '高级架构师', rate: 8000, baseDays: 12 },
    { item: '等保/合规体系建设', role: '安全工程师', rate: 7000, baseDays: 18 },
    { item: '安全策略与基线落地', role: '安全工程师', rate: 7000, baseDays: 15 },
    { item: '漏洞扫描与渗透测试', role: '安全工程师', rate: 7000, baseDays: 10 },
    { item: '日志审计与 SIEM 部署', role: '安全工程师', rate: 7000, baseDays: 12 },
    { item: '数据安全与加密', role: '安全工程师', rate: 7000, baseDays: 10 },
    { item: '应急响应与演练', role: '安全工程师', rate: 7000, baseDays: 6 },
    { item: '安全运维与培训', role: '安全工程师', rate: 7000, baseDays: 8 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 12 },
  ],
  cost_optimization: [
    { item: '成本现状评估与诊断', role: '高级架构师', rate: 8000, baseDays: 8 },
    { item: '成本优化方案设计', role: '高级架构师', rate: 8000, baseDays: 10 },
    { item: '资源规格优化', role: '云工程师', rate: 5000, baseDays: 12 },
    { item: '预留实例与节省计划', role: '云工程师', rate: 5000, baseDays: 8 },
    { item: '存储与带宽优化', role: '云工程师', rate: 5000, baseDays: 10 },
    { item: '自动化弹性伸缩', role: '运维工程师', rate: 5500, baseDays: 10 },
    { item: '成本监控与告警', role: '运维工程师', rate: 5500, baseDays: 8 },
    { item: '优化效果验证', role: '测试工程师', rate: 5000, baseDays: 6 },
    { item: '知识转移与培训', role: '高级架构师', rate: 8000, baseDays: 4 },
    { item: '项目管理与文档交付', role: '项目经理', rate: 6500, baseDays: 10 },
  ],
}

// 根据项目类型与提取的需求生成本地报价
function generateQuotationLocal(requirements, opportunity) {
  const req = requirements || {}
  const projectType = opportunity?.type || req.project_type || 'landing_zone'
  const template = QUOTATION_TEMPLATES[projectType] || QUOTATION_TEMPLATES.landing_zone
  const secFactor = SECURITY_LEVEL_FACTOR[req.security_level] || 1.0
  const sizeFactor = Math.max(1, Math.min(2.5, (Number(req.vm_count) || 50) / 100 + (Number(req.database_count) || 5) / 20))

  const costBreakdown = template.map((t, i) => {
    const days = Math.round(t.baseDays * sizeFactor * secFactor)
    const total = days * t.rate
    return {
      item: t.item,
      description: `${t.item}（${t.role}主导）`,
      days,
      rate: t.rate,
      total,
    }
  })
  const totalCost = costBreakdown.reduce((s, c) => s + c.total, 0)
  const totalDays = costBreakdown.reduce((s, c) => s + c.days, 0)
  return { cost_breakdown: costBreakdown, total_cost: totalCost, total_days: totalDays, currency: 'CNY' }
}

// 根据项目类型与提取的需求生成本地 SOW
function generateSowLocal(requirements, opportunity) {
  const req = requirements || {}
  const projectType = opportunity?.type || req.project_type || 'landing_zone'
  const typeName = PROJECT_TYPE_NAMES[projectType] || projectType
  const customerName = opportunity?.customer_name || '客户'
  const oppName = opportunity?.name || `${typeName}项目`

  const scopeTemplates = {
    landing_zone: [
      { category: '账号治理', item: '多账号架构设计与实施', included: true },
      { category: '网络', item: 'VPC 网络规划与配置', included: true },
      { category: '安全', item: '安全合规基线配置', included: true },
      { category: '身份', item: 'IAM 体系设计与实施', included: true },
      { category: '运维', item: '监控告警体系搭建', included: true },
      { category: '培训', item: '知识转移与培训', included: true },
    ],
    migration: [
      { category: '调研', item: '现状调研与业务梳理', included: true },
      { category: '设计', item: '迁移方案与目标架构设计', included: true },
      { category: '实施', item: '应用与数据迁移实施', included: true },
      { category: '测试', item: '集成测试与性能调优', included: true },
      { category: '切换', item: '割接切换与试运行', included: true },
      { category: '培训', item: '知识转移与培训', included: true },
    ],
    big_data: [
      { category: '架构', item: '大数据平台总体架构设计', included: true },
      { category: '采集', item: '数据采集与同步', included: true },
      { category: '建模', item: '数据建模与 ETL 开发', included: true },
      { category: '应用', item: '实时计算与数据集市', included: true },
      { category: '治理', item: '数据治理与质量管控', included: true },
      { category: '可视化', item: '可视化报表与 BI', included: true },
      { category: '培训', item: '知识转移与培训', included: true },
    ],
    hybrid_cloud: [
      { category: '架构', item: '混合云总体架构设计', included: true },
      { category: '网络', item: '专线与跨云网络互联', included: true },
      { category: '身份', item: '统一身份认证集成', included: true },
      { category: '调度', item: '跨云资源调度', included: true },
      { category: '数据', item: '数据流转与同步', included: true },
      { category: '运维', item: '统一监控与运维', included: true },
      { category: '安全', item: '安全合规加固', included: true },
    ],
    security: [
      { category: '评估', item: '安全现状评估与差距分析', included: true },
      { category: '设计', item: '安全架构与方案设计', included: true },
      { category: '合规', item: '等保/合规体系建设', included: true },
      { category: '实施', item: '安全策略与基线落地', included: true },
      { category: '测试', item: '漏洞扫描与渗透测试', included: true },
      { category: '审计', item: '日志审计与 SIEM 部署', included: true },
      { category: '运维', item: '安全运维与培训', included: true },
    ],
    cost_optimization: [
      { category: '评估', item: '成本现状评估与诊断', included: true },
      { category: '设计', item: '成本优化方案设计', included: true },
      { category: '实施', item: '资源规格与计费优化', included: true },
      { category: '弹性', item: '自动化弹性伸缩', included: true },
      { category: '监控', item: '成本监控与告警', included: true },
      { category: '培训', item: '知识转移与培训', included: true },
    ],
  }

  const deliverables = [
    { name: '项目实施方案', description: '详细的项目实施方案、计划与风险应对措施', due_week: 2 },
    { name: '架构设计文档', description: '总体架构图、技术选型、详细设计说明', due_week: 3 },
    { name: '环境交付物', description: '可运行的基础环境，含配置脚本与初始化模板', due_week: Math.ceil((Number(req.timeline_months) || 3) * 2) },
    { name: '测试报告', description: '集成测试报告、性能测试报告、问题清单', due_week: Math.ceil((Number(req.timeline_months) || 3) * 3) },
    { name: '运维手册', description: '运维操作手册、应急预案、Runbook', due_week: Math.ceil((Number(req.timeline_months) || 3) * 3.5) },
    { name: '培训材料', description: '用户培训PPT、操作视频、知识库文档', due_week: Math.ceil((Number(req.timeline_months) || 3) * 4) },
    { name: '验收报告', description: '项目验收报告、交付物清单、签字确认', due_week: Math.ceil((Number(req.timeline_months) || 3) * 4) || 12 },
  ]

  const risks = [
    { description: '需求变更导致进度延迟', mitigation: '建立变更控制流程（CCB），变更需评估影响后批准' },
    { description: '客户环境权限与账号准备不及时', mitigation: '项目启动前明确账号清单与权限清单，提前申请' },
    { description: '云平台服务不稳定或限制', mitigation: '设计多可用区容灾，重要服务有备选方案' },
    { description: '第三方系统集成兼容性问题', mitigation: '提前进行 POC 测试，预留集成问题排查时间' },
    { description: '人员流动或交付能力不足', mitigation: '关键岗位备份，团队内部定期 review' },
  ]

  const timeline = [
    { phase: '项目启动与调研', duration: '2周', milestones: ['项目启动会', '现状调研完成'] },
    { phase: '方案设计', duration: '2-3周', milestones: ['架构评审通过', '方案确认'] },
    { phase: '实施部署', duration: `${Math.max(6, Math.ceil((Number(req.timeline_months) || 3) * 4))}周`, milestones: ['环境交付', '核心功能上线'] },
    { phase: '测试与优化', duration: '2-3周', milestones: ['集成测试通过', '性能达标'] },
    { phase: '验收交付', duration: '1-2周', milestones: ['用户验收', '项目结项'] },
  ]

  const team = [
    { role: '项目经理', count: 1, responsibility: '项目整体规划、进度管理、风险控制、客户沟通' },
    { role: '高级架构师', count: 1, responsibility: '总体架构设计、技术决策、关键技术攻关' },
    { role: '云工程师', count: 2, responsibility: '环境实施、配置部署、故障排查' },
    { role: '安全工程师', count: 1, responsibility: '安全策略、合规加固、安全测试' },
    { role: '测试工程师', count: 1, responsibility: '集成测试、性能测试、问题跟踪' },
    { role: '运维工程师', count: 1, responsibility: '监控告警、运维体系、应急响应' },
  ]

  return {
    title: `${customerName} ${oppName} 工作说明书`,
    project_overview: `本项目旨在为${customerName}建设${typeName}，基于${req.current_cloud || '现有环境'}迁移/升级至${req.target_cloud || '阿里云'}，覆盖 ${req.vm_count || 'N'} 台虚拟机、${req.database_count || 'N'} 个数据库。项目周期约 ${req.timeline_months || 3} 个月，安全等级要求 ${req.security_level || 'medium'}。本项目将交付完整的方案设计、环境实施、测试验收、知识转移等服务，确保客户业务平稳上云并具备自主运维能力。`,
    scope: `项目范围包括：${typeName}的设计、规划、实施、测试、验收和知识转移全流程。乙方将负责整体架构方案设计、关键环境配置实施、安全合规基线落地、运维体系搭建，以及客户团队的赋能培训。`,
    scope_items: scopeTemplates[projectType] || scopeTemplates.landing_zone,
    deliverables,
    assumptions: [
      '客户提供必要的云平台账号权限与人员配合',
      '客户业务系统在迁移期间允许停机窗口',
      '客户网络环境支持项目实施所需的远程访问',
      '项目期间云平台服务可用且无重大变更',
      '客户业务需求在项目启动前已确认',
    ],
    risks,
    timeline,
    team,
    acceptance_criteria: [
      '所有交付物通过客户验收并签字确认',
      '系统性能与稳定性满足设计要求',
      '安全合规检查通过（如等保、ISO 等）',
      '运维手册、应急响应流程完备',
      '客户团队完成知识转移与培训',
    ],
  }
}

// 根据项目类型与提取的需求生成本地 WBS
function generateWbsLocal(requirements, opportunity) {
  const req = requirements || {}
  const projectType = opportunity?.type || req.project_type || 'landing_zone'
  const typeName = PROJECT_TYPE_NAMES[projectType] || projectType

  const basePhases = [
    {
      name: '项目启动与调研',
      duration: '2周',
      tasks: [
        { name: '项目启动会', duration_days: 1, role: '项目经理', dependencies: '-', deliverable: '启动会纪要', level: 0 },
        { name: '现状调研与需求确认', duration_days: 5, role: '高级架构师', dependencies: '项目启动会', deliverable: '调研报告', level: 0 },
        { name: '项目计划与团队组建', duration_days: 2, role: '项目经理', dependencies: '项目启动会', deliverable: '项目计划', level: 0 },
        { name: '环境准备与账号申请', duration_days: 3, role: '云工程师', dependencies: '项目启动会', deliverable: '环境就绪', level: 0 },
      ],
    },
    {
      name: '方案设计',
      duration: '3周',
      tasks: [
        { name: '总体架构设计', duration_days: 6, role: '高级架构师', dependencies: '现状调研与需求确认', deliverable: '架构设计文档', level: 0 },
        { name: '详细方案设计', duration_days: 5, role: '云工程师', dependencies: '总体架构设计', deliverable: '详细设计', level: 0 },
        { name: '安全合规方案', duration_days: 4, role: '安全工程师', dependencies: '总体架构设计', deliverable: '安全方案', level: 0 },
        { name: '架构评审与方案确认', duration_days: 2, role: '高级架构师', dependencies: '详细方案设计', deliverable: '评审纪要', level: 0 },
      ],
    },
    {
      name: '实施部署',
      duration: '6-8周',
      tasks: [
        { name: '基础环境搭建', duration_days: 5, role: '云工程师', dependencies: '架构评审与方案确认', deliverable: '基础环境', level: 0 },
        { name: '账号与权限体系', duration_days: 4, role: '云工程师', dependencies: '基础环境搭建', deliverable: '账号体系', level: 0 },
        { name: '网络架构实施', duration_days: 6, role: '云工程师', dependencies: '账号与权限体系', deliverable: '网络环境', level: 0 },
        { name: '安全基线落地', duration_days: 5, role: '安全工程师', dependencies: '网络架构实施', deliverable: '安全基线', level: 0 },
        { name: '核心服务部署', duration_days: 8, role: '云工程师', dependencies: '安全基线落地', deliverable: '核心服务', level: 0 },
        { name: '监控告警体系', duration_days: 4, role: '运维工程师', dependencies: '核心服务部署', deliverable: '监控体系', level: 0 },
        { name: '业务系统迁移/部署', duration_days: 10, role: '云工程师', dependencies: '核心服务部署', deliverable: '业务系统', level: 0 },
      ],
    },
    {
      name: '测试与优化',
      duration: '2-3周',
      tasks: [
        { name: '集成测试', duration_days: 5, role: '测试工程师', dependencies: '业务系统迁移/部署', deliverable: '测试报告', level: 0 },
        { name: '性能调优', duration_days: 4, role: '云工程师', dependencies: '集成测试', deliverable: '性能报告', level: 0 },
        { name: '安全测试', duration_days: 3, role: '安全工程师', dependencies: '集成测试', deliverable: '安全测试报告', level: 0 },
        { name: '问题修复与回归', duration_days: 5, role: '云工程师', dependencies: '性能调优', deliverable: '回归报告', level: 0 },
      ],
    },
    {
      name: '验收交付',
      duration: '2周',
      tasks: [
        { name: '用户验收测试', duration_days: 4, role: '测试工程师', dependencies: '问题修复与回归', deliverable: 'UAT报告', level: 0 },
        { name: '文档整理与交付', duration_days: 3, role: '项目经理', dependencies: '用户验收测试', deliverable: '交付文档', level: 0 },
        { name: '知识转移与培训', duration_days: 4, role: '高级架构师', dependencies: '用户验收测试', deliverable: '培训材料', level: 0 },
        { name: '项目结项', duration_days: 1, role: '项目经理', dependencies: '文档整理与交付', deliverable: '验收报告', level: 0 },
      ],
    },
  ]

  const totalDays = basePhases.reduce((s, p) => s + p.tasks.reduce((ss, t) => ss + t.duration_days, 0), 0)

  return {
    phases: basePhases,
    total_days: totalDays,
  }
}

// 判断 AI 输出是否"有效"（有实际内容）
function isQuotationValid(q) {
  return q && Array.isArray(q.cost_breakdown) && q.cost_breakdown.length > 0 && q.total_cost > 0
}
function isSowValid(s) {
  return s && s.title && Array.isArray(s.scope_items) && s.scope_items.length > 0
}
function isWbsValid(w) {
  return w && Array.isArray(w.phases) && w.phases.length > 0 && w.phases.some(p => Array.isArray(p.tasks) && p.tasks.length > 0)
}

// --- 重置 ---
function resetAll() {
  currentStep.value = 'input'
  meetingText.value = ''
  selectedFile.value = null
  showError.value = false
  results.customer = null
  results.opportunity = null
  results.quotation = null
  results.sow = null
  results.wbs = null
  results.extractedData = null
  pipelineSteps.forEach(s => { s.status = 'pending'; s.detail = '' })
}

function goToDashboard() {
  router.push('/')
}
</script>

<style scoped>
.meeting-import {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 22px;
}

.sub-title {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

/* Pipeline steps */
.pipeline-steps {
  max-width: 600px;
  margin: 0 auto;
}

.pipeline-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.pipeline-step:last-child {
  border-bottom: none;
}

.step-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.pipeline-step.pending .step-icon {
  color: #c0c4cc;
}

.pipeline-step.processing .step-icon {
  color: #409eff;
}

.pipeline-step.completed .step-icon {
  color: #67c23a;
}

.pipeline-step.failed .step-icon {
  color: #f56c6c;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.pipeline-step.pending .step-title {
  color: #909399;
}

.step-desc {
  font-size: 13px;
  color: #909399;
  margin-top: 2px;
}

.step-detail {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

/* Result cards */
.result-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.card-header .el-tag {
  margin-left: auto;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.info-item {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.info-item label {
  color: #909399;
  min-width: 70px;
  flex-shrink: 0;
}

.info-item span {
  color: #303133;
}

.info-item .desc {
  word-break: break-all;
}

.quotation-summary {
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  padding: 12px 0 4px 0;
  font-size: 15px;
}

.total-cost {
  color: #f56c6c;
  font-size: 18px;
}

.sow-overview {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.scope-list,
.deliverable-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.scope-list li,
.deliverable-list li {
  padding: 4px 0;
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scope-list li .el-tag,
.deliverable-list li .el-tag {
  flex-shrink: 0;
}

h4 {
  margin: 0 0 8px 0;
  color: #303133;
}

h5 {
  margin: 12px 0 8px 0;
  color: #303133;
  font-size: 14px;
}
</style>
