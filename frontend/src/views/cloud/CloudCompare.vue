<template>
  <div class="cloud-compare">
    <el-card shadow="never">
      <div class="page-header">
        <h2>多云对比</h2>
        <div class="header-actions">
          <el-select v-model="selectedRegion" style="width: 160px; margin-right: 12px" @change="refreshPrices">
            <el-option label="华东1 (杭州)" value="cn-hangzhou" />
            <el-option label="华东2 (上海)" value="cn-shanghai" />
            <el-option label="华北2 (北京)" value="cn-beijing" />
            <el-option label="华南1 (广州)" value="cn-guangzhou" />
            <el-option label="华北3 (张家口)" value="cn-zhangjiakou" />
          </el-select>
          <el-button @click="refreshPrices" :loading="priceLoading">
            <el-icon><Refresh /></el-icon> 刷新价格
          </el-button>
        </div>
      </div>

      <el-alert type="info" :closable="false" style="margin-bottom: 20px">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>实时对比 8 朵云的计算、存储、网络、数据库等核心资源价格，帮助客户做出最优选择。价格数据来源于各云厂商官网，仅供参考。</span>
          <el-tag v-if="priceMeta.source" :type="priceMeta.source === 'api' ? 'success' : priceMeta.source === 'cache' ? 'primary' : 'warning'" size="small">
            {{ priceMeta.source === 'api' ? '实时价格' : priceMeta.source === 'cache' ? '缓存价格' : '基准价格' }}
            <span v-if="priceMeta.cached_at">({{ formatTime(priceMeta.cached_at) }})</span>
          </el-tag>
        </div>
      </el-alert>

      <el-row :gutter="16" class="cloud-cards">
        <el-col :span="6" v-for="cloud in clouds" :key="cloud.id">
          <el-card shadow="hover" class="cloud-card" :class="{ 'cloud-selected': selectedClouds.includes(cloud.id) }" @click="toggleCloud(cloud.id)">
            <div class="cloud-logo-area">
              <a :href="cloud.pricingUrl" target="_blank" rel="noopener noreferrer" title="点击跳转到官网价格/计费页面" @click.stop>
                <div class="cloud-badge" :style="{ background: cloud.color }">
                  {{ cloud.shortName }}
                </div>
              </a>
            </div>
            <h3 class="cloud-name">{{ cloud.name }}</h3>
            <p class="cloud-desc">{{ cloud.desc }}</p>
            <div class="cloud-tags">
              <el-tag size="small" :type="cloud.tier === 'tier1' ? 'danger' : cloud.tier === 'tier2' ? 'warning' : 'info'">
                {{ cloud.tier === 'tier1' ? '第一梯队' : cloud.tier === 'tier2' ? '第二梯队' : '第三梯队' }}
              </el-tag>
              <el-tag size="small" type="success" v-if="cloud.domestic">国内</el-tag>
              <el-tag size="small" type="warning" v-else>国际</el-tag>
            </div>
            <div class="cloud-check">
              <el-checkbox :model-value="selectedClouds.includes(cloud.id)" @click.stop @change="toggleCloud(cloud.id)">对比</el-checkbox>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider>资源价格对比</el-divider>

      <el-tabs v-model="priceTab">
        <el-tab-pane label="云服务器 ECS" name="ecs">
          <el-table :data="ecsPrices" stripe border show-summary :summary-method="getEcsSummary" v-loading="priceLoading">
            <el-table-column prop="spec" label="规格" min-width="180" fixed />
            <el-table-column v-for="cloud in selectedCloudList" :key="cloud.id" :label="cloud.name" min-width="140" align="right">
              <template #default="{ row }">
                <span v-if="row.prices && row.prices[cloud.id]" class="price-cell">
                  <span class="price-amount">¥{{ row.prices[cloud.id].monthly }}</span>
                  <span class="price-unit">/月</span>
                  <el-tag v-if="row.prices[cloud.id].cheapest" size="small" type="success" style="margin-left: 4px">最低</el-tag>
                </span>
                <span v-else class="price-na">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Kubernetes 集群" name="k8s">
          <el-table :data="k8sPrices" stripe border v-loading="priceLoading">
            <el-table-column prop="spec" label="规格" min-width="200" fixed />
            <el-table-column v-for="cloud in selectedCloudList" :key="cloud.id" :label="cloud.name" min-width="140" align="right">
              <template #default="{ row }">
                <span v-if="row.prices && row.prices[cloud.id]" class="price-cell">
                  <span class="price-amount">¥{{ row.prices[cloud.id].monthly }}</span>
                  <span class="price-unit">/月</span>
                </span>
                <span v-else class="price-na">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="云数据库 RDS" name="rds">
          <el-table :data="rdsPrices" stripe border v-loading="priceLoading">
            <el-table-column prop="spec" label="规格" min-width="200" fixed />
            <el-table-column v-for="cloud in selectedCloudList" :key="cloud.id" :label="cloud.name" min-width="140" align="right">
              <template #default="{ row }">
                <span v-if="row.prices && row.prices[cloud.id]" class="price-cell">
                  <span class="price-amount">¥{{ row.prices[cloud.id].monthly }}</span>
                  <span class="price-unit">/月</span>
                </span>
                <span v-else class="price-na">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="对象存储 OSS" name="oss">
          <el-table :data="ossPrices" stripe border v-loading="priceLoading">
            <el-table-column prop="spec" label="规格" min-width="200" fixed />
            <el-table-column v-for="cloud in selectedCloudList" :key="cloud.id" :label="cloud.name" min-width="140" align="right">
              <template #default="{ row }">
                <span v-if="row.prices && row.prices[cloud.id]" class="price-cell">
                  <span class="price-amount">¥{{ row.prices[cloud.id].perGB || row.prices[cloud.id].monthly }}</span>
                  <span class="price-unit">/GB/月</span>
                </span>
                <span v-else class="price-na">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="带宽/CDN" name="network">
          <el-table :data="networkPrices" stripe border v-loading="priceLoading">
            <el-table-column prop="spec" label="规格" min-width="200" fixed />
            <el-table-column v-for="cloud in selectedCloudList" :key="cloud.id" :label="cloud.name" min-width="140" align="right">
              <template #default="{ row }">
                <span v-if="row.prices && row.prices[cloud.id]" class="price-cell">
                  <span class="price-amount">¥{{ row.prices[cloud.id].price || row.prices[cloud.id].monthly }}</span>
                  <span class="price-unit">{{ row.prices[cloud.id].unit || '/月' }}</span>
                </span>
                <span v-else class="price-na">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <el-divider>总成本估算</el-divider>

      <el-card shadow="never" class="cost-summary">
        <el-form :model="costForm" label-width="120px" inline>
          <el-form-item label="ECS 实例数">
            <el-input v-model.number="costForm.ecs_count" type="number" :min="1" :max="1000" placeholder="请输入数量" style="width: 140px" />
          </el-form-item>
          <el-form-item label="RDS 实例数">
            <el-input v-model.number="costForm.rds_count" type="number" :min="0" :max="100" placeholder="请输入数量" style="width: 140px" />
          </el-form-item>
          <el-form-item label="存储 (TB)">
            <el-input v-model.number="costForm.storage_tb" type="number" :min="0" :max="100" placeholder="请输入容量" style="width: 140px" />
          </el-form-item>
          <el-form-item label="带宽 (Mbps)">
            <el-input v-model.number="costForm.bandwidth" type="number" :min="0" :max="10000" placeholder="请输入带宽" style="width: 140px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="calcTotalCost">计算总成本</el-button>
          </el-form-item>
        </el-form>

        <el-row :gutter="16" style="margin-top: 20px" v-if="totalCosts.length > 0">
          <el-col :span="6" v-for="cost in totalCosts" :key="cost.cloud">
            <el-popover placement="top" :width="260" trigger="hover" :show-after="200">
              <template #reference>
                <el-card shadow="hover" :class="{ 'cheapest-card': cost.cheapest }" class="cost-card-hover">
                  <div class="cost-cloud-name">{{ cost.cloud }}</div>
                  <div class="cost-amount">¥{{ Number(cost.monthly).toLocaleString() }}<span class="cost-unit">/月</span></div>
                  <div class="cost-annual">年费: ¥{{ Number(cost.annual).toLocaleString() }}</div>
                  <el-tag v-if="cost.cheapest" type="success" size="large" effect="dark" style="margin-top: 8px">最优选择</el-tag>
                </el-card>
              </template>
              <div class="cost-breakdown">
                <div class="breakdown-title">{{ cost.cloud }} 费用明细</div>
                <div class="breakdown-row">
                  <span>ECS ({{ cost.breakdown?.ecs?.count || 0 }} × ¥{{ cost.breakdown?.ecs?.unit || 0 }})</span>
                  <span>¥{{ Number(cost.breakdown?.ecs?.total || 0).toLocaleString() }}</span>
                </div>
                <div class="breakdown-row">
                  <span>RDS ({{ cost.breakdown?.rds?.count || 0 }} × ¥{{ cost.breakdown?.rds?.unit || 0 }})</span>
                  <span>¥{{ Number(cost.breakdown?.rds?.total || 0).toLocaleString() }}</span>
                </div>
                <div class="breakdown-row">
                  <span>存储 ({{ cost.breakdown?.storage?.count || 0 }}TB × 10 × ¥{{ cost.breakdown?.storage?.unit || 0 }})</span>
                  <span>¥{{ Number(cost.breakdown?.storage?.total || 0).toLocaleString() }}</span>
                </div>
                <div class="breakdown-row">
                  <span>带宽 ({{ cost.breakdown?.network?.count || 0 }}Mbps × ¥{{ cost.breakdown?.network?.unit || 0 }})</span>
                  <span>¥{{ Number(cost.breakdown?.network?.total || 0).toLocaleString() }}</span>
                </div>
                <div class="breakdown-row breakdown-total">
                  <span>合计</span>
                  <span>¥{{ Number(cost.monthly).toLocaleString() }}</span>
                </div>
              </div>
            </el-popover>
          </el-col>
        </el-row>
      </el-card>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { cloudPricingApi } from '@/api'

