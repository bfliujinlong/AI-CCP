<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <img v-if="branding.logo_url" :src="branding.logo_url" alt="Logo" class="login-logo" />
        <el-icon v-else :size="48" color="#409EFF"><CloudServer /></el-icon>
        <h1>{{ branding.login_title || 'AI Cloud Consulting' }}</h1>
        <p>{{ branding.login_subtitle || '云咨询智能平台' }}</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" prefix-icon="Lock" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" :loading="loading" style="width: 100%" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider v-if="ssoProviders.length > 0">企业账号登录</el-divider>
      <div class="sso-buttons" v-if="ssoProviders.length > 0">
        <el-button v-for="provider in ssoProviders" :key="provider.id" size="large" style="width: 100%; margin-bottom: 8px" @click="ssoLogin(provider.url)">
          <el-icon><Link /></el-icon>
          {{ provider.name }} 登录
        </el-button>
      </div>

      <div class="login-footer">
        <span style="color: #c0c4cc; font-size: 12px; cursor: pointer;" @click="showSecurityHint = true">
          忘记密码？联系管理员
        </span>
      </div>

      <el-dialog v-model="showSecurityHint" title="安全提示" width="400px" :append-to-body="true">
        <el-alert type="info" :closable="false">
          <p>默认管理员账号信息已隐藏，请通过以下方式获取：</p>
          <ol style="margin: 8px 0 0; padding-left: 20px;">
            <li>登录后在 <strong>系统设置 → 安全配置</strong> 中查看</li>
            <li>查看后端配置文件 <code>.env</code> 中的 <code>DEFAULT_ADMIN_PASSWORD</code></li>
          </ol>
        </el-alert>
        <template #footer>
          <el-button type="primary" @click="showSecurityHint = false">知道了</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)

const branding = reactive({
  login_title: 'AI Cloud Consulting',
  login_subtitle: '云咨询智能平台',
  logo_url: '',
})

const ssoProviders = ref([])

const form = reactive({
  username: '',
  password: '',
})

const showSecurityHint = ref(false)

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

onMounted(() => {
  const saved = localStorage.getItem('aicc_branding')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(branding, data)
    } catch {}
  }

  if (route.query.sso_token) {
    authStore.setToken(route.query.sso_token)
    ElMessage.success('SSO 登录成功')
    router.push('/')
  }

  fetch('/api/v1/auth/sso/providers')
    .then(r => r.json())
    .then(data => {
      ssoProviders.value = data.providers || []
    })
    .catch(() => {})
})

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e) {
  } finally {
    loading.value = false
  }
}

function ssoLogin(url) {
  window.location.href = url
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  height: 48px;
  max-width: 200px;
  object-fit: contain;
  margin-bottom: 8px;
}

.login-header h1 {
  margin: 12px 0 4px;
  font-size: 24px;
  color: #303133;
}

.login-header p {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.sso-buttons {
  margin-top: 8px;
}

.login-footer {
  text-align: center;
  color: #909399;
  font-size: 12px;
  margin-top: 16px;
}
</style>
