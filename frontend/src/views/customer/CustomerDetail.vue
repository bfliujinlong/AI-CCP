<template>
  <div class="customer-detail" v-loading="loading">
    <el-page-header @back="$router.push('/customers')" :title="'返回客户列表'">
      <template #content>
        <span class="detail-title">{{ customer.name || '客户详情' }}</span>
        <el-tag v-if="customer.is_active" type="success" size="small" style="margin-left: 8px">活跃</el-tag>
        <el-tag v-else type="info" size="small" style="margin-left: 8px">停用</el-tag>
      </template>
    </el-page-header>

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
            <el-descriptions-item label="客户名称">{{ customer.name }}</el-descriptions-item>
            <el-descriptions-item label="行业">{{ customer.industry || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ customer.contact_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ customer.contact_email || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ customer.contact_phone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="地址">{{ customer.address || '-' }}</el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">{{ customer.description || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>相关商机</span>
              <el-button type="primary" size="small" @click="showCreateOpportunity = true">
                <el-icon><Plus /></el-icon> 新建商机
              </el-button>
            </div>
          </template>
          <el-table :data="opportunities" stripe>
            <el-table-column prop="name" label="商机名称" min-width="200">
              <template #default="{ row }">
                <el-link type="primary" @click="$router.push(`/opportunities/${row.id}`)">{{ row.name }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="140" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="estimated_revenue" label="预计收入" width="140">
              <template #default="{ row }">
                {{ row.estimated_revenue ? '¥' + Number(row.estimated_revenue).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="probability" label="概率" width="80">
              <template #default="{ row }">{{ row.probability }}%</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>快捷操作</template>
          <div class="quick-actions">
            <el-button type="primary" style="width: 100%; margin-bottom: 12px" @click="showCreateOpportunity = true">
              <el-icon><Plus /></el-icon> 新建商机
            </el-button>
            <el-button style="width: 100%; margin-bottom: 12px" @click="showEditDialog = true">
              <el-icon><Edit /></el-icon> 编辑客户
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showEditDialog" title="编辑客户" width="600px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="行业">
          <el-input v-model="editForm.industry" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="editForm.contact_name" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.contact_email" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="editForm.contact_phone" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="editForm.address" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpdate">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCreateOpportunity" title="新建商机" width="600px" destroy-on-close>
      <el-form ref="oppFormRef" :model="oppForm" :rules="oppRules" label-width="80px">
        <el-form-item label="商机名称" prop="name">
          <el-input v-model="oppForm.name" placeholder="请输入商机名称" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="oppForm.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="Landing Zone" value="landing_zone" />
            <el-option label="Migration" value="migration" />
            <el-option label="Big Data" value="big_data" />
            <el-option label="Hybrid Cloud" value="hybrid_cloud" />
            <el-option label="Security" value="security" />
            <el-option label="Cost Optimization" value="cost_optimization" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计收入">
          <el-input-number v-model="oppForm.estimated_revenue" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="概率">
          <el-slider v-model="oppForm.probability" :min="0" :max="100" :step="5" show-input />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="oppForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateOpportunity = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateOpportunity">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { customerApi, opportunityApi } from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const customer = ref({})
const opportunities = ref([])
const showEditDialog = ref(false)
const showCreateOpportunity = ref(false)
const editFormRef = ref(null)
const oppFormRef = ref(null)

const editForm = reactive({
  name: '',
  industry: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  description: '',
})

const editRules = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
}

const oppForm = reactive({
  name: '',
  type: '',
  estimated_revenue: null,
  probability: 50,
  description: '',
})

const oppRules = {
  name: [{ required: true, message: '请输入商机名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

const statusMap = {
  discovery: { label: '发现阶段', type: '' },
  proposal: { label: '方案阶段', type: 'warning' },
  negotiation: { label: '谈判阶段', type: 'danger' },
  closed_won: { label: '赢单', type: 'success' },
  closed_lost: { label: '输单', type: 'info' },
}

function statusTagType(s) { return statusMap[s]?.type || '' }
function statusLabel(s) { return statusMap[s]?.label || s }

onMounted(async () => {
  loading.value = true
  try {
    customer.value = await customerApi.get(route.params.id)
    Object.assign(editForm, {
      name: customer.value.name,
      industry: customer.value.industry || '',
      contact_name: customer.value.contact_name || '',
      contact_email: customer.value.contact_email || '',
      contact_phone: customer.value.contact_phone || '',
      address: customer.value.address || '',
      description: customer.value.description || '',
    })
    const oppRes = await opportunityApi.list({ customer_id: route.params.id, page_size: 100 })
    opportunities.value = oppRes.items
  } finally {
    loading.value = false
  }
})

async function handleUpdate() {
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    await customerApi.update(route.params.id, editForm)
    ElMessage.success('更新成功')
    showEditDialog.value = false
    customer.value = await customerApi.get(route.params.id)
  } finally {
    submitting.value = false
  }
}

async function handleCreateOpportunity() {
  const valid = await oppFormRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    await opportunityApi.create({
      ...oppForm,
      customer_id: route.params.id,
    })
    ElMessage.success('商机创建成功')
    showCreateOpportunity.value = false
    Object.assign(oppForm, { name: '', type: '', estimated_revenue: null, probability: 50, description: '' })
    const oppRes = await opportunityApi.list({ customer_id: route.params.id, page_size: 100 })
    opportunities.value = oppRes.items
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.detail-title {
  font-size: 18px;
  font-weight: 600;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}
</style>
