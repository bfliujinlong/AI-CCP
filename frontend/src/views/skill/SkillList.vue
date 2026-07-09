<template>
  <div class="skill-list">
    <el-card shadow="never">
      <div class="page-header">
        <h2>Skill Center</h2>
        <div>
          <el-button @click="showImportDialog">
            <el-icon><Upload /></el-icon> 导入 Skill
          </el-button>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon> 新建 Skill
          </el-button>
        </div>
      </div>

      <el-row :gutter="20">
        <el-col :span="8" v-for="skill in skills" :key="skill.id">
          <el-card shadow="hover" class="skill-card" @click="showSkillDetail(skill)">
            <div class="skill-header">
              <el-icon :size="32" color="#409EFF"><MagicStick /></el-icon>
              <el-tag :type="skill.status === 'active' ? 'success' : 'info'" size="small">
                {{ skill.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </div>
            <h3 class="skill-name">{{ skill.name }}</h3>
            <p class="skill-desc">{{ skill.description || '暂无描述' }}</p>
            <div class="skill-meta">
              <el-tag size="small" type="info">{{ skill.category }}</el-tag>
              <span class="skill-version">v{{ skill.version }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="skills.length === 0" description="暂无 Skill" />
    </el-card>

    <el-dialog v-model="detailVisible" :title="currentSkill?.name" width="700px" destroy-on-close>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ currentSkill?.name }}</el-descriptions-item>
        <el-descriptions-item label="类别">{{ currentSkill?.category }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ currentSkill?.version }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentSkill?.status === 'active' ? 'success' : 'info'" size="small">
            {{ currentSkill?.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ currentSkill?.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider>Prompt Template</el-divider>
      <el-input
        v-model="currentSkill.prompt_template"
        type="textarea"
        :rows="6"
        readonly
      />

      <el-divider>执行 Skill</el-divider>
      <el-form :model="executeForm" label-width="80px">
        <el-form-item label="输入参数">
          <el-input
            v-model="executeForm.inputsJson"
            type="textarea"
            :rows="4"
            placeholder='{"key": "value"}'
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="executing" @click="handleExecute">
            <el-icon><VideoPlay /></el-icon> 执行
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="executeResult" class="execute-result">
        <el-divider>执行结果</el-divider>
        <pre>{{ JSON.stringify(executeResult, null, 2) }}</pre>
      </div>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新建 Skill" width="700px" destroy-on-close>
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="createForm.name" placeholder="如: LZ-Discovery" />
        </el-form-item>
        <el-form-item label="类别" prop="category">
          <el-select v-model="createForm.category" style="width: 100%">
            <el-option label="Landing Zone" value="landing_zone" />
            <el-option label="Migration" value="migration" />
            <el-option label="Big Data" value="big_data" />
            <el-option label="Security" value="security" />
            <el-option label="General" value="general" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Prompt 模板" prop="prompt_template">
          <el-input v-model="createForm.prompt_template" type="textarea" :rows="6" placeholder="使用 {variable} 作为变量占位符" />
        </el-form-item>
        <el-form-item label="输入 Schema">
          <el-input v-model="createForm.input_schema_json" type="textarea" :rows="4" placeholder='{"key": "type"}' />
        </el-form-item>
        <el-form-item label="输出 Schema">
          <el-input v-model="createForm.output_schema_json" type="textarea" :rows="4" placeholder='{"key": "type"}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 导入 Skill 对话框 -->
    <el-dialog v-model="importVisible" title="导入 Skill" width="800px" destroy-on-close>
      <el-tabs v-model="importTab">
        <el-tab-pane label="从 URL 导入" name="url">
          <el-alert type="info" :closable="false" style="margin-bottom: 16px">
            粘贴 GitHub Raw 文件地址（右键文件 → Raw → 复制链接），支持 .md / .json / .yaml 格式
          </el-alert>
          <el-input v-model="importUrl" placeholder="https://raw.githubusercontent.com/user/repo/main/skills/pm-skill.md">
            <template #append>
              <el-button :loading="importFetching" @click="fetchFromUrl">获取</el-button>
            </template>
          </el-input>
          <el-divider content-position="left">快速导入示例</el-divider>
          <div class="quick-import-list">
            <el-button size="small" @click="importUrl = 'https://raw.githubusercontent.com/TencentCloud/TCCLI/master/README.md'; fetchFromUrl()">PM 项目管理 Skill</el-button>
            <el-button size="small" @click="loadPresetSkill('pm')">PM 项目管理 Skill（内置）</el-button>
            <el-button size="small" @click="loadPresetSkill('architect')">售前架构师 Skill（内置）</el-button>
            <el-button size="small" @click="loadPresetSkill('cost')">成本优化 Skill（内置）</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="上传文件" name="file">
          <el-alert type="info" :closable="false" style="margin-bottom: 16px">
            支持 .md（SKILL.md 格式）/ .json / .yaml / .txt 文件
          </el-alert>
          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileUpload"
            accept=".md,.json,.yaml,.yml,.txt"
          >
            <el-icon :size="40" color="#c0c4cc"><UploadFilled /></el-icon>
            <div>拖拽文件到此处，或<em>点击上传</em></div>
            <template #tip>
              <div>SKILL.md 格式：YAML frontmatter（--- 包裹）+ Markdown 正文（作为 Prompt 模板）</div>
            </template>
          </el-upload>
        </el-tab-pane>

        <el-tab-pane label="粘贴内容" name="paste">
          <el-alert type="info" :closable="false" style="margin-bottom: 16px">
            直接粘贴 SKILL.md 内容或 JSON 格式的 Skill 定义
          </el-alert>
          <el-input
            v-model="importRawContent"
            type="textarea"
            :rows="12"
            placeholder='---&#10;name: My-Skill&#10;description: 技能描述&#10;category: general&#10;---&#10;&#10;# Skill 内容&#10;&#10;你是一个...'
          />
          <el-button type="primary" style="margin-top: 12px" @click="parseRawContent">解析内容</el-button>
        </el-tab-pane>
      </el-tabs>

      <!-- 解析预览 -->
      <div v-if="importParsed" style="margin-top: 20px">
        <el-divider content-position="left">解析预览</el-divider>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称">
            <el-input v-model="importParsed.name" size="small" style="width: 200px" />
          </el-descriptions-item>
          <el-descriptions-item label="类别">
            <el-select v-model="importParsed.category" size="small" style="width: 150px">
              <el-option label="Landing Zone" value="landing_zone" />
              <el-option label="Migration" value="migration" />
              <el-option label="Big Data" value="big_data" />
              <el-option label="Security" value="security" />
              <el-option label="General" value="general" />
            </el-select>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            <el-input v-model="importParsed.description" size="small" />
          </el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">Prompt 模板</el-divider>
        <el-input
          v-model="importParsed.prompt_template"
          type="textarea"
          :rows="8"
        />
      </div>

      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" :disabled="!importParsed" @click="handleImport">
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { skillApi, factsheetApi } from '@/api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const skills = ref([])
const detailVisible = ref(false)
const createVisible = ref(false)
const currentSkill = ref(null)
const executing = ref(false)
const submitting = ref(false)
const executeResult = ref(null)
const createFormRef = ref(null)
const autoExecuting = ref(false)

const executeForm = reactive({
  inputsJson: '{}',
})

// 导入 Skill 相关
const importVisible = ref(false)
const importTab = ref('url')
const importUrl = ref('')
const importRawContent = ref('')
const importFetching = ref(false)
const importSubmitting = ref(false)
const importParsed = ref(null)

const createForm = reactive({
  name: '',
  category: '',
  description: '',
  prompt_template: '',
  input_schema_json: '{}',
  output_schema_json: '{}',
})

const createRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
  prompt_template: [{ required: true, message: '请输入 Prompt 模板', trigger: 'blur' }],
}

onMounted(async () => {
  await fetchData()
  // 检查是否有自动执行的 skill 参数
  const autoSkill = route.query.skill
  if (autoSkill) {
    const skill = skills.value.find(s => s.name === autoSkill)
    if (skill) {
      await autoExecuteSkill(skill)
    }
  }
})

async function fetchData() {
  const res = await skillApi.list()
  skills.value = res
}

async function autoExecuteSkill(skill) {
  autoExecuting.value = true
  currentSkill.value = { ...skill }
  try {
    // 获取默认商机的 Fact Sheet 数据作为输入
    const factSheets = await factsheetApi.list('o001')
    const latestFactSheet = factSheets.length > 0 ? factSheets[factSheets.length - 1] : null
    
    let inputs = {}
    if (latestFactSheet && latestFactSheet.facts) {
      inputs = { facts: latestFactSheet.facts, ...latestFactSheet.facts }
    }
    
    executeForm.inputsJson = JSON.stringify(inputs, null, 2)
    detailVisible.value = true
    
    // 自动执行
    await handleExecute()
  } finally {
    autoExecuting.value = false
  }
}

function showSkillDetail(skill) {
  currentSkill.value = { ...skill }
  executeForm.inputsJson = JSON.stringify(skill.input_schema || {}, null, 2)
  executeResult.value = null
  detailVisible.value = true
}

function showCreateDialog() {
  Object.assign(createForm, {
    name: '',
    category: '',
    description: '',
    prompt_template: '',
    input_schema_json: '{}',
    output_schema_json: '{}',
  })
  createVisible.value = true
}

async function handleExecute() {
  if (!currentSkill.value) return
  executing.value = true
  executeResult.value = null
  try {
    let inputs = {}
    try {
      inputs = JSON.parse(executeForm.inputsJson)
    } catch {
      ElMessage.error('输入参数 JSON 格式错误')
      return
    }
    const res = await skillApi.execute({
      skill_name: currentSkill.value.name,
      inputs,
    })
    executeResult.value = res.outputs
    ElMessage.success('执行完成')
    
    // 根据 Skill 类型自动跳转到对应结果页面
    const skillName = currentSkill.value.name
    if (skillName === 'Generate-Quotation') {
      router.push(`/quotation/o001`)
    } else if (skillName === 'Generate-SOW') {
      router.push(`/sow/o001`)
    } else if (skillName === 'Generate-WBS') {
      router.push(`/wbs/o001`)
    } else if (skillName === 'Generate-FactSheet') {
      router.push(`/factsheet/o001`)
    }
  } finally {
    executing.value = false
  }
}

async function handleCreate() {
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let inputSchema = {}
    let outputSchema = {}
    try {
      inputSchema = JSON.parse(createForm.input_schema_json)
    } catch {}
    try {
      outputSchema = JSON.parse(createForm.output_schema_json)
    } catch {}

    await skillApi.create({
      name: createForm.name,
      category: createForm.category,
      description: createForm.description,
      prompt_template: createForm.prompt_template,
      input_schema: inputSchema,
      output_schema: outputSchema,
    })
    ElMessage.success('Skill 创建成功')
    createVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

// ==================== 导入 Skill ====================

function showImportDialog() {
  importVisible.value = true
  importTab.value = 'url'
  importUrl.value = ''
  importRawContent.value = ''
  importParsed.value = null
}

// 从 URL 获取内容
async function fetchFromUrl() {
  if (!importUrl.value) {
    ElMessage.warning('请输入 URL')
    return
  }
  importFetching.value = true
  try {
    // GitHub raw URL 直接 fetch（支持 CORS）
    let url = importUrl.value.trim()
    // 如果是 github.com 页面链接，转成 raw 链接
    url = url.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    parseSkillContent(text)
    ElMessage.success('内容获取成功，已自动解析')
  } catch (e) {
    ElMessage.error(`获取失败: ${e.message}（可能跨域限制，请改用「上传文件」或「粘贴内容」）`)
  } finally {
    importFetching.value = false
  }
}

// 上传文件
function handleFileUpload(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    parseSkillContent(text)
    ElMessage.success('文件已读取，已自动解析')
  }
  reader.readAsText(file.raw)
}

// 粘贴内容解析
function parseRawContent() {
  if (!importRawContent.value) {
    ElMessage.warning('请粘贴内容')
    return
  }
  parseSkillContent(importRawContent.value)
  ElMessage.success('内容已解析')
}

// 解析 Skill 内容（支持 SKILL.md / JSON / 纯文本）
function parseSkillContent(text) {
  text = text.trim()
  let parsed = null

  // 尝试 JSON 格式
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text)
      parsed = {
        name: obj.name || '',
        category: obj.category || 'general',
        description: obj.description || '',
        prompt_template: obj.prompt_template || obj.prompt || '',
        input_schema: obj.input_schema || {},
        output_schema: obj.output_schema || {},
      }
    } catch {}
  }

  // 尝试 SKILL.md 格式（YAML frontmatter + Markdown body）
  if (!parsed && text.startsWith('---')) {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (fmMatch) {
      const frontmatter = fmMatch[1]
      const body = fmMatch[2].trim()
      const meta = parseYamlFrontmatter(frontmatter)
      parsed = {
        name: meta.name || '',
        category: meta.category || 'general',
        description: meta.description || '',
        prompt_template: body,
        input_schema: meta.input_schema || {},
        output_schema: meta.output_schema || {},
      }
    }
  }

  // 纯文本作为 prompt_template
  if (!parsed) {
    // 从内容第一行推测 name
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').trim()
    parsed = {
      name: firstLine.substring(0, 50) || 'Imported-Skill',
      category: 'general',
      description: '',
      prompt_template: text,
      input_schema: {},
      output_schema: {},
    }
  }

  importParsed.value = parsed
}

