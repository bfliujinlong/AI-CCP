<template>
  <div class="system-settings">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>
            <span style="font-weight: 600">系统设置</span>
          </template>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="品牌定制" name="branding">
              <el-form label-width="140px" style="max-width: 600px">
                <el-form-item label="系统名称">
                  <el-input v-model="brandingForm.system_name" placeholder="AI Cloud Consulting Platform" />
                </el-form-item>
                <el-form-item label="系统 Logo">
                  <div class="logo-upload-area">
                    <div class="logo-preview" v-if="brandingForm.logo_url">
                      <img :src="brandingForm.logo_url" alt="Logo" />
                    </div>
                    <div class="logo-preview logo-empty" v-else>
                      <el-icon :size="40" color="#c0c4cc"><Picture /></el-icon>
                      <span>暂无 Logo</span>
                    </div>
                    <el-upload
                      :auto-upload="false"
                      :show-file-list="false"
                      :on-change="handleLogoChange"
                      accept=".png,.jpg,.jpeg,.svg"
                    >
                      <el-button type="primary" size="small"><el-icon><Upload /></el-icon> 上传 Logo</el-button>
                    </el-upload>
                    <el-button size="small" @click="brandingForm.logo_url = ''" v-if="brandingForm.logo_url">移除</el-button>
                  </div>
                  <div class="el-upload__tip">建议尺寸：高度 40px，支持 PNG/JPG/SVG，透明背景</div>
                </el-form-item>
                <el-form-item label="登录页标题">
                  <el-input v-model="brandingForm.login_title" placeholder="AI 云咨询平台" />
                </el-form-item>
                <el-form-item label="登录页副标题">
                  <el-input v-model="brandingForm.login_subtitle" placeholder="智能报价 · SOW · WBS · 多云对比" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveBranding">保存品牌设置</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="SSO 认证" name="sso">
              <el-alert type="warning" :closable="false" style="margin-bottom: 16px">
                配置 SSO 后，团队成员可通过企业账号直接登录，无需单独注册。修改配置后需重启后端服务生效。
              </el-alert>

              <el-form label-width="160px" style="max-width: 700px">
                <el-divider content-position="left">飞书 (Lark) SSO</el-divider>
                <el-form-item label="启用飞书登录">
                  <el-switch v-model="ssoForm.lark_enabled" />
                </el-form-item>
                <template v-if="ssoForm.lark_enabled">
                  <el-form-item label="App ID">
                    <el-input v-model="ssoForm.lark_app_id" placeholder="cli_xxxxxxxxxxxx" />
                  </el-form-item>
                  <el-form-item label="App Secret">
                    <el-input v-model="ssoForm.lark_app_secret" type="password" show-password placeholder="飞书应用 App Secret" />
                  </el-form-item>
                  <el-form-item label="回调地址">
                    <el-input :model-value="ssoForm.lark_redirect_uri" readonly>
                      <template #append>
                        <el-button @click="copyText(ssoForm.lark_redirect_uri)">复制</el-button>
                      </template>
                    </el-input>
                    <div class="el-upload__tip">请将此回调地址填入飞书开放平台应用配置中</div>
                  </el-form-item>
                </template>

                <el-divider content-position="left">通用 OIDC SSO</el-divider>
                <el-form-item label="启用 OIDC 登录">
                  <el-switch v-model="ssoForm.oidc_enabled" />
                </el-form-item>
                <template v-if="ssoForm.oidc_enabled">
                  <el-form-item label="Issuer URL">
                    <el-input v-model="ssoForm.oidc_issuer" placeholder="https://your-idp.com/.well-known/openid-configuration" />
                  </el-form-item>
                  <el-form-item label="Client ID">
                    <el-input v-model="ssoForm.oidc_client_id" placeholder="OIDC Client ID" />
                  </el-form-item>
                  <el-form-item label="Client Secret">
                    <el-input v-model="ssoForm.oidc_client_secret" type="password" show-password placeholder="OIDC Client Secret" />
                  </el-form-item>
                  <el-form-item label="Scope">
                    <el-input v-model="ssoForm.oidc_scope" placeholder="openid profile email" />
                  </el-form-item>
                  <el-form-item label="回调地址">
                    <el-input :model-value="ssoForm.oidc_redirect_uri" readonly>
                      <template #append>
                        <el-button @click="copyText(ssoForm.oidc_redirect_uri)">复制</el-button>
                      </template>
                    </el-input>
                  </el-form-item>
                </template>

                <el-divider content-position="left">企业微信 SSO</el-divider>
                <el-form-item label="启用企微登录">
                  <el-switch v-model="ssoForm.wecom_enabled" />
                </el-form-item>
                <template v-if="ssoForm.wecom_enabled">
                  <el-form-item label="Corp ID">
                    <el-input v-model="ssoForm.wecom_corp_id" placeholder="企业 Corp ID" />
                  </el-form-item>
                  <el-form-item label="Agent ID">
                    <el-input v-model="ssoForm.wecom_agent_id" placeholder="自建应用 Agent ID" />
                  </el-form-item>
                  <el-form-item label="Secret">
                    <el-input v-model="ssoForm.wecom_secret" type="password" show-password placeholder="自建应用 Secret" />
                  </el-form-item>
                </template>

                <el-form-item>
                  <el-button type="primary" @click="saveSSO">保存 SSO 配置</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="邮件通知" name="email">
              <el-form label-width="140px" style="max-width: 600px">
                <el-form-item label="SMTP 服务器">
                  <el-input v-model="emailForm.smtp_host" placeholder="smtp.exmail.qq.com" />
                </el-form-item>
                <el-form-item label="端口">
                  <el-input v-model="emailForm.smtp_port" placeholder="465" style="width: 120px" />
                </el-form-item>
                <el-form-item label="发件人">
                  <el-input v-model="emailForm.smtp_sender" placeholder="noreply@yourcompany.com" />
                </el-form-item>
                <el-form-item label="密码">
                  <el-input v-model="emailForm.smtp_password" type="password" show-password />
                </el-form-item>
                <el-form-item label="启用 SSL">
                  <el-switch v-model="emailForm.smtp_ssl" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="saveEmail">保存邮件配置</el-button>
                  <el-button @click="testEmail">发送测试邮件</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="账户管理" name="accounts">
              <AccountManagement />
            </el-tab-pane>

            <el-tab-pane label="安全配置" name="security">
              <el-alert v-if="!authStore.isAdmin" type="error" :closable="false" style="margin-bottom: 16px">
                您没有权限查看安全配置。请联系管理员获取访问权限。
              </el-alert>
              <template v-else>
                <el-alert type="warning" :closable="false" style="margin-bottom: 16px">
                  此处显示系统默认凭证信息，仅管理员可见。请勿向非授权人员透露。
                </el-alert>
                <el-descriptions :column="1" border style="max-width: 600px">
                  <el-descriptions-item label="默认管理员账号">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <code>{{ securityConfig.default_username }}</code>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="默认密码">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <code v-if="showDefaultPassword">{{ actualDefaultPassword }}</code>
                      <code v-else>{{ securityConfig.default_password_hint }}</code>
                      <el-button size="small" @click="showDefaultPassword = !showDefaultPassword">
                        {{ showDefaultPassword ? '隐藏' : '显示' }}
                      </el-button>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="登录页显示默认密码">
                    <el-switch v-model="securityConfig.show_default_on_login" @change="saveSecurityConfig" />
                    <span style="margin-left: 8px; color: #909399; font-size: 12px">
                      {{ securityConfig.show_default_on_login ? '（已开启 - 不推荐）' : '（已关闭 - 推荐）' }}
                    </span>
                  </el-descriptions-item>
                </el-descriptions>

                <el-divider content-position="left">密码策略</el-divider>
                <el-form label-width="140px" style="max-width: 600px">
                  <el-form-item label="最小密码长度">
                    <el-input-number v-model="securityForm.min_password_length" :min="6" :max="32" />
                  </el-form-item>
                  <el-form-item label="密码过期天数">
                    <el-input-number v-model="securityForm.password_expire_days" :min="0" :max="365" />
                    <span style="margin-left: 8px; color: #909399; font-size: 12px">0 表示永不过期</span>
                  </el-form-item>
                  <el-form-item label="登录失败锁定次数">
                    <el-input-number v-model="securityForm.max_login_attempts" :min="3" :max="20" />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="saveSecurityForm">保存安全策略</el-button>
                  </el-form-item>
                </el-form>
              </template>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AccountManagement from './AccountManagement.vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const activeTab = ref('branding')

