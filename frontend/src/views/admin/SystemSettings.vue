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

            <el-tab-pane label="云价格采集" name="cloudPricing">
              <el-alert type="info" :closable="false" style="margin-bottom: 16px">
                配置各云厂商的单价与采集参数。当前为前端 Mock 模式，保存后价格对比页面会立即生效；后续可对接后端实时采集接口。
              </el-alert>

              <el-form label-width="160px" style="max-width: 900px">
                <el-divider content-position="left">采集模式</el-divider>
                <el-form-item label="价格数据来源">
                  <el-radio-group v-model="cloudPricingForm.mode">
                    <el-radio label="mock">Mock 数据（演示）</el-radio>
                    <el-radio label="api">云厂商 API（需配置 AK/SK）</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="自动刷新间隔">
                  <el-input v-model="cloudPricingForm.refresh_interval_hours" style="width: 120px" />
                  <span style="margin-left: 8px; color: #909399; font-size: 12px">小时，0 表示不自动刷新</span>
                </el-form-item>

                <el-divider content-position="left">云厂商开关</el-divider>
                <el-form-item v-for="cloud in cloudPricingForm.clouds" :key="cloud.id" :label="cloud.name">
                  <el-switch v-model="cloud.enabled" />
                  <span style="margin-left: 8px; color: #909399; font-size: 12px">{{ cloud.enabled ? '已启用' : '已禁用' }}</span>
                </el-form-item>

                <el-divider content-position="left">单价配置（元/月）</el-divider>
                <el-table :data="enabledClouds" border size="small" style="margin-bottom: 16px">
                  <el-table-column prop="name" label="云厂商" width="120" />
                  <el-table-column label="ECS 4C8G" width="140">
                    <template #default="{ row }">
                      <el-input-number v-model="row.unitPrices.ecs" :min="0" :precision="2" :step="10" style="width: 120px" />
                    </template>
                  </el-table-column>
                  <el-table-column label="RDS 4C8G" width="140">
                    <template #default="{ row }">
                      <el-input-number v-model="row.unitPrices.rds" :min="0" :precision="2" :step="10" style="width: 120px" />
                    </template>
                  </el-table-column>
                  <el-table-column label="存储 100GB" width="140">
                    <template #default="{ row }">
                      <el-input-number v-model="row.unitPrices.storage" :min="0" :precision="2" :step="1" style="width: 120px" />
                    </template>
                  </el-table-column>
                  <el-table-column label="带宽 1Mbps" width="140">
                    <template #default="{ row }">
                      <el-input-number v-model="row.unitPrices.network" :min="0" :precision="2" :step="1" style="width: 120px" />
                    </template>
                  </el-table-column>
                </el-table>

                <el-divider content-position="left">API 配置（可选）</el-divider>
                <div v-for="cloud in cloudPricingForm.clouds.filter(c => c.enabled)" :key="cloud.id" style="margin-bottom: 16px">
                  <el-descriptions :column="2" border size="small" :title="cloud.name + ' API'">
                    <el-descriptions-item label="Endpoint">
                      <el-input v-model="cloud.api.endpoint" placeholder="https://..." />
                    </el-descriptions-item>
                    <el-descriptions-item label="Access Key">
                      <el-input v-model="cloud.api.access_key" placeholder="AK" />
                    </el-descriptions-item>
                    <el-descriptions-item label="Secret Key">
                      <el-input v-model="cloud.api.secret_key" type="password" show-password placeholder="SK" />
                    </el-descriptions-item>
                    <el-descriptions-item label="Region">
                      <el-input v-model="cloud.api.region" placeholder="cn-hangzhou" />
                    </el-descriptions-item>
                  </el-descriptions>
                </div>

                <el-form-item>
                  <el-button type="primary" @click="saveCloudPricing">保存价格采集配置</el-button>
                  <el-button @click="resetCloudPricing">恢复默认</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="LLM 配置" name="llm">
              <el-alert type="warning" :closable="false" style="margin-bottom: 16px">
                配置大语言模型 API 后，Skill Center 中的 AI Skill（报价生成、SOW 生成、WBS 生成等）将调用真实 LLM 而非 Mock 数据。API Key 仅存储在本地浏览器中。
              </el-alert>

              <el-form label-width="160px" style="max-width: 700px">
                <el-divider content-position="left">模型提供商</el-divider>
                <el-form-item label="提供商">
                  <el-radio-group v-model="llmForm.provider" @change="onLLMProviderChange">
                    <el-radio label="zhipu">智谱GLM (永久免费·推荐测试)</el-radio>
                    <el-radio label="workbuddy">TokenHub (多模型网关)</el-radio>
                    <el-radio label="deepseek">DeepSeek (官方直连)</el-radio>
                    <el-radio label="trae">Trae (火山方舟)</el-radio>
                    <el-radio label="qwen">通义千问 (DashScope)</el-radio>
                    <el-radio label="openai">OpenAI 兼容接口</el-radio>
                    <el-radio label="mock">Mock 模式（不调用 LLM）</el-radio>
                  </el-radio-group>
                </el-form-item>

                <template v-if="llmForm.provider !== 'mock'">
                  <el-form-item label="API Key">
                    <el-input v-model="llmForm.api_key" type="password" show-password placeholder="sk-xxxxxxxxxxxxxxxx" />
                    <div class="el-upload__tip">{{ llmApiKeyTip }}</div>
                  </el-form-item>
                  <el-form-item label="模型名称">
                    <el-select v-model="llmForm.model" filterable allow-create style="width: 100%">
                      <template v-if="llmForm.provider === 'zhipu'">
                        <el-option label="glm-4-flash (永久免费·推荐)" value="glm-4-flash" />
                        <el-option label="glm-4.7-flash (永久免费·编程强)" value="glm-4.7-flash" />
                        <el-option label="glm-4-plus (付费·能力强)" value="glm-4-plus" />
                        <el-option label="glm-4-air (付费·轻量)" value="glm-4-air" />
                      </template>
                      <template v-else-if="llmForm.provider === 'workbuddy'">
                        <el-option label="glm-5.2 (推荐·智谱最新)" value="glm-5.2" />
                        <el-option label="deepseek-v4-flash (DeepSeek·轻量快)" value="deepseek-v4-flash" />
                        <el-option label="deepseek-v4-pro (DeepSeek·能力强)" value="deepseek-v4-pro" />
                        <el-option label="hy3 (腾讯混元最新)" value="hy3" />
                        <el-option label="hy3-preview (混元·Agent优化)" value="hy3-preview" />
                        <el-option label="qwen3.5-plus (通义千问)" value="qwen3.5-plus" />
                        <el-option label="qwen3.5-flash (通义千问·轻量)" value="qwen3.5-flash" />
                        <el-option label="kimi-k2.7-code (Kimi·代码)" value="kimi-k2.7-code" />
                        <el-option label="minimax-m3 (MiniMax)" value="minimax-m3" />
                        <el-option label="glm-5.1 (智谱)" value="glm-5.1" />
                        <el-option label="glm-5-turbo (智谱·快速)" value="glm-5-turbo" />
                        <el-option label="deepseek-v3.2 (DeepSeek旧版)" value="deepseek-v3.2" />
                      </template>
                      <template v-else-if="llmForm.provider === 'trae'">
                        <el-option label="doubao-seed-2-1-pro-260628 (推荐)" value="doubao-seed-2-1-pro-260628" />
                        <el-option label="doubao-1-5-pro-256k (长文本)" value="doubao-1-5-pro-256k" />
                        <el-option label="doubao-1-5-lite-32k (轻量)" value="doubao-1-5-lite-32k" />
                        <el-option label="deepseek-v3-241226 (DeepSeek)" value="deepseek-v3-241226" />
                      </template>
                      <template v-else-if="llmForm.provider === 'deepseek'">
                        <el-option label="deepseek-v4-flash (推荐·轻量快速)" value="deepseek-v4-flash" />
                        <el-option label="deepseek-v4-pro (能力强)" value="deepseek-v4-pro" />
                        <el-option label="deepseek-chat (V3·将于 2026/07/24 下线)" value="deepseek-chat" />
                        <el-option label="deepseek-reasoner (R1·将于 2026/07/24 下线)" value="deepseek-reasoner" />
                      </template>
                      <template v-else-if="llmForm.provider === 'qwen'">
                        <el-option label="qwen-plus (推荐)" value="qwen-plus" />
                        <el-option label="qwen-max (最强)" value="qwen-max" />
                        <el-option label="qwen-turbo (最快)" value="qwen-turbo" />
                        <el-option label="qwen-long (长文本)" value="qwen-long" />
                      </template>
                      <template v-else>
                        <el-option label="gpt-4o" value="gpt-4o" />
                        <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
                        <el-option label="deepseek-chat" value="deepseek-chat" />
                        <el-option label="glm-4-plus" value="glm-4-plus" />
                      </template>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="API Base URL">
                    <el-input v-model="llmForm.base_url" :placeholder="llmBaseUrlPlaceholder" />
                    <div class="el-upload__tip">{{ llmBaseUrlTip }}</div>
                  </el-form-item>
                </template>

                <el-divider content-position="left">生成参数</el-divider>
                <el-form-item label="温度 (Temperature)">
                  <el-slider v-model="llmForm.temperature" :min="0" :max="2" :step="0.1" show-input />
                  <div class="el-upload__tip">0 = 确定性输出，1 = 较有创意，2 = 非常随机</div>
                </el-form-item>
                <el-form-item label="最大 Tokens">
                  <el-input-number v-model="llmForm.max_tokens" :min="256" :max="8192" :step="256" />
                </el-form-item>

                <el-form-item>
                  <el-button type="primary" @click="saveLLMConfig">保存配置</el-button>
                  <el-button @click="testLLMConnection" :loading="llmTesting">测试连接</el-button>
                  <el-button @click="resetCurrentProviderConfig">重置为默认</el-button>
                </el-form-item>
              </el-form>

              <el-card shadow="never" style="margin-top: 20px" v-if="llmTestResult">
                <template #header>测试结果</template>
                <el-alert :type="llmTestResult.success ? 'success' : 'error'" :closable="false">
                  {{ llmTestResult.success ? '✅ 连接成功' : '❌ 连接失败' }}：{{ llmTestResult.message }}
                </el-alert>
                <div v-if="llmTestResult.response" style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 13px; white-space: pre-wrap;">{{ llmTestResult.response }}</div>
              </el-card>
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

            <el-tab-pane label="数据管理" name="data">
              <el-alert type="info" :closable="false" style="margin-bottom: 16px">
                数据使用 IndexedDB 持久化存储（容量 50MB+，不会因清浏览器缓存丢失）。可导出为 JSON 文件备份或迁移到其他设备。
              </el-alert>

              <el-descriptions :column="2" border style="max-width: 600px; margin-bottom: 20px">
                <el-descriptions-item label="存储条目数">{{ storageInfo.itemCount || '-' }} 条</el-descriptions-item>
                <el-descriptions-item label="缓存大小">{{ storageInfo.cacheSizeKB || '-' }} KB</el-descriptions-item>
                <el-descriptions-item label="总用量">{{ storageInfo.totalUsageKB ? storageInfo.totalUsageKB + ' KB' : '-' }}</el-descriptions-item>
                <el-descriptions-item label="存储配额">{{ storageInfo.quotaKB ? (storageInfo.quotaKB > 1024 ? (storageInfo.quotaKB / 1024).toFixed(1) + ' MB' : storageInfo.quotaKB + ' KB') : '-' }}</el-descriptions-item>
              </el-descriptions>

              <el-divider content-position="left">备份与恢复</el-divider>
              <div style="display: flex; gap: 12px; flex-wrap: wrap">
                <el-button type="primary" :loading="exporting" @click="handleExportData">
                  <el-icon><Download /></el-icon> 导出全部数据
                </el-button>
                <el-button :loading="importing" @click="handleImportData">
                  <el-icon><Upload /></el-icon> 从文件导入
                </el-button>
                <el-button type="danger" @click="handleClearData">
                  <el-icon><Delete /></el-icon> 清除全部数据
                </el-button>
              </div>

              <el-divider content-position="left">存储说明</el-divider>
              <el-table :data="storageDetails" border size="small" style="max-width: 700px">
                <el-table-column prop="key" label="数据项" width="200" />
                <el-table-column prop="desc" label="说明" min-width="200" />
                <el-table-column prop="size" label="大小" width="100" />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AccountManagement from './AccountManagement.vue'