const selectedRegion = ref('cn-hangzhou')
const selectedClouds = ref(['aliyun', 'huawei', 'tencent', 'aws'])
const priceLoading = ref(false)
const priceTab = ref('ecs')
const priceMeta = reactive({ source: '', cached_at: null, ttl_hours: null, note: '' })

const clouds = [
  { id: 'aliyun', name: '阿里云', shortName: '阿里', desc: '国内市场份额第一，生态最完善', tier: 'tier1', domestic: true, color: '#FF6A00', pricingUrl: 'https://www.aliyun.com/price' },
  { id: 'huawei', name: '华为云', shortName: '华为', desc: '政企首选，信创合规优势', tier: 'tier1', domestic: true, color: '#C7000B', pricingUrl: 'https://www.huaweicloud.com/pricing.html' },
  { id: 'tencent', name: '腾讯云', shortName: '腾讯', desc: '游戏/社交生态，性价比高', tier: 'tier1', domestic: true, color: '#006EFF', pricingUrl: 'https://buy.cloud.tencent.com/price' },
  { id: 'aws', name: 'AWS', shortName: 'AWS', desc: '全球最大云厂商，服务最丰富', tier: 'tier1', domestic: false, color: '#232F3E', pricingUrl: 'https://calculator.aws/' },
  { id: 'azure', name: 'Azure', shortName: 'Azure', desc: '微软生态，混合云优势', tier: 'tier1', domestic: false, color: '#0078D4', pricingUrl: 'https://azure.microsoft.com/zh-cn/pricing/calculator/' },
  { id: 'baidu', name: '百度云', shortName: '百度', desc: 'AI 能力突出，智能云', tier: 'tier2', domestic: true, color: '#2932E1', pricingUrl: 'https://cloud.baidu.com/product-pricing.html' },
  { id: 'jd', name: '京东云', shortName: '京东', desc: '电商/物流场景优势', tier: 'tier2', domestic: true, color: '#E1251B', pricingUrl: 'https://www.jdcloud.com/cn/calculator' },
  { id: 'ucloud', name: 'UCloud', shortName: 'UCloud', desc: '中立云，科创板上市', tier: 'tier3', domestic: true, color: '#23A8FA', pricingUrl: 'https://www.ucloud.cn/site/price.html' },
]

