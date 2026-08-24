<template>
  <div class="audit-log-page">
    <div class="page-header">
      <h2>操作审计日志</h2>
      <p class="sub-title">查看所有 API 访问记录：来源 IP、操作账户、请求路径、操作类型</p>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom: 16px" v-if="stats">
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">按操作类型</div>
          <div v-for="item in stats.by_action.slice(0, 6)" :key="item.action" class="stat-row">
            <el-tag size="small" :type="getActionTagType(item.action)">{{ item.action }}</el-tag>
            <span class="stat-count">{{ item.count }} 次</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">按来源 IP (Top 10)</div>
          <div v-for="item in stats.by_ip" :key="item.ip" class="stat-row">
            <span class="ip-text">{{ item.ip }}</span>
            <span class="stat-count">{{ item.count }} 次</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <div class="stat-title">按用户 (Top 10)</div>
          <div v-for="item in stats.by_user" :key="item.username" class="stat-row">
            <span class="user-text">{{ item.username }}</span>
            <span class="stat-count">{{ item.count }} 次</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选 + 表格 -->
    <el-card shadow="never">
      <div class="filter-bar">
        <el-input v-model="filters.username" placeholder="用户名" clearable style="width: 120px" @clear="loadLogs" @keyup.enter="loadLogs" />
        <el-input v-model="filters.ip_address" placeholder="IP 地址" clearable style="width: 130px" @clear="loadLogs" @keyup.enter="loadLogs" />
        <el-select v-model="filters.action" placeholder="操作类型" clearable style="width: 150px" @change="loadLogs">
          <el-option v-for="a in actionOptions" :key="a" :label="a" :value="a" />
        </el-select>
        <el-select v-model="filters.method" placeholder="HTTP方法" clearable style="width: 100px" @change="loadLogs">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
        </el-select>
        <el-button type="primary" @click="loadLogs">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <el-button :icon="Refresh" circle @click="loadLogs" />
      </div>

      <el-table :data="logs" v-loading="loading" border size="small" style="width: 100%; margin-top: 12px">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            <span :class="{ 'recent-log': isRecent(row.created_at) }">{{ formatDateTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.username" size="small" type="info">{{ row.username }}</el-tag>
            <span v-else style="color: #c0c4cc">匿名</span>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="来源 IP" width="130" />
        <el-table-column prop="action" label="操作" width="130">
          <template #default="{ row }">
            <el-tag size="small" :type="getActionTagType(row.action)">{{ row.action || row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="method" label="方法" width="70" align="center">
          <template #default="{ row }">
            <span :style="{ color: getMethodColor(row.method), fontWeight: 'bold' }">{{ row.method }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="请求路径" min-width="250">
          <template #default="{ row }">
            <span class="path-text">{{ row.path }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_code" label="状态" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status_code)" size="small">{{ row.status_code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration_ms" label="耗时" width="80" align="right">
          <template #default="{ row }">
            <span :class="{ 'slow-log': row.duration_ms > 1000 }">{{ row.duration_ms }}ms</span>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center">
        <span style="color: #909399; font-size: 13px">共 {{ total }} 条记录</span>
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="pageSize"
          :page-sizes="[50, 100, 200]"
          layout="sizes, prev, pager, next"
          @current-change="loadLogs"
          @size-change="(s) => { pageSize = s; loadLogs() }"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { auditLogApi } from '@/api'

const loading = ref(false)
const logs = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const stats = ref(null)

const filters = reactive({
  username: '',
  ip_address: '',
  action: '',
  method: '',
})

const actionOptions = [
  'login', 'get_user_info', 'meeting_import', 'dashboard',
  'customer_get', 'customer_post', 'customer_put', 'customer_delete',
  'opportunity_get', 'opportunity_post', 'opportunity_put',
  'factsheet_get', 'factsheet_post',
  'skill_get', 'skill_post',
  'llm_chat', 'account_get', 'account_post', 'account_put',
]

function formatDateTime(dt) {
  if (!dt) return '-'
  return new Date(dt).toLocaleString('zh-CN', { hour12: false })
}

function isRecent(dt) {
  if (!dt) return false
  return Date.now() - new Date(dt).getTime() < 60000
}

function getActionTagType(action) {
  if (!action) return ''
  if (action.includes('login')) return 'success'
  if (action.includes('delete')) return 'danger'
  if (action.includes('post') || action.includes('import')) return 'warning'
  if (action.includes('put')) return 'warning'
  return 'info'
}

function getMethodColor(method) {
  return { GET: '#409EFF', POST: '#E6A23C', PUT: '#67C23A', DELETE: '#F56C6C' }[method] || '#909399'
}

function getStatusType(code) {
  if (!code) return ''
  if (code < 300) return 'success'
  if (code < 400) return 'info'
  if (code < 500) return 'warning'
  return 'danger'
}

async function loadLogs() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (filters.username) params.username = filters.username
    if (filters.ip_address) params.ip_address = filters.ip_address
    if (filters.action) params.action = filters.action
    if (filters.method) params.method = filters.method

    const res = await auditLogApi.list(params)
    logs.value = res.data.items || []
    total.value = res.data.total || 0
  } catch (err) {
    console.error('加载审计日志失败:', err)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await auditLogApi.stats()
    stats.value = res.data
  } catch (err) {
    console.warn('加载统计失败:', err)
  }
}

function resetFilters() {
  filters.username = ''
  filters.ip_address = ''
  filters.action = ''
  filters.method = ''
  page.value = 1
  loadLogs()
}

onMounted(() => {
  loadLogs()
  loadStats()
})
</script>

<style scoped>
.audit-log-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 22px;
}

.sub-title {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

.stat-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 13px;
}

.stat-count {
  color: #909399;
  font-size: 12px;
}

.ip-text {
  font-family: monospace;
  font-size: 12px;
}

.user-text {
  font-weight: 500;
}

.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.path-text {
  font-family: monospace;
  font-size: 12px;
  color: #606266;
}

.recent-log {
  color: #67c23a;
  font-weight: 500;
}

.slow-log {
  color: #f56c6c;
  font-weight: 500;
}
</style>