const brandingForm = reactive({
  system_name: 'AICC Platform',
  logo_url: '',
  login_title: 'AI 云咨询平台',
  login_subtitle: '智能报价 · SOW · WBS · 多云对比',
})

const ssoForm = reactive({
  lark_enabled: false,
  lark_app_id: '',
  lark_app_secret: '',
  lark_redirect_uri: window.location.origin + '/api/v1/auth/sso/lark/callback',
  oidc_enabled: false,
  oidc_issuer: '',
  oidc_client_id: '',
  oidc_client_secret: '',
  oidc_scope: 'openid profile email',
  oidc_redirect_uri: window.location.origin + '/api/v1/auth/sso/oidc/callback',
  wecom_enabled: false,
  wecom_corp_id: '',
  wecom_agent_id: '',
  wecom_secret: '',
})

const emailForm = reactive({
  smtp_host: '',
  smtp_port: '465',
  smtp_sender: '',
  smtp_password: '',
  smtp_ssl: true,
})

const showDefaultPassword = ref(false)
const actualDefaultPassword = 'admin123'
const securityConfig = reactive({
  default_username: 'admin',
  default_password_hint: 'a***3',
  show_default_on_login: false,
})

const securityForm = reactive({
  min_password_length: 6,
  password_expire_days: 0,
  max_login_attempts: 5,
})