const selectedCloudList = computed(() => clouds.filter(c => selectedClouds.value.includes(c.id)))

function toggleCloud(id) {
  const idx = selectedClouds.value.indexOf(id)
  if (idx >= 0) selectedClouds.value.splice(idx, 1)
  else selectedClouds.value.push(id)
}

const ecsPrices = ref([])
const k8sPrices = ref([])
const rdsPrices = ref([])
const ossPrices = ref([])
const networkPrices = ref([])

function updatePriceMeta(meta) {
  priceMeta.source = meta.source || ''
  priceMeta.cached_at = meta.cached_at || null
  priceMeta.ttl_hours = meta.ttl_hours || null
  priceMeta.note = meta.note || ''
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadAllPrices() {
  priceLoading.value = true
  try {
    const region = selectedRegion.value
    const [ecsRes, k8sRes, rdsRes, ossRes, netRes] = await Promise.all([
      cloudPricingApi.getEcsPrices(region),
      cloudPricingApi.getK8sPrices(region),
      cloudPricingApi.getRdsPrices(region),
      cloudPricingApi.getOssPrices(region),
      cloudPricingApi.getNetworkPrices(region),
    ])

    ecsPrices.value = ecsRes.data || []
    k8sPrices.value = k8sRes.data || []
    rdsPrices.value = rdsRes.data || []
    ossPrices.value = ossRes.data || []
    networkPrices.value = netRes.data || []

    // 取第一个有数据的 meta 作为展示
    const firstMeta = ecsRes || k8sRes || rdsRes || ossRes || netRes
    if (firstMeta) {
      updatePriceMeta({
        source: firstMeta.source,
        cached_at: firstMeta.cached_at,
        ttl_hours: firstMeta.ttl_hours,
        note: firstMeta.note,
      })
    }

    if (firstMeta?.source === 'api') {
      ElMessage.success('已获取实时价格数据')
    } else if (firstMeta?.source === 'cache') {
      ElMessage.info('价格来自缓存')
    } else if (firstMeta?.note) {
      ElMessage.warning(firstMeta.note)
    }
  } catch (err) {
    ElMessage.error('获取价格失败: ' + (err.message || '未知错误'))
  } finally {
    priceLoading.value = false
  }
}

const costForm = reactive({
  ecs_count: 10,
  rds_count: 3,
  storage_tb: 5,
  bandwidth: 100,
})

const totalCosts = ref([])

async function calcTotalCost() {
  try {
    const res = await cloudPricingApi.calculateCost({
      ecs_count: costForm.ecs_count,
      rds_count: costForm.rds_count,
      storage_tb: costForm.storage_tb,
      bandwidth: costForm.bandwidth,
      clouds: selectedClouds.value.join(','),
      region: selectedRegion.value,
    })
    totalCosts.value = res || []
  } catch (err) {
    ElMessage.error('成本计算失败: ' + (err.message || '未知错误'))
  }
}

function getEcsSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, idx) => {
    if (idx === 0) { sums[idx] = '最低价'; return }
    const cloudId = selectedCloudList.value[idx - 1]?.id
    if (!cloudId) { sums[idx] = '-'; return }
    let minPrice = Infinity
    data.forEach(row => {
      const p = row.prices?.[cloudId]
      if (p && p.monthly < minPrice) minPrice = p.monthly
    })
    sums[idx] = minPrice === Infinity ? '-' : `¥${minPrice}/月`
  })
  return sums
}

