<template>
  <div class="skill-list">
    <el-card shadow="never">
      <div class="page-header">
        <h2>Skill Center</h2>
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon> 新建 Skill
        </el-button>
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
</style>
