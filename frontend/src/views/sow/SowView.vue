<template>
  <div class="sow-view" v-loading="loading">
    <el-page-header @back="$router.push(`/opportunities/${opportunityId}`)" :title="'返回商机'">
      <template #content>
        <span class="page-title">SOW 生成 - {{ opportunityName }}</span>
      </template>
    </el-page-header>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="6">
        <el-card shadow="never">
          <template #header>工作流进度</template>
          <el-steps direction="vertical" :active="workflowStep" finish-status="success">
            <el-step title="创建商机" />
            <el-step title="填写 Fact Sheet" />
            <el-step title="AI 报价" />
            <el-step title="生成 SOW" />
            <el-step title="生成 WBS" />
            <el-step title="导出文档" />
          </el-steps>
        </el-card>

        <el-card shadow="never" style="margin-top: 20px">
          <template #header>Fact Sheet 摘要</template>
          <div v-if="latestFactSheet">
            <div v-for="(value, key) in latestFactSheet.facts" :key="key" class="fact-brief">
              <span class="fact-key">{{ factLabel(key) }}</span>
              <span class="fact-val">{{ value }}</span>
            </div>
          </div>
          <el-empty v-else description="暂无" :image-size="40" />
        </el-card>
      </el-col>

      <el-col :span="18">
        <div v-if="!sowContent">
          <el-card shadow="never">
            <div style="text-align: center; padding: 40px 0">
              <el-icon :size="80" color="#dcdfe6"><Notebook /></el-icon>
              <h3 style="color: #606266; margin: 16px 0">AI 自动生成 SOW</h3>
              <p style="color: #909399; margin-bottom: 24px">
                基于 Fact Sheet 数据，AI 将自动生成完整的工作说明书（Statement of Work）
              </p>
              <el-button type="primary" size="large" :loading="generating" :disabled="!latestFactSheet" @click="generateSOW">
                <el-icon><MagicStick /></el-icon> 生成 SOW
              </el-button>
              <p v-if="!latestFactSheet" style="color: #F56C6C; margin-top: 12px; font-size: 13px">
                请先填写 Fact Sheet
              </p>
            </div>
          </el-card>
        </div>

        <div v-else>
          <el-card shadow="never">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span>SOW 文档预览</span>
                <div>
                  <el-button size="small" @click="generateSOW" :loading="generating">
                    <el-icon><Refresh /></el-icon> 重新生成
                  </el-button>
                  <el-button type="primary" size="small" @click="exportSOW('word')">
                    <el-icon><Download /></el-icon> 导出 Word
                  </el-button>
                  <el-button size="small" @click="exportSOW('pdf')">
                    <el-icon><Download /></el-icon> 导出 PDF
                  </el-button>
                </div>
              </div>
            </template>

            <div class="sow-document">
              <h1 class="sow-title">{{ sowContent.title }}</h1>
              <p class="sow-meta">客户: {{ opportunityName }} | 生成时间: {{ currentTime }}</p>

              <el-divider />

              <section class="sow-section">
                <h2>1. 项目概述</h2>
                <p>{{ sowContent.project_overview }}</p>
              </section>

              <section class="sow-section">
                <h2>2. 项目范围</h2>
                <p>{{ sowContent.scope }}</p>
                <el-table :data="sowContent.scope_items" stripe size="small" style="margin-top: 12px">
                  <el-table-column prop="category" label="类别" width="150" />
                  <el-table-column prop="item" label="工作项" min-width="250" />
                  <el-table-column prop="included" label="是否包含" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.included ? 'success' : 'info'" size="small">{{ row.included ? '包含' : '不包含' }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </section>

              <section class="sow-section">
                <h2>3. 交付物</h2>
                <el-table :data="sowContent.deliverables" stripe size="small">
                  <el-table-column prop="name" label="交付物名称" min-width="200" />
                  <el-table-column prop="description" label="描述" min-width="300" />
                  <el-table-column prop="milestone" label="里程碑" width="150" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>4. 前提假设</h2>
                <ul>
                  <li v-for="(item, idx) in sowContent.assumptions" :key="idx">{{ item }}</li>
                </ul>
              </section>

              <section class="sow-section">
                <h2>5. 风险与缓解</h2>
                <el-table :data="sowContent.risks" stripe size="small">
                  <el-table-column prop="risk" label="风险" min-width="200" />
                  <el-table-column prop="impact" label="影响" width="120">
                    <template #default="{ row }">
                      <el-tag :type="row.impact === '高' ? 'danger' : row.impact === '中' ? 'warning' : 'info'" size="small">{{ row.impact }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="mitigation" label="缓解措施" min-width="250" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>6. 项目时间线</h2>
                <p>{{ sowContent.timeline }}</p>
                <el-table :data="sowContent.milestones" stripe size="small" style="margin-top: 12px">
                  <el-table-column prop="phase" label="阶段" width="150" />
                  <el-table-column prop="duration" label="周期" width="120" />
                  <el-table-column prop="deliverable" label="交付物" min-width="200" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>7. 团队配置</h2>
                <el-table :data="sowContent.team" stripe size="small">
                  <el-table-column prop="role" label="角色" width="150" />
                  <el-table-column prop="count" label="人数" width="80" />
                  <el-table-column prop="responsibility" label="职责" min-width="300" />
                </el-table>
              </section>

              <section class="sow-section">
                <h2>8. 验收标准</h2>
                <ul>
                  <li v-for="(item, idx) in sowContent.acceptance_criteria" :key="idx">{{ item }}</li>
                </ul>
              </section>
            </div>
          </el-card>

          <el-card shadow="never" style="margin-top: 20px">
            <template #header>下一步</template>
            <div style="display: flex; gap: 12px">
              <el-button type="primary" @click="$router.push(`/wbs/${opportunityId}`)">
                <el-icon><Grid /></el-icon> 生成 WBS
              </el-button>
              <el-button @click="$router.push(`/quotation/${opportunityId}`)">
                <el-icon><Money /></el-icon> 查看报价
              </el-button>
              <el-button @click="$router.push(`/opportunities/${opportunityId}`)">
                <el-icon><Back /></el-icon> 返回商机
              </el-button>
            </div>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { opportunityApi, factsheetApi } from '@/api'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const opportunityId = route.params.opportunityId
const loading = ref(false)
const generating = ref(false)
const opportunityName = ref('')
const factSheets = ref([])
const sowContent = ref(null)
const workflowStep = ref(3)

const latestFactSheet = computed(() => factSheets.value.length > 0 ? factSheets.value[0] : null)
const currentTime = computed(() => dayjs().format('YYYY-MM-DD HH:mm'))

const factLabels = {
  project_type: '项目类型', current_cloud: '当前云', target_cloud: '目标云',
  vm_count: 'VM数量', database_count: '数据库数量', region_count: 'Region数量',
  account_count: '账号数量', vpc_count: 'VPC数量', security_level: '安全等级',
}
function factLabel(key) { return factLabels[key] || key }

onMounted(async () => {
  loading.value = true
  try {
    const opp = await opportunityApi.get(opportunityId)
    opportunityName.value = opp.name
    factSheets.value = await factsheetApi.list(opportunityId)
    if (factSheets.value.length > 0) workflowStep.value = 3
  } finally {
    loading.value = false
  }
})

async function generateSOW() {
  if (!latestFactSheet.value) return
  generating.value = true
  try {
    const facts = latestFactSheet.value.facts
    const projectType = facts.project_type || 'landing_zone'
    const targetCloud = facts.target_cloud || 'aliyun'
    const vmCount = facts.vm_count || 0
    const dbCount = facts.database_count || 0
    const regionCount = facts.region_count || 1
    const accountCount = facts.account_count || 1
    const securityLevel = facts.security_level || 'basic'

    const cloudNames = { aws: 'AWS', azure: 'Azure', aliyun: '阿里云', huawei: '华为云', tencent: '腾讯云' }
    const typeNames = { landing_zone: 'Landing Zone', migration: '云迁移', big_data: '大数据平台', hybrid_cloud: '混合云', security: '安全加固', cost_optimization: '成本优化' }
    const secNames = { basic: '基础', medium: '中等', advanced: '高级' }

    const cloudName = cloudNames[targetCloud] || targetCloud
    const typeName = typeNames[projectType] || projectType

    sowContent.value = {
      title: `${opportunityName.value} - ${typeName}项目工作说明书`,
      project_overview: `本项目旨在为${opportunityName.value}构建${cloudName}${typeName}解决方案。项目涵盖${vmCount}台虚拟机、${dbCount}个数据库的${projectType === 'migration' ? '迁移' : '管理'}，跨${regionCount}个Region，涉及${accountCount}个云账号，安全等级为${secNames[securityLevel] || securityLevel}。`,
      scope: `本项目的工作范围包括${cloudName}${typeName}的架构设计、实施部署、测试验证和知识转移。具体范围如下表所示。`,
      scope_items: projectType === 'landing_zone' ? [
        { category: '架构设计', item: `${cloudName}多云账号体系设计`, included: true },
        { category: '架构设计', item: '网络架构设计（VPC/子网/安全组）', included: true },
        { category: '架构设计', item: '安全合规架构设计', included: true },
        { category: '实施部署', item: `${accountCount}个云账号Landing Zone部署`, included: true },
        { category: '实施部署', item: `${regionCount}个Region网络配置`, included: true },
        { category: '实施部署', item: 'IAM策略与权限体系配置', included: true },
        { category: '实施部署', item: '监控告警与日志体系搭建', included: true },
        { category: '知识转移', item: '运维文档与培训', included: true },
        { category: '不在范围', item: '业务应用迁移', included: false },
        { category: '不在范围', item: '第三方软件许可', included: false },
      ] : [
        { category: '评估', item: `${vmCount}台VM和${dbCount}个数据库迁移评估`, included: true },
        { category: '设计', item: '迁移方案设计', included: true },
        { category: '实施', item: '分批迁移实施', included: true },
        { category: '验证', item: '割接与数据一致性验证', included: true },
        { category: '知识转移', item: '运维文档与培训', included: true },
        { category: '不在范围', item: '新业务应用开发', included: false },
      ],
      deliverables: [
        { name: `${typeName}架构设计文档`, description: '包含目标架构、网络拓扑、安全架构等', milestone: 'M1-设计阶段' },
        { name: 'Landing Zone 部署报告', description: '部署配置清单、验证结果', milestone: 'M2-实施阶段' },
        { name: '安全合规审计报告', description: '安全配置核查、合规检查结果', milestone: 'M2-实施阶段' },
        { name: '运维手册', description: '日常运维操作手册、故障处理指南', milestone: 'M3-交付阶段' },
        { name: '培训材料', description: '运维团队培训PPT及实操手册', milestone: 'M3-交付阶段' },
      ],
      assumptions: [
        '客户已具备云平台账号及管理员权限',
        '客户网络团队已准备好专线/VPN连接',
        '业务团队可配合提供应用依赖关系信息',
        '项目期间客户关键人员可参与评审会议',
        '云平台服务配额满足项目需求',
        '安全等级要求以当前确认的为准，如需提升需另行评估',
      ],
      risks: [
        { risk: '云平台配额不足', impact: '高', mitigation: '提前与云厂商确认配额并申请提升' },
        { risk: '网络连接延迟', impact: '中', mitigation: '提前测试专线/VPN连通性，预留缓冲时间' },
        { risk: '安全合规要求变更', impact: '中', mitigation: '项目启动时冻结安全需求基线，变更走变更流程' },
        { risk: '客户人员配合不足', impact: '高', mitigation: '明确RACI矩阵，定期同步进度' },
      ],
      timeline: `预计项目总周期为${projectType === 'landing_zone' ? '8-12' : '12-16'}周，分为设计、实施、验证三个主要阶段。`,
      milestones: [
        { phase: 'M1-设计阶段', duration: '2-3周', deliverable: '架构设计文档、实施方案' },
        { phase: 'M2-实施阶段', duration: `${projectType === 'landing_zone' ? '4-6' : '6-8'}周`, deliverable: 'Landing Zone部署、安全配置' },
        { phase: 'M3-验证阶段', duration: '1-2周', deliverable: '测试报告、验收报告' },
        { phase: 'M4-交付阶段', duration: '1周', deliverable: '运维手册、培训材料' },
      ],
      team: [
        { role: '项目总监', count: 1, responsibility: '项目整体管控、客户高层沟通' },
        { role: '云架构师', count: 1, responsibility: '架构设计、技术方案审核' },
        { role: '云工程师', count: 2, responsibility: 'Landing Zone实施部署、配置' },
        { role: '安全顾问', count: 1, responsibility: '安全架构设计、合规审计' },
        { role: '项目经理', count: 1, responsibility: '项目进度管理、风险跟踪' },
      ],
      acceptance_criteria: [
        '所有云账号Landing Zone配置完成并通过验证',
        '网络连通性测试通过，延迟满足SLA要求',
        '安全合规检查通过，满足等保要求',
        '监控告警体系正常运行',
        '运维文档交付并通过审核',
        '客户团队完成培训并通过考核',
      ],
    }
    workflowStep.value = 4
    ElMessage.success('SOW 生成完成')
  } finally {
    generating.value = false
  }
}

function exportSOW(format) {
  ElMessage.success(`${format.toUpperCase()} 导出功能开发中...`)
}
</script>

<style scoped>
.page-title {
  font-size: 18px;
  font-weight: 600;
}

.fact-brief {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.fact-key {
  color: #909399;
}

.fact-val {
  color: #303133;
  font-weight: 500;
}

.sow-document {
  max-width: 900px;
  margin: 0 auto;
}

.sow-title {
  text-align: center;
  font-size: 22px;
  color: #303133;
  margin-bottom: 8px;
}

.sow-meta {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 0;
}

.sow-section {
  margin-bottom: 24px;
}

.sow-section h2 {
  font-size: 16px;
  color: #303133;
  border-left: 3px solid #409EFF;
  padding-left: 10px;
  margin-bottom: 12px;
}

.sow-section p {
  color: #606266;
  line-height: 1.8;
}

.sow-section ul {
  padding-left: 20px;
}

.sow-section li {
  color: #606266;
  line-height: 2;
}
</style>