import { useAuthStore } from '@/store/auth'
import { llmApi } from '@/api'
import { getItem, setItem, removeItem, getJSON, setJSON, getStorageInfo, exportToFile, importFromFile, clearAllData } from '@/utils/db'

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

const defaultCloudPricing = {
  version: 2,
  mode: 'mock',
  refresh_interval_hours: '4',
  clouds: [
    { id: 'aliyun', name: '阿里云', enabled: true, unitPrices: { ecs: 338, rds: 880, storage: 12.0, network: 23.0 }, api: { endpoint: 'https://www.aliyun.com/price/product', access_key: '', secret_key: '', region: 'cn-hangzhou' } },
    { id: 'huawei', name: '华为云', enabled: true, unitPrices: { ecs: 320, rds: 850, storage: 11.9, network: 22.5 }, api: { endpoint: 'https://www.huaweicloud.com/pricing.html', access_key: '', secret_key: '', region: 'cn-east-2' } },
    { id: 'tencent', name: '腾讯云', enabled: true, unitPrices: { ecs: 318, rds: 820, storage: 11.8, network: 22.0 }, api: { endpoint: 'https://buy.cloud.tencent.com/price', access_key: '', secret_key: '', region: 'ap-guangzhou' } },
    { id: 'aws', name: 'AWS', enabled: true, unitPrices: { ecs: 910, rds: 1900, storage: 16.7, network: 65.0 }, api: { endpoint: 'https://calculator.aws/', access_key: '', secret_key: '', region: 'us-east-1' } },
    { id: 'azure', name: 'Azure', enabled: false, unitPrices: { ecs: 980, rds: 1850, storage: 13.4, network: 60.0 }, api: { endpoint: 'https://azure.microsoft.com/zh-cn/pricing/calculator/', access_key: '', secret_key: '', region: 'eastasia' } },
    { id: 'baidu', name: '百度云', enabled: false, unitPrices: { ecs: 290, rds: 760, storage: 11.5, network: 21.0 }, api: { endpoint: 'https://cloud.baidu.com/product-pricing.html', access_key: '', secret_key: '', region: 'bj' } },
    { id: 'jd', name: '京东云', enabled: false, unitPrices: { ecs: 295, rds: 780, storage: 12.0, network: 21.5 }, api: { endpoint: 'https://www.jdcloud.com/cn/calculator', access_key: '', secret_key: '', region: 'cn-north-1' } },
    { id: 'ucloud', name: 'UCloud', enabled: false, unitPrices: { ecs: 310, rds: 820, storage: 12.5, network: 22.0 }, api: { endpoint: 'https://www.ucloud.cn/site/price.html', access_key: '', secret_key: '', region: 'cn-bj2' } },
  ],
}