// 简易 YAML frontmatter 解析
function parseYamlFrontmatter(text) {
  const result = {}
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      result[key] = val
    }
  }
  return result
}

// 内置预设 Skill
function loadPresetSkill(type) {
  const presets = {
    pm: {
      name: 'PM-Project-Management',
      category: 'general',
      description: '项目管理专家 Skill，负责项目计划制定、风险跟踪、进度管理和团队协调',
      prompt_template: `你是一位资深项目管理专家（PMP），拥有 10+ 年云计算项目交付经验。

## 你的职责
1. 根据项目 Fact Sheet 制定详细的项目计划
2. 识别项目风险并给出缓解措施
3. 制定沟通计划和里程碑
4. 估算项目周期和资源需求
5. 生成 RACI 矩阵

## 输入
- 项目类型: {project_type}
- 目标云: {target_cloud}
- VM 数量: {vm_count}
- 数据库数量: {database_count}
- 安全等级: {security_level}

## 输出要求
请输出结构化的项目管理计划，包括：
1. 项目里程碑与时间线
2. 关键风险与缓解措施（表格）
3. RACI 矩阵
4. 沟通计划
5. 质量保障措施`,
    },
    architect: {
      name: 'PreSales-Architect',
      category: 'general',
      description: '售前架构师 Skill，负责云架构方案设计、技术选型、POC 规划和售前文档编写',
      prompt_template: `你是一位资深云架构师，精通阿里云、华为云、腾讯云、AWS、Azure 多云架构设计。

## 你的职责
1. 根据客户需求设计目标云架构（HLD + LLD）
2. 进行技术选型和方案对比
3. 规划 POC（概念验证）方案
4. 编写技术方案建议书
5. 评估架构风险和成本

## 输入
- 项目类型: {project_type}
- 当前云: {current_cloud}
- 目标云: {target_cloud}
- VM 数量: {vm_count}
- 数据库数量: {database_count}
- Region 数量: {region_count}
- 账号数量: {account_count}
- 安全等级: {security_level}

## 输出要求
请输出完整的架构设计方案：
1. 架构概述与设计原则
2. 网络架构设计（VPC/子网/安全组/专线）
3. 安全与合规架构
4. 高可用与灾备方案
5. 技术选型对比表
6. POC 验证计划
7. 预估架构风险与成本`,
    },
    cost: {
      name: 'Cloud-Cost-Optimization',
      category: 'general',
      description: '云成本优化专家 Skill，负责云资源成本分析、优化建议和节省方案制定',
      prompt_template: `你是一位云成本优化专家，精通 FinOps 实践和云资源成本分析。

## 你的职责
1. 分析当前云资源使用情况和成本分布
2. 识别成本优化机会（闲置资源、超配资源、预留实例等）
3. 制定短期和长期优化方案
4. 估算节省金额和 ROI
5. 生成成本优化报告

## 输入
- 目标云: {target_cloud}
- VM 数量: {vm_count}
- 数据库数量: {database_count}
- 月度云支出: {monthly_cost}

## 输出要求
请输出结构化的成本优化方案：
1. 当前成本分析（按服务分类）
2. 优化机会识别（表格：项目/当前成本/优化后成本/节省比例）
3. 短期优化措施（1-30天可执行）
4. 中长期优化措施（1-6个月）
5. 预估总体节省金额和 ROI`,
    },
  }
  const preset = presets[type]
  if (preset) {
    importParsed.value = { ...preset, input_schema: {}, output_schema: {} }
    importVisible.value = true
    ElMessage.success(`已加载预设 Skill: ${preset.name}`)
  }
}