function refreshPrices() {
  loadAllPrices()
}

onMounted(() => {
  loadAllPrices()
})

// 勾选了新的云厂商后自动刷新价格，避免表格列出现但无数据
watch(selectedClouds, (newVal, oldVal) => {
  if (!oldVal || newVal.length <= oldVal.length) return
  const newCloud = newVal.find(id => !oldVal.includes(id))
  if (newCloud) {
    const hasData = ecsPrices.value.length > 0 && ecsPrices.value[0].prices?.[newCloud]
    if (!hasData) {
      loadAllPrices()
    }
  }
  // 重新计算总成本时，若当前未计算则无需操作；用户会手动点按钮
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; font-size: 20px; }
.header-actions { display: flex; align-items: center; }

.cloud-cards { margin-bottom: 20px; }
.cloud-card {
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  margin-bottom: 16px;
  border: 2px solid transparent;
}
.cloud-card:hover { transform: translateY(-4px); }
.cloud-card.cloud-selected { border-color: #409EFF; }
.cloud-logo-area { height: 56px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.cloud-logo-area a { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.cloud-badge {
  width: 48px; height: 48px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.cloud-logo-area a:hover .cloud-badge { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.cloud-name { font-size: 16px; font-weight: 600; margin: 8px 0 4px; }
.cloud-desc { font-size: 12px; color: #909399; margin: 0 0 8px; line-height: 1.4; }
.cloud-tags { display: flex; gap: 4px; justify-content: center; margin-bottom: 8px; }
.cloud-check { margin-top: 4px; }

.price-cell { display: inline-flex; align-items: baseline; gap: 2px; }
.price-amount { font-weight: 600; color: #303133; font-size: 14px; }
.price-unit { font-size: 12px; color: #909399; }
.price-na { color: #c0c4cc; }

.cost-summary { margin-top: 20px; }
.cost-card-hover { cursor: pointer; transition: all 0.2s; }
.cost-card-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.cost-cloud-name { font-size: 14px; color: #606266; margin-bottom: 8px; }
.cost-amount { font-size: 28px; font-weight: 700; color: #409EFF; }
.cost-unit { font-size: 14px; font-weight: 400; color: #909399; }
.cost-annual { font-size: 13px; color: #909399; margin-top: 4px; }
.cheapest-card { border: 2px solid #67C23A; }
.cost-breakdown { font-size: 13px; }
.breakdown-title { font-weight: 600; margin-bottom: 8px; color: #303133; border-bottom: 1px solid #ebeef5; padding-bottom: 6px; }
.breakdown-row { display: flex; justify-content: space-between; margin-bottom: 6px; color: #606266; }
.breakdown-total { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #ebeef5; font-weight: 600; color: #303133; }
</style>