const cloudPricingForm = reactive(JSON.parse(JSON.stringify(defaultCloudPricing)))
// 只读计算属性：避免 .filter() 创建新数组导致 v-model 失效
const enabledClouds = computed(() => cloudPricingForm.clouds.filter(c => c.enabled))

// LLM 配置（按 provider 隔离存储）
const llmProviderPresets = {
  zhipu: {
    api_key: '',
    model: 'glm-4-flash',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '在 https://open.bigmodel.cn 注册后「API Keys」页面创建，格式 xxxxxxxx。新用户送 2000 万 token，GLM-4-Flash 永久免费',
    urlTip: '智谱 AI OpenAI 兼容端点。GLM-4-Flash 永久免费不限量、128K 上下文；GLM-4.7-Flash 永久免费、200K、编程能力强',
  },
  workbuddy: {
    api_key: '',
    model: 'glm-5.2',
    base_url: 'https://tokenhub.tencentmaas.com/v1',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '在腾讯云 TokenHub 控制台创建 API Key（sk- 开头）：https://console.cloud.tencent.com/tokenhub/apikey。一个 Key 可调用 GLM/DeepSeek/混元/Qwen/Kimi 等所有模型',
    urlTip: 'TokenHub 多模型统一网关，兼容 OpenAI 接口。一个 Key 通吃 GLM-5.2、DeepSeek-V4、混元、通义千问、Kimi、MiniMax 等主流模型',
  },
  trae: {
    api_key: '',
    model: 'doubao-seed-2-1-pro-260628',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '在火山引擎控制台「火山方舟」获取 ARK_API_KEY',
    urlTip: '火山方舟 OpenAI 兼容端点，Trae 默认接入；模型名也可填入方舟的接入点 endpoint_id',
  },
  deepseek: {
    api_key: '',
    model: 'deepseek-v4-flash',
    base_url: 'https://api.deepseek.com/v1',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '在 https://platform.deepseek.com 注册后「API keys」页面创建，格式 sk-xxxxxxxx，注册即送额度',
    urlTip: 'DeepSeek 官方 OpenAI 兼容端点。模型选 v4-flash 轻量快 / v4-pro 能力强；旧版 chat/reasoner 将于 2026/07/24 下线。Base URL 可填 api.deepseek.com 或 api.deepseek.com/v1，后端会自动补全',
  },
  qwen: {
    api_key: '',
    model: 'qwen-plus',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '在阿里云 DashScope 控制台创建 API Key，格式 sk-xxxxxxxx',
    urlTip: '阿里云 DashScope OpenAI 兼容端点',
  },
  openai: {
    api_key: '',
    model: 'gpt-4o',
    base_url: 'https://api.openai.com/v1',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '兼容 OpenAI 接口的服务均可，如 DeepSeek、智谱、月之暗面等',
    urlTip: '兼容 OpenAI 接口的服务地址。填 api.deepseek.com 或 api.openai.com/v1 均可，后端自动补全 /v1 和 /chat/completions',
  },
  mock: {
    api_key: '',
    model: '',
    base_url: '',
    temperature: 0.7,
    max_tokens: 2048,
    apiKeyTip: '',
    urlTip: '',
  },
}

