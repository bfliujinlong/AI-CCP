<template>
  <div class="customer-list">
    <el-card shadow="never">
      <div class="page-header">
        <h2>客户管理</h2>
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon> 新建客户
        </el-button>
      </div>

      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索客户名称"
          prefix-icon="Search"
          clearable
          style="width: 300px"
          @input="handleSearch"
        />
      </div>

      <el-table :data="customers" stripe v-loading="loading">
        <el-table-column prop="name" label="客户名称" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/customers/${row.id}`)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="industry" label="行业" width="150" />
        <el-table-column prop="contact_name" label="联系人" width="120" />
        <el-table-column prop="contact_email" label="邮箱" width="200" />
        <el-table-column prop="contact_phone" label="电话" width="140" />
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '活跃' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="$router.push(`/customers/${row.id}`)">详情</el-button>
            <el-button type="warning" link size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确认删除此客户？" @confirm="handleDelete(row.id)">
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑客户' : '新建客户'" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入客户名称" />
        </el-form-item>
        <el-form-item label="行业" prop="industry">
          <el-select v-model="form.industry" placeholder="请选择行业" clearable style="width: 100%">
            <el-option label="金融" value="金融" />
            <el-option label="制造" value="制造" />
            <el-option label="零售" value="零售" />
            <el-option label="互联网" value="互联网" />
            <el-option label="政府" value="政府" />
            <el-option label="教育" value="教育" />
            <el-option label="医疗" value="医疗" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人" prop="contact_name">
          <el-input v-model="form.contact_name" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="邮箱" prop="contact_email">
          <el-input v-model="form.contact_email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="电话" prop="contact_phone">
          <el-input v-model="form.contact_phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" type="textarea" :rows="2" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
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
import { customerApi } from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const customers = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchText = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const submitting = ref(false)
const formRef = ref(null)

const form = reactive({
  name: '',
  industry: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  description: '',
})

const rules = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
}

onMounted(() => fetchData())

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
    const res = await customerApi.list({
      page: page.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
    })
    customers.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function showCreateDialog() {
  isEdit.value = false
  editId.value = null
  Object.assign(form, {
    name: '',
    industry: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    description: '',
  })
  dialogVisible.value = true
}

function showEditDialog(row) {
  isEdit.value = true
  editId.value = row.id
  Object.assign(form, {
    name: row.name,
    industry: row.industry || '',
    contact_name: row.contact_name || '',
    contact_email: row.contact_email || '',
    contact_phone: row.contact_phone || '',
    address: row.address || '',
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
      await customerApi.update(editId.value, form)
      ElMessage.success('更新成功')
    } else {
      await customerApi.create(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  await customerApi.delete(id)
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
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
