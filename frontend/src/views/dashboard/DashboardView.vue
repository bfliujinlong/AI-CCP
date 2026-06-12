<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stat-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <p class="stat-label">客户总数</p>
              <h2 class="stat-value">{{ stats.customer_count || 0 }}</h2>
            </div>
            <el-icon :size="48" color="#409EFF"><OfficeBuilding /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <p class="stat-label">商机总数</p>
              <h2 class="stat-value">{{ stats.opportunity_count || 0 }}</h2>
            </div>
            <el-icon :size="48" color="#67C23A"><Opportunity /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <p class="stat-label">活跃商机</p>
              <h2 class="stat-value">{{ stats.active_opportunity_count || 0 }}</h2>
            </div>
            <el-icon :size="48" color="#E6A23C"><TrendCharts /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <p class="stat-label">预计总收入</p>
              <h2 class="stat-value">¥{{ formatRevenue(stats.total_revenue) }}</h2>
            </div>
            <el-icon :size="48" color="#F56C6C"><Money /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>商机状态分布</span>
          </template>
          <v-chart :option="statusChartOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>商机类型分布</span>
          </template>
          <v-chart :option="typeChartOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>最近商机</span>
          <el-button type="primary" link @click="$router.push('/opportunities')">查看全部</el-button>
        </div>
      </template>
      <el-table :data="stats.recent_opportunities || []" stripe>
        <el-table-column prop="name" label="商机名称" min-width="200" />
        <el-table-column prop="customer_name" label="客户" width="180" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="estimated_revenue" label="预计收入" width="150">
          <template #default="{ row }">
            {{ row.estimated_revenue ? '¥' + Number(row.estimated_revenue).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { dashboardApi } from '@/api'
import dayjs from 'dayjs'

use([CanvasRenderer, PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const stats = ref({})

onMounted(async () => {
  try {
    stats.value = await dashboardApi.stats()
  } catch (e) {
    // handled by interceptor
  }
})

const statusColors = {
  discovery: '#409EFF',
  proposal: '#E6A23C',
  negotiation: '#F56C6C',
  closed_won: '#67C23A',
  closed_lost: '#909399',
}

const statusLabels = {
  discovery: '发现阶段',
  proposal: '方案阶段',
  negotiation: '谈判阶段',
  closed_won: '赢单',
  closed_lost: '输单',
}

function statusTagType(status) {
  const map = { discovery: '', proposal: 'warning', negotiation: 'danger', closed_won: 'success', closed_lost: 'info' }
  return map[status] || ''
}

function statusLabel(status) {
  return statusLabels[status] || status
}

function formatRevenue(val) {
  if (!val) return '0'
  if (val >= 10000) return (val / 10000).toFixed(1) + '万'
  return val.toLocaleString()
}

function formatDate(dateStr) {
  return dateStr ? dayjs(dateStr).format('YYYY-MM-DD HH:mm') : '-'
}

const statusChartOption = computed(() => {
  const data = stats.value.opportunities_by_status || {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}' },
        data: Object.entries(data).map(([key, value]) => ({
          name: statusLabels[key] || key,
          value,
          itemStyle: { color: statusColors[key] || '#409EFF' },
        })),
      },
    ],
  }
})

const typeChartOption = computed(() => {
  const data = stats.value.opportunities_by_type || {}
  return {
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'bar',
        data: Object.entries(data).map(([key, value]) => ({ name: key, value })),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: '#409EFF',
        },
        barWidth: '50%',
      },
    ],
    xAxis: {
      type: 'category',
      data: Object.keys(data),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value' },
    grid: { left: 40, right: 20, bottom: 60, top: 20 },
  }
})
</script>

<style scoped>
.stat-cards {
  margin-bottom: 0;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin: 0 0 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}
</style>
