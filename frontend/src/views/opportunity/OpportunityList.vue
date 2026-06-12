<template>
  <div class="opportunity-list">
    <el-card shadow="never">
      <div class="page-header">
        <h2>商机管理</h2>
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon> 新建商机
        </el-button>
      </div>

      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索商机名称"
          prefix-icon="Search"
          clearable
          style="width: 250px; margin-right: 12px"
          @input="handleSearch"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 150px" @change="fetchData">
          <el-option label="发现阶段" value="discovery" />
          <el-option label="方案阶段" value="proposal" />
          <el-option label="谈判阶段" value="negotiation" />
          <el-option label="赢单" value="closed_won" />
          <el-option label="输单" value="closed_lost" />
        </el-select>
      </div>

      <el-table :data="opportunities" stripe v-loading="loading">
        <el-table-column prop="name" label="商机名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/opportunities/${row.id}`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="180" />
        <el-table-column prop="type" label="类型" width="140">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
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
          <template #default="{ row }">
            <el-progress :percentage="row.probability" :stroke-width="6" :show-text="true" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="$router.push(`/opportunities/${row.id}`)">详情</el-button>
            <el-button type="warning" link size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除此商机？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商机' : '新建商机'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="商机名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入商机名称" />
        </el-form-item>
        <el-form-item label="客户" prop="customer_id" v-if="!isEdit">
          <el-select v-model="form.customer_id" placeholder="请选择客户" filterable style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择类型" style="width: 100%">
            <el-option label="Landing Zone" value="landing_zone" />
            <el-option label="Migration" value="migration" />
            <el-option label="Big Data" value="big_data" />
            <el-option label="Hybrid Cloud" value="hybrid_cloud" />
            <el-option label="Security" value="security" />
            <el-option label="Cost Optimization" value="cost_optimization" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计收入">
          <el-input-number v-model="form.estimated_revenue" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="概率">
          <el-slider v-model="form.probability" :min="0" :max="100" :step="5" show-input />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { opportunityApi, customerApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const opportunities = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchText = ref('')
const filterStatus = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const submitting = ref(false)
const formRef = ref(null)
const customerOptions = ref([])

const form = reactive({
  name: '',
  customer_id: '',
  type: '',
  estimated_revenue: null,
  probability: 50,
  description: '',
})

const rules = {
  name: [{ required: true, message: '请输入商机名称', trigger: 'blur' }],
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

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

function statusTagType(s) { return statusMap[s]?.type || '' }
function statusLabel(s) { return statusMap[s]?.label || s }
function typeLabel(t) { return typeMap[t] || t || '-' }

onMounted(async () => {
  fetchData()
  const res = await customerApi.list({ page_size: 100 })
  customerOptions.value = res.items
})

let searchTimer = null
function handleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchData()
  }, 300)
}

async function fetchData() {
  loading.value = true
  try {
    const res = await opportunityApi.list({
      page: page.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
      status: filterStatus.value || undefined,
    })
    opportunities.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function showCreateDialog() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, { name: '', customer_id: '', type: '', estimated_revenue: null, probability: 50, description: '' })
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    customer_id: row.customer_id,
    type: row.type || '',
    estimated_revenue: row.estimated_revenue,
    probability: row.probability,
    description: row.description || '',
  })
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value) {
      await opportunityApi.update(editId.value, form)
      ElMessage.success('更新成功')
    } else {
      await opportunityApi.create(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  await opportunityApi.delete(id)
  ElMessage.success('删除成功')
  fetchData()
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.search-bar {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