// 确认导入
async function handleImport() {
  if (!importParsed.value) {
    ElMessage.warning('请先获取或解析 Skill 内容')
    return
  }
  if (!importParsed.value.name) {
    ElMessage.warning('请填写 Skill 名称')
    return
  }
  if (!importParsed.value.prompt_template) {
    ElMessage.warning('Prompt 模板不能为空')
    return
  }

  importSubmitting.value = true
  try {
    await skillApi.create({
      name: importParsed.value.name,
      category: importParsed.value.category,
      description: importParsed.value.description,
      prompt_template: importParsed.value.prompt_template,
      input_schema: importParsed.value.input_schema || {},
      output_schema: importParsed.value.output_schema || {},
    })
    ElMessage.success(`Skill "${importParsed.value.name}" 导入成功`)
    importVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(`导入失败: ${e?.response?.data?.detail || e.message}`)
  } finally {
    importSubmitting.value = false
  }
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

.skill-card {
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.2s;
}

.skill-card:hover {
  transform: translateY(-4px);
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.skill-name {
  font-size: 16px;
  margin: 0 0 8px;
  color: #303133;
}

.skill-desc {
  color: #909399;
  font-size: 13px;
  margin: 0 0 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skill-version {
  color: #909399;
  font-size: 12px;
}

.execute-result {
  max-height: 400px;
  overflow-y: auto;
}

.execute-result pre {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
}

.quick-import-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-import-list .el-button {
  margin: 0;
}
</style>
