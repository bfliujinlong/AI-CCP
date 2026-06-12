<template>
  <div class="factsheet-view" v-loading="loading">
    <el-page-header @back="$router.back()" :title="'返回商机'">
      <template #content>
        <span class="detail-title">Fact Sheet - {{ opportunityName }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>Fact Sheet 历史</span>
              <el-button type="primary" size="small" @click="showCreateDialog = true">
                <el-icon><Plus /></el-icon> 新建 Fact Sheet
              </el-button>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="fs in factSheets"
              :key="fs.id"
              :timestamp="formatDate(fs.created_at)"
              placement="top"
            >
              <el-card shadow="hover">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
                  <div>
                    <el-tag size="small">{{ fs.category }}</el-tag>
                    <span style="margin-left: 8px; color: #909399">v{{ fs.version }}</span>
                  </div>
                </div>
                <el-descriptions :column="3" size="small" border>
                  <el-descriptions-item v-for="(value, key) in fs.facts" :key="key" :label="key">
                    {{ value }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="factSheets.length === 0" description="暂无 Fact Sheet" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>Fact Registry</template>
          <el-collapse v-model="activeCategories">
            <el-collapse-item
              v-for="(facts, category) in registryByCategory"
              :key="category"
              :title="category"
              :name="category"
            >
              <div v-for="fact in facts" :key="fact.fact_name" class="registry-item">
                <div class="registry-name">
                  {{ fact.fact_name }}
                  <el-tag v-if="fact.required" type="danger" size="small">必填</el-tag>
                </div>
                <div class="registry-desc">{{ fact.description }}</div>
                <div class="registry-type">类型: {{ fact.fact_type }}</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showCreateDialog" title="新建 Fact Sheet" width="700px" destroy-on-close>
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="类别" required>
          <el-select v-model="createForm.category" placeholder="请选择类别" style="width: 100%">
            <el-option label="基础设施" value="infrastructure" />
            <el-option label="安全合规" value="security" />
            <el-option label="治理" value="governance" />
            <el-option label="通用" value="general" />
          </el-select>
        </el-form-item>
        <el-divider />
        <el-form-item label="项目类型">
          <el-select v-model="createForm.facts.project_type" style="width: 100%">
            <el-option label="Landing Zone" value="landing_zone" />
            <el-option label="Migration" value="migration" />
            <el-option label="Big Data" value="big_data" />
            <el-option label="Hybrid Cloud" value="hybrid_cloud" />
            <el-option label="Security" value="security" />
            <el-option label="Cost Optimization" value="cost_optimization" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前云">
          <el-select v-model="createForm.facts.current_cloud" style="width: 100%">
            <el-option label="本地机房" value="on_premise" />
            <el-option label="AWS" value="aws" />
            <el-option label="Azure" value="azure" />
            <el-option label="阿里云" value="aliyun" />
            <el-option label="华为云" value="huawei" />
            <el-option label="腾讯云" value="tencent" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标云">
          <el-select v-model="createForm.facts.target_cloud" style="width: 100%">
            <el-option label="AWS" value="aws" />
            <el-option label="Azure" value="azure" />
            <el-option label="阿里云" value="aliyun" />
            <el-option label="华为云" value="huawei" />
            <el-option label="腾讯云" value="tencent" />
          </el-select>
        </el-form-item>
        <el-form-item label="VM数量">
          <el-input v-model.number="createForm.facts.vm_count" type="number" :min="0" placeholder="请输入VM数量" />
        </el-form-item>
        <el-form-item label="数据库数量">
          <el-input v-model.number="createForm.facts.database_count" type="number" :min="0" placeholder="请输入数据库数量" />
        </el-form-item>
        <el-form-item label="Region数量">
          <el-input v-model.number="createForm.facts.region_count" type="number" :min="1" placeholder="请输入Region数量" />
        </el-form-item>
        <el-form-item label="账号数量">
          <el-input v-model.number="createForm.facts.account_count" type="number" :min="1" placeholder="请输入账号数量" />
        </el-form-item>
        <el-form-item label="VPC数量">
          <el-input v-model.number="createForm.facts.vpc_count" type="number" :min="0" placeholder="请输入VPC数量" />
        </el-form-item>
        <el-form-item label="安全等级">
          <el-select v-model="createForm.facts.security_level" style="width: 100%">
            <el-option label="基础" value="basic" />
            <el-option label="中等" value="medium" />
            <el-option label="高级" value="advanced" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { factsheetApi, opportunityApi } from '@/api'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const opportunityName = ref('')
const factSheets = ref([])
const registry = ref([])
const showCreateDialog = ref(false)
const activeCategories = ref([])

const createForm = reactive({
  category: 'general',
  facts: {
    project_type: '',
    current_cloud: '',
    target_cloud: '',
    vm_count: 0,
    database_count: 0,
    region_count: 1,
    account_count: 1,
    vpc_count: 0,
    security_level: 'basic',
  },
})

const registryByCategory = computed(() => {
  const grouped = {}
  for (const item of registry.value) {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  return grouped
})

function formatDate(d) { return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-' }

onMounted(async () => {
  loading.value = true
  try {
    const opp = await opportunityApi.get(route.params.opportunityId)
    opportunityName.value = opp.name
    factSheets.value = await factsheetApi.list(route.params.opportunityId)
    registry.value = await factsheetApi.registry()
    activeCategories.value = Object.keys(registryByCategory.value)
  } finally {
    loading.value = false
  }
})

async function handleCreate() {
  submitting.value = true
  try {
    await factsheetApi.create({
      opportunity_id: route.params.opportunityId,
      category: createForm.category,
      facts: { ...createForm.facts },
    })
    ElMessage.success('Fact Sheet 已创建')
    showCreateDialog.value = false
    factSheets.value = await factsheetApi.list(route.params.opportunityId)
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

.registry-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.registry-item:last-child {
  border-bottom: none;
}

.registry-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.registry-desc {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

.registry-type {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}
</style>