const llmForm = reactive({
  provider: 'mock',
  api_key: '',
  model: '',
  base_url: '',
  temperature: 0.7,
  max_tokens: 2048,
})
const llmSavedConfigs = reactive({})
const llmTesting = ref(false)
const llmTestResult = ref(null)

const llmApiKeyTip = computed(() => llmProviderPresets[llmForm.provider]?.apiKeyTip || '')
const llmBaseUrlPlaceholder = computed(() => llmProviderPresets[llmForm.provider]?.base_url || 'https://api.openai.com/v1')
const llmBaseUrlTip = computed(() => llmProviderPresets[llmForm.provider]?.urlTip || '')

// 将当前表单内容保存到 llmSavedConfigs 对应 provider
function saveCurrentProviderConfig() {
  llmSavedConfigs[llmForm.provider] = {
    api_key: llmForm.api_key,
    model: llmForm.model,
    base_url: llmForm.base_url,
    temperature: llmForm.temperature,
    max_tokens: llmForm.max_tokens,
  }
}

// 应用指定 provider 的配置：
// model 与 base_url 始终使用预设默认值（保证不同 provider 不串配置），
// 仅 api_key / temperature / max_tokens 使用用户已保存的值
function applyProviderConfig(provider) {
  const saved = llmSavedConfigs[provider]
  const preset = llmProviderPresets[provider]
  if (!preset) {
    llmForm.provider = provider
    return
  }
  Object.assign(llmForm, {
    provider,
    api_key: saved?.api_key || preset.api_key,
    model: preset.model,
    base_url: preset.base_url,
    temperature: saved?.temperature ?? preset.temperature,
    max_tokens: saved?.max_tokens ?? preset.max_tokens,
  })
}

