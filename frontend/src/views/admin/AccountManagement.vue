<template>
  <div class="account-management">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600">账户管理</span>
              <div>
                <el-tag type="info" style="margin-right: 8px">共 {{ totalCount }} 个账户</el-tag>
                <el-button v-if="authStore.isAdmin" type="primary" @click="showCreateDialog">
                  <el-icon><Plus /></el-icon> 创建账户
                </el-button>
                <el-tag v-else type="warning" size="small">仅管理员可操作</el-tag>
              </div>
            </div>
          </template>

          <el-alert v-if="!authStore.isAdmin" type="warning" :closable="false" style="margin-bottom: 16px">
            您当前以 <strong>{{ authStore.user?.role === 'consultant' ? '顾问' : authStore.user?.role === 'manager' ? '经理' : authStore.user?.role }}</strong> 身份登录，仅管理员可进行账户的创建、编辑、禁用和密码重置操作。
          </el-alert>

          <el-table :data="accounts" v-loading="loading" stripe>
            <el-table-column prop="username" label="用户名" width="140" />
            <el-table-column prop="full_name" label="姓名" width="140">
              <template #default="{ row }">{{ row.full_name || '-' }}</template>
            </el-table-column>
            <el-table-column prop="email" label="邮箱" min-width="200" />
            <el-table-column prop="phone" label="手机号" width="140">
              <template #default="{ row }">
                <span v-if="row.phone">
                  {{ row.phone.slice(0, 3) }}****{{ row.phone.slice(-4) }}
                  <el-tag v-if="row.phone_verified" type="success" size="small">已验证</el-tag>
                  <el-tag v-else type="warning" size="small">未验证</el-tag>
                </span>
                <span v-else style="color: #c0c4cc">未绑定</span>
              </template>
            </el-table-column>
            <el-table-column prop="role" label="角色" width="120">
              <template #default="{ row }">
                <el-tag :type="row.role === 'admin' ? 'danger' : row.role === 'manager' ? 'warning' : 'info'" size="small">
                  {{ roleMap[row.role] || row.role }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
                  {{ row.is_active ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="170">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button v-if="authStore.isAdmin" size="small" @click="showEditDialog(row)">编辑</el-button>
                <el-button v-if="authStore.isAdmin" size="small" type="warning" @click="showResetPasswordDialog(row)">重置密码</el-button>
                <el-button v-if="authStore.isAdmin" size="small" type="danger" @click="handleDisable(row)" v-show="row.username !== 'admin' && row.is_active">禁用</el-button>
                <el-tag v-if="!authStore.isAdmin" type="info" size="small">只读</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="createDialogVisible" title="创建账户" width="560px" :close-on-click-modal="false">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password placeholder="请输入密码（至少6位）" />
        </el-form-item>
        <el-form-item label="姓名" prop="full_name">
          <el-input v-model="createForm.full_name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="顾问" value="consultant" />
            <el-option label="经理" value="manager" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="createForm.phone" placeholder="选填，1开头的11位手机号" style="flex: 1" />
            <el-button :disabled="!createForm.phone || phoneCodeCooldown > 0" @click="sendCreatePhoneCode">
              {{ phoneCodeCooldown > 0 ? `${phoneCodeCooldown}s` : '发送验证码' }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="验证码" v-if="createForm.phone" prop="phone_code">
          <el-input v-model="createForm.phone_code" placeholder="输入手机收到的验证码" maxlength="6" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑账户" width="500px">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="100px">
        <el-form-item label="用户名">
          <el-input :model-value="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="姓名" prop="full_name">
          <el-input v-model="editForm.full_name" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="editForm.role" style="width: 100%">
            <el-option label="顾问" value="consultant" />
            <el-option label="经理" value="manager" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="1开头的11位手机号" />
        </el-form-item>
        <el-form-item label="状态" prop="is_active">
          <el-switch v-model="editForm.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetPwdDialogVisible" title="重置密码" width="440px">
      <el-form ref="resetPwdFormRef" :model="resetPwdForm" :rules="resetPwdRules" label-width="80px">
        <el-form-item label="用户">
          <el-input :model-value="resetPwdForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="resetPwdForm.new_password" type="password" show-password placeholder="请输入新密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input v-model="resetPwdForm.confirm_password" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetPwdLoading" @click="handleResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { accountApi } from '@/api'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const loading = ref(false)
const accounts = ref([])
const totalCount = ref(0)
const phoneCodeCooldown = ref(0)
const roleMap = { admin: '管理员', manager: '经理', consultant: '顾问' }

const createDialogVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref(null)
const createForm = reactive({
  username: '',
  email: '',
  password: '',
  full_name: '',
  role: 'consultant',
  phone: '',
  phone_code: '',
})

const createRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

const editDialogVisible = ref(false)
const editLoading = ref(false)
const editFormRef = ref(null)
const editForm = reactive({
  id: '',
  username: '',
  email: '',
  full_name: '',
  role: 'consultant',
  phone: '',
  is_active: true,
})

const editRules = {
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

const resetPwdDialogVisible = ref(false)
const resetPwdLoading = ref(false)
const resetPwdFormRef = ref(null)
const resetPwdForm = reactive({
  user_id: '',
  username: '',
  new_password: '',
  confirm_password: '',
})

const resetPwdRules = {
  new_password: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '密码至少6位', trigger: 'blur' }],
  confirm_password: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== resetPwdForm.new_password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

onMounted(() => {
  loadAccounts()
})

async function loadAccounts() {
  loading.value = true
  try {
    const res = await accountApi.list({ skip: 0, limit: 100 })
    accounts.value = Array.isArray(res) ? res : (res.items || res.data || [])
    totalCount.value = Array.isArray(res) ? res.length : (res.total || accounts.value.length)
  } catch (err) {
    ElMessage.error('加载账户列表失败: ' + (err.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function showCreateDialog() {
  Object.assign(createForm, { username: '', email: '', password: '', full_name: '', role: 'consultant', phone: '', phone_code: '' })
  createDialogVisible.value = true
}

async function sendCreatePhoneCode() {
  if (!createForm.phone || !/^1[3-9]\d{9}$/.test(createForm.phone)) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  try {
    const res = await accountApi.sendPhoneCode(createForm.phone)
    ElMessage.success(res.data?.message || '验证码已发送')
    if (res.data?.debug_code) {
      ElMessage.info(`开发模式验证码: ${res.data.debug_code}`)
    }
    phoneCodeCooldown.value = 60
    const timer = setInterval(() => {
      phoneCodeCooldown.value--
      if (phoneCodeCooldown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (err) {
    ElMessage.error('发送验证码失败: ' + (err.message || '未知错误'))
  }
}

async function handleCreate() {
  if (!authStore.isAdmin) {
    ElMessage.error('您没有权限创建账户')
    return
  }
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return

  createLoading.value = true
  try {
    await accountApi.create(createForm)
    ElMessage.success('账户创建成功')
    createDialogVisible.value = false
    loadAccounts()
  } catch (err) {
    ElMessage.error('创建失败: ' + (err.response?.data?.detail || err.message || '未知错误'))
  } finally {
    createLoading.value = false
  }
}

function showEditDialog(row) {
  Object.assign(editForm, {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name || '',
    role: row.role,
    phone: row.phone || '',
    is_active: row.is_active,
  })
  editDialogVisible.value = true
}

async function handleEdit() {
  if (!authStore.isAdmin) {
    ElMessage.error('您没有权限编辑账户')
    return
  }
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return

  editLoading.value = true
  try {
    await accountApi.update(editForm.id, {
      email: editForm.email,
      full_name: editForm.full_name,
      role: editForm.role,
      phone: editForm.phone || null,
      is_active: editForm.is_active,
    })
    ElMessage.success('账户更新成功')
    editDialogVisible.value = false
    loadAccounts()
  } catch (err) {
    ElMessage.error('更新失败: ' + (err.response?.data?.detail || err.message || '未知错误'))
  } finally {
    editLoading.value = false
  }
}

function showResetPasswordDialog(row) {
  Object.assign(resetPwdForm, { user_id: row.id, username: row.username, new_password: '', confirm_password: '' })
  resetPwdDialogVisible.value = true
}

async function handleResetPassword() {
  if (!authStore.isAdmin) {
    ElMessage.error('您没有权限重置密码')
    return
  }
  const valid = await resetPwdFormRef.value.validate().catch(() => false)
  if (!valid) return

  resetPwdLoading.value = true
  try {
    await accountApi.resetPassword(resetPwdForm.user_id, {
      user_id: resetPwdForm.user_id,
      new_password: resetPwdForm.new_password,
    })
    ElMessage.success('密码重置成功')
    resetPwdDialogVisible.value = false
  } catch (err) {
    ElMessage.error('重置失败: ' + (err.response?.data?.detail || err.message || '未知错误'))
  } finally {
    resetPwdLoading.value = false
  }
}

async function handleDisable(row) {
  if (!authStore.isAdmin) {
    ElMessage.error('您没有权限禁用账户')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要禁用账户 "${row.username}" 吗？`, '确认禁用', { type: 'warning' })
    await accountApi.delete(row.id)
    ElMessage.success('账户已禁用')
    loadAccounts()
  } catch {}
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}
</script>

<style scoped>
.account-management {
  padding: 0;
}
</style>
