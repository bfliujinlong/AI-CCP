<template>
  <div class="opportunity-detail" v-loading="loading">
    <el-page-header @back="$router.push('/opportunities')" :title="'返回商机列表'">
      <template #content>
        <span class="detail-title">{{ opportunity.name || '商机详情' }}</span>
        <el-tag :type="statusTagType(opportunity.status)" size="small" style="margin-left: 8px">
          {{ statusLabel(opportunity.status) }}
        </el-tag>
      </template>
    </el-page-header>

    <el-card shadow="never" style="margin-top: 20px">
      <el-steps :active="workflowStep" finish-status="success" align-center>
        <el-step title="创建商机" :description="formatDate(opportunity.created_at)" />
        <el-step title="Fact Sheet" />
        <el-step title="AI 报价" />
        <el-step title="SOW" />
        <el-step title="WBS" />
        <el-step title="导出" />
      </el-steps>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>基本信息</span>
              <el-button type="primary" link @click="showEditDialog = true">编辑</el-button>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="商机名称">{{ opportunity.name }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ opportunity.customer_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ typeLabel(opportunity.type) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-select v-model="opportunity.status" size="small" @change="handleStatusChange">
                <el-option label="发现阶段" value="discovery" />
                <el-option label="方案阶段" value="proposal" />
                <el-option label="谈判阶段" value="negotiation" />
                <el-option label="赢单" value="closed_won" />
                <el-option label="输单" value="closed_lost" />
              </el-select>
            </el-descriptions-item>
            <el-descriptions-item label="预计收入">
              {{ opportunity.estimated_revenue ? '¥' + Number(opportunity.estimated_revenue).toLocaleString() : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="概率">
              <el-progress :percentage="opportunity.probability || 0" :stroke-width="8" style="width: 150px" />
            </el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ opportunity.description || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>Fact Sheet</span>
              <el-button type="primary" size="small" @click="$router.push(`/factsheet/${opportunityId}`)">
                <el-icon><Edit /></el-icon> 编辑 Fact Sheet
              </el-button>
            </div>
          </template>
          <div v-if="factSheets.length > 0">
            <el-descriptions :column="3" size="small" border>
              <el-descriptions-item v-for="(value, key) in factSheets[0].facts" :key="key" :label="factLabel(key)">
                {{ value }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-else description="暂无 Fact Sheet，请先填写" :image-size="60">
            <el-button type="primary" size="small" @click="$router.push(`/factsheet/${opportunityId}`)">填写 Fact Sheet</el-button>
          </el-empty>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600">项目工作流</span>
          </template>
          <div class="workflow-actions">
            <el-button type="primary" style="width: 100%; margin-bottom: 12px" @click="$router.push(`/factsheet/${opportunityId}`)">
              <el-icon><Document /></el-icon> 填写 Fact Sheet
            </el-button>
            <el-button type="success" style="width: 100%; margin-bottom: 12px" @click="$router.push(`/quotation/${opportunityId}`)">
              <el-icon><Money /></el-icon> AI 报价
            </el-button>
            <el-button style="width: 100%; margin-bottom: 12px; background: #e6a23c; color: #fff; border-color: #e6a23c" @click="$router.push(`/sow/${opportunityId}`)">
              <el-icon><Notebook /></el-icon> 生成 SOW
            </el-button>
            <el-button style="width: 100%; margin-bottom: 12px; background: #f56c6c; color: #fff; border-color: #f56c6c" @click="$router.push(`/wbs/${opportunityId}`)">
              <el-icon><Grid /></el-icon> 生成 WBS
            </el-button>
            <el-divider />
            <el-button type="primary" style="width: 100%; margin-bottom: 12px" @click="executeSkill('LZ-Discovery')" :loading="aiLoading">
              <el-icon><MagicStick /></el-icon> AI Discovery
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px" v-if="aiResult">
          <template #header>AI Discovery 结果</template>
          <div class="ai-result">
            <div v-for="(q, idx) in aiResult.questions" :key="idx" class="question-item">
              <div class="question-category">
                <el-tag size="small" type="info">{{ q.category }}</el-tag>
              </div>
              <div class="question-text">{{ q.question }}</div>
              <div class="question-purpose">{{ q.purpose }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showEditDialog" title="编辑商机" width="600px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" label-width="80px">
        <el-form-item label="商机名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editForm.type" style="width: 100%">
            <el-option label="Landing Zone" value="landing_zone" />
            <el-option label="Migration" value="migration" />
            <el-option label="Big Data" value="big_data" />
            <el-option label="Hybrid Cloud" value="hybrid_cloud" />
            <el-option label="Security" value="security" />
            <el-option label="Cost Optimization" value="cost_optimization" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计收入">
          <el-input-number v-model="editForm.estimated_revenue" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="概率">
          <el-slider v-model="editForm.probability" :min="0" :max="100" :step="5" show-input />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { opportunityApi, factsheetApi, skillApi } from '@/api'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const opportunityId = route.params.id
const loading = ref(false)
const aiLoading = ref(false)
const opportunity = ref({})
const factSheets = ref([])
const aiResult = ref(null)
const showEditDialog = ref(false)

const editForm = reactive({
  name: '',
  type: '',
  estimated_revenue: null,
  probability: 50,
  description: '',
})

const workflowStep = computed(() => {
  if (factSheets.value.length === 0) return 0
  return 1
})

const statusMap = {
  discovery: { label: '发现阶段', type: '' },
  proposal: { label: '方案阶段', type: 'warning' },
  negotiation: { label: '谈判阶段', type: 'danger' },
  closed_won: { label: '赢单', type: 'success' },
  closed_lost: { label: '输单', type: 'info' },
}

const typeMap = {
  landing_zone: 'Landing Zone',
  migration: 'Migration',
  big_data: 'Big Data',
  hybrid_cloud: 'Hybrid Cloud',
  security: 'Security',
  cost_optimization: 'Cost Optimization',
}

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
}

function statusTagType(s) { return statusMap[s]?.type || '' }
function statusLabel(s) { return statusMap[s]?.label || s }
function typeLabel(t) { return typeMap[t] || t || '-' }
function factLabel(key) { return factLabels[key] || key }
function formatDate(d) { return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' }

onMounted(async () => {
  loading.value = true
  try {
    opportunity.value = await opportunityApi.get(opportunityId)
    Object.assign(editForm, {
      name: opportunity.value.name,
      type: opportunity.value.type || '',
      estimated_revenue: opportunity.value.estimated_revenue,
      probability: opportunity.value.probability,
      description: opportunity.value.description || '',
    })
    factSheets.value = await factsheetApi.list(opportunityId)
  } finally {
    loading.value = false
  }
})

async function handleStatusChange(status) {
  await opportunityApi.update(opportunityId, { status })
  ElMessage.success('状态已更新')
}

async function handleUpdate() {
  await opportunityApi.update(opportunityId, editForm)
  ElMessage.success('更新成功')
  showEditDialog.value = false
  opportunity.value = await opportunityApi.get(opportunityId)
}

async function executeSkill(skillName) {
  aiLoading.value = true
  aiResult.value = null
  try {
    const inputs = {}
    if (factSheets.value.length > 0) {
      Object.assign(inputs, factSheets.value[0].facts)
    }
    const res = await skillApi.execute({ skill_name: skillName, inputs })
    aiResult.value = res.outputs || res
    ElMessage.success('AI 分析完成')
  } catch (e) {
    // handled by interceptor
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.detail-title {
  font-size: 18px;
  font-weight: 600;
}

.workflow-actions {
  display: flex;
  flex-direction: column;
}

.ai-result {
  max-height: 400px;
  overflow-y: auto;
}

.question-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.question-item:last-child {
  border-bottom: none;
}

.question-category {
  margin-bottom: 4px;
}

.question-text {
  font-weight: 500;
  color: #303133;
  margin-bottom: 2px;
}

.question-purpose {
  color: #909399;
  font-size: 12px;
}
</style>