// 切换提供商时先保存当前配置，再加载新配置
function onLLMProviderChange(val) {
  saveCurrentProviderConfig()
  applyProviderConfig(val)
}

// 重置当前 provider 为预设默认值（清除可能残留的旧数据）
function resetCurrentProviderConfig() {
  const preset = llmProviderPresets[llmForm.provider]
  if (preset) {
    Object.assign(llmForm, {
      api_key: preset.api_key,
      model: preset.model,
      base_url: preset.base_url,
      temperature: preset.temperature,
      max_tokens: preset.max_tokens,
    })
    // 同时清除 savedConfigs 中该 provider 的残留数据
    delete llmSavedConfigs[llmForm.provider]
    ElMessage.success(`已重置 ${getProviderLabel(llmForm.provider)} 配置为默认值`)
  }
}

function getProviderLabel(provider) {
  const labels = { zhipu: '智谱GLM (免费)', workbuddy: 'TokenHub (多模型网关)', trae: 'Trae (火山方舟)', deepseek: 'DeepSeek', qwen: '通义千问', openai: 'OpenAI 兼容', mock: 'Mock' }
  return labels[provider] || provider
}

// 监听 provider 变化，确保切换时配置一定更新（安全兜底）
watch(() => llmForm.provider, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    saveCurrentProviderConfig()
    // 强制使用预设值，忽略可能残留的脏数据
    const preset = llmProviderPresets[newVal]
    if (preset) {
      llmForm.api_key = llmSavedConfigs[newVal]?.api_key || preset.api_key
      llmForm.model = preset.model  // 模型始终用预设默认值
      llmForm.base_url = preset.base_url  // URL 始终用预设默认值
      llmForm.temperature = llmSavedConfigs[newVal]?.temperature ?? preset.temperature
      llmForm.max_tokens = llmSavedConfigs[newVal]?.max_tokens ?? preset.max_tokens
    }
  }
})