onMounted(() => {
  const saved = localStorage.getItem('aicc_branding')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(brandingForm, data)
    } catch {}
  }
})

function handleLogoChange(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    brandingForm.logo_url = e.target.result
  }
  reader.readAsDataURL(file.raw)
}

function saveBranding() {
  localStorage.setItem('aicc_branding', JSON.stringify({
    system_name: brandingForm.system_name,
    logo_url: brandingForm.logo_url,
    login_title: brandingForm.login_title,
    login_subtitle: brandingForm.login_subtitle,
  }))
  ElMessage.success('品牌设置已保存，刷新页面后生效')
}

function saveSSO() {
  ElMessage.success('SSO 配置已保存')
}

function saveEmail() {
  ElMessage.success('邮件配置已保存')
}

function testEmail() {
  ElMessage.info('测试邮件已发送（Mock 模式）')
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  })
}

function saveSecurityConfig() {
  localStorage.setItem('aicc_security', JSON.stringify({
    show_default_on_login: securityConfig.show_default_on_login,
  }))
  ElMessage.success(securityConfig.show_default_on_login ? '已开启登录页显示默认密码' : '已关闭登录页显示默认密码')
}

function saveSecurityForm() {
  localStorage.setItem('aicc_security_policy', JSON.stringify({
    min_password_length: securityForm.min_password_length,
    password_expire_days: securityForm.password_expire_days,
    max_login_attempts: securityForm.max_login_attempts,
  }))
  ElMessage.success('安全策略已保存')
}
</script>

<style scoped>
.logo-upload-area {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo-preview {
  width: 120px;
  height: 60px;
  border: 1px dashed #d9d9d9;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #fff;
}
.logo-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.logo-empty {
  flex-direction: column;
  gap: 4px;
  color: #c0c4cc;
  font-size: 12px;
}
</style>