onMounted(() => {
  const saved = getItem('aicc_branding')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(brandingForm, data)
    } catch {}
  }

  const savedPricing = getItem('aicc_cloud_pricing')
  if (savedPricing) {
    try {
      const data = JSON.parse(savedPricing)
      // 版本号不匹配时强制使用新默认配置
      if (data.version && data.version >= 2) {
        Object.assign(cloudPricingForm, data)
      } else {
        setItem('aicc_cloud_pricing', JSON.stringify(defaultCloudPricing))
        Object.assign(cloudPricingForm, JSON.parse(JSON.stringify(defaultCloudPricing)))
      }
    } catch {}
  } else {
    // 首次使用，写入默认配置
    setItem('aicc_cloud_pricing', JSON.stringify(defaultCloudPricing))
  }

  // 加载 LLM 配置（按 provider 隔离）
  const savedLLM = getItem('aicc_llm_config')
  if (savedLLM) {
    try {
      const data = JSON.parse(savedLLM)
      // 仅加载新版隔离格式（含 providers 结构）
      if (data.providers && typeof data.providers === 'object') {
        Object.assign(llmSavedConfigs, data.providers)
        applyProviderConfig(data.provider || 'mock')
      } else {
        // 旧格式（单 provider 扁平结构）存在脏数据风险，直接丢弃，用预设初始化
        removeItem('aicc_llm_config')
        applyProviderConfig('mock')
      }
    } catch {
      removeItem('aicc_llm_config')
      applyProviderConfig('mock')
    }
  } else {
    applyProviderConfig('mock')
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
  setItem('aicc_branding', JSON.stringify({
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
  setItem('aicc_security', JSON.stringify({
    show_default_on_login: securityConfig.show_default_on_login,
  }))
  ElMessage.success(securityConfig.show_default_on_login ? '已开启登录页显示默认密码' : '已关闭登录页显示默认密码')
}

function saveSecurityForm() {
  setItem('aicc_security_policy', JSON.stringify({
    min_password_length: securityForm.min_password_length,
    password_expire_days: securityForm.password_expire_days,
    max_login_attempts: securityForm.max_login_attempts,
  }))
  ElMessage.success('安全策略已保存')
}

function saveCloudPricing() {
  setItem('aicc_cloud_pricing', JSON.stringify({
    version: 2,
    mode: cloudPricingForm.mode,
    refresh_interval_hours: cloudPricingForm.refresh_interval_hours,
    clouds: cloudPricingForm.clouds,
  }))
  ElMessage.success('价格采集配置已保存，刷新多云对比页面后生效')
}

function resetCloudPricing() {
  Object.assign(cloudPricingForm, JSON.parse(JSON.stringify(defaultCloudPricing)))
  ElMessage.info('已恢复默认配置，请保存后生效')
}

// LLM 配置
function saveLLMConfig() {
  saveCurrentProviderConfig()
  setItem('aicc_llm_config', JSON.stringify({
    provider: llmForm.provider,
    providers: { ...llmSavedConfigs },
  }))
  ElMessage.success('LLM 配置已保存，切换 provider 后各自配置互不干扰')
}

async function testLLMConnection() {
  if (llmForm.provider === 'mock') {
    llmTestResult.value = { success: true, message: 'Mock 模式，无需测试连接', response: '' }
    return
  }
  if (!llmForm.api_key) {
    llmTestResult.value = { success: false, message: '请先填写 API Key', response: '' }
    return
  }
  llmTesting.value = true
  try {
    const res = await llmApi.test({
      provider: llmForm.provider,
      api_key: llmForm.api_key,
      model: llmForm.model,
      base_url: llmForm.base_url,
      temperature: 0.1,
      max_tokens: 50,
    })
    llmTestResult.value = {
      success: res.success,
      message: res.message,
      response: res.response || '',
    }
  } catch (err) {
    llmTestResult.value = {
      success: false,
      message: err?.response?.data?.detail || err.message || '网络错误',
      response: '',
    }
  } finally {
    llmTesting.value = false
  }
}

// ==================== 数据管理 ====================
const storageInfo = ref({})
const exporting = ref(false)
const importing = ref(false)

const storageDetails = computed(() => {
  const keys = [
    { key: 'aicc_branding', desc: '品牌定制设置（系统名称、Logo、登录页标题）' },
    { key: 'aicc_cloud_pricing', desc: '云价格采集配置（各云厂商单价、API 配置）' },
    { key: 'aicc_llm_config', desc: 'LLM 配置（Provider、API Key、模型、参数）' },
    { key: 'aicc_security', desc: '安全配置（默认密码显示开关）' },
    { key: 'aicc_security_policy', desc: '安全策略（密码长度、过期天数、锁定次数）' },
    { key: 'aicc_mock_customers', desc: '客户数据（Mock 模式）' },
    { key: 'aicc_mock_opportunities', desc: '商机数据（Mock 模式）' },
    { key: 'aicc_mock_factsheets', desc: 'Fact Sheet 数据' },
    { key: 'aicc_mock_skills', desc: 'Skill 执行历史与学习参数' },
    { key: 'aicc_quotation_', desc: '报价单数据（按商机 ID 存储，刷新不丢）' },
    { key: 'aicc_sow_', desc: 'SOW 文档数据（按商机 ID 存储）' },
    { key: 'aicc_wbs_', desc: 'WBS 任务分解数据（按商机 ID 存储）' },
    { key: 'token', desc: '登录 Token（JWT）' },
  ]
  return keys.map(k => {
    const raw = getItem(k.key)
    return { ...k, size: raw ? Math.round(raw.length / 1024 * 10) / 10 + ' KB' : '-' }
  })
})

async function loadStorageInfo() {
  storageInfo.value = await getStorageInfo()
}

async function handleExportData() {
  exporting.value = true
  try {
    const result = await exportToFile()
    if (result) {
      ElMessage.success(`数据已导出到 ${result.fileName}`)
      await loadStorageInfo()
    }
  } catch (e) {
    ElMessage.error(`导出失败: ${e.message}`)
  } finally {
    exporting.value = false
  }
}

async function handleImportData() {
  importing.value = true
  try {
    const result = await importFromFile()
    if (result) {
      ElMessage.success(`已从 ${result.fileName} 导入 ${result.count} 条数据，刷新页面后生效`)
      await loadStorageInfo()
      setTimeout(() => window.location.reload(), 1500)
    }
  } catch (e) {
    ElMessage.error(`导入失败: ${e.message}`)
  } finally {
    importing.value = false
  }
}

async function handleClearData() {
  try {
    await ElMessageBox.confirm(
      '此操作将清除所有本地数据（包括 LLM 配置、品牌设置、价格配置、Mock 数据等），且不可恢复。建议先导出备份。确认继续？',
      '危险操作',
      { type: 'warning', confirmButtonText: '确认清除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }
  try {
    await clearAllData()
    ElMessage.success('所有数据已清除，页面将刷新')
    setTimeout(() => window.location.reload(), 1500)
  } catch (e) {
    ElMessage.error(`清除失败: ${e.message}`)
  }
}

// 监听 tab 切换到数据管理时加载统计
watch(activeTab, (val) => {
  if (val === 'data') loadStorageInfo()
})
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
