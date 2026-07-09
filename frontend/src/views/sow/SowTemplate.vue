<template>
  <div class="sow-template">
    <el-card shadow="never">
      <div class="page-header">
        <h2>SOW 模板库</h2>
        <div class="header-actions">
          <el-select v-model="filterCategory" placeholder="按类型筛选" clearable style="width: 180px; margin-right: 12px">
            <el-option label="全部" value="" />
            <el-option v-for="(label, key) in categoryMap" :key="key" :label="label" :value="key" />
          </el-select>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Upload /></el-icon> 上传模板
          </el-button>
        </div>
      </div>

      <el-alert type="info" :closable="false" style="margin-bottom: 16px">
        管理安畅标准 SOW 模板库，AI 生成 SOW 时将参考模板的结构和风格。支持 5 大产品线：Landing Zone / Well-Architected / Big Data / Migration / IaC，以及 Offering 概览和 21 个交付物模板。
      </el-alert>

      <el-table :data="filteredTemplates" stripe v-loading="loading" row-key="id">
        <el-table-column prop="name" label="模板名称" min-width="260">
          <template #default="{ row }">
            <div class="template-name-cell">
              <el-icon :size="18" :color="categoryColor(row.category)"><Document /></el-icon>
              <el-link type="primary" @click="previewTemplate(row)">{{ row.name }}</el-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="产品线" width="150">
          <template #default="{ row }">
            <el-tag size="small" :color="categoryColor(row.category)" effect="dark" style="border: none">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source === 'standard' ? 'success' : 'info'">
              {{ row.source === 'standard' ? '安畅标准' : '客户上传' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column prop="version" label="版本" width="80" align="center" />
        <el-table-column label="服务包" width="280">
          <template #default="{ row }">
            <div class="package-tags">
              <el-tag v-for="pkg in (row.packages || []).slice(0, 3)" :key="pkg" size="small" type="warning" style="margin: 2px">{{ pkg }}</el-tag>
              <el-tag v-if="(row.packages || []).length > 3" size="small" type="info" style="margin: 2px">+{{ row.packages.length - 3 }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="previewTemplate(row)">预览</el-button>
            <el-button type="success" link size="small" @click="generateFromTemplate(row)">AI 生成</el-button>
            <el-button type="warning" link size="small" @click="downloadTemplate(row)">下载</el-button>
            <el-popconfirm v-if="row.source !== 'standard'" title="确认删除此模板？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" link size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showUploadDialog" title="上传 SOW 模板" width="600px" destroy-on-close>
      <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="100px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="uploadForm.name" placeholder="如：Landing Zone 标准版 SOW" />
        </el-form-item>
        <el-form-item label="产品线" prop="category">
          <el-select v-model="uploadForm.category" style="width: 100%">
            <el-option v-for="(label, key) in categoryMap" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="2" placeholder="模板适用场景说明" />
        </el-form-item>
        <el-form-item label="上传文件" prop="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            accept=".docx,.doc,.pdf,.txt,.md"
          >
            <el-button type="primary"><el-icon><Upload /></el-icon> 选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">支持 .docx / .doc / .pdf / .txt / .md 格式</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPreviewDialog" :title="previewData?.name" width="800px" destroy-on-close top="5vh">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="产品线">{{ categoryLabel(previewData?.category) }}</el-descriptions-item>
        <el-descriptions-item label="版本">v{{ previewData?.version }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ previewData?.source === 'standard' ? '安畅标准' : '客户上传' }}</el-descriptions-item>
        <el-descriptions-item label="描述" :span="3">{{ previewData?.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">服务包规格</el-divider>
      <el-table :data="previewData?.pricing || []" size="small" border v-if="previewData?.pricing?.length">
        <el-table-column v-for="col in previewData?.pricingColumns || []" :key="col.prop" :prop="col.prop" :label="col.label" :min-width="col.minWidth || 100" />
      </el-table>

      <el-divider content-position="left">SOW 章节结构</el-divider>
      <div class="template-preview" v-if="previewData?.content">
        <div v-html="previewData.content"></div>
      </div>
      <el-empty v-else description="暂无预览内容" />

      <el-divider content-position="left">交付物清单</el-divider>
      <el-table :data="previewData?.deliverables || []" size="small" border v-if="previewData?.deliverables?.length">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column prop="name" label="交付物" min-width="200" />
        <el-table-column prop="phase" label="阶段" width="120" />
        <el-table-column prop="format" label="格式" width="100" />
      </el-table>

      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
        <el-button type="success" @click="generateFromTemplate(previewData)">基于此模板 AI 生成 SOW</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const templates = ref([])
const filterCategory = ref('')
const showUploadDialog = ref(false)
const showPreviewDialog = ref(false)
const previewData = ref(null)
const uploading = ref(false)
const uploadFormRef = ref(null)
const uploadRef = ref(null)

const uploadForm = reactive({
  name: '',
  category: '',
  description: '',
  file: null,
})

const uploadRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择产品线', trigger: 'change' }],
}

const categoryMap = {
  landing_zone: 'Landing Zone',
  well_architected: 'Well-Architected',
  big_data: 'Big Data',
  migration: 'Migration',
  iac: 'IaC',
  pricing: '定价目录',
  general: '通用',
}

const categoryColors = {
  landing_zone: '#409EFF',
  well_architected: '#67C23A',
  big_data: '#E6A23C',
  migration: '#F56C6C',
  iac: '#909399',
  pricing: '#9B59B6',
  general: '#C0C4CC',
}

function categoryLabel(c) { return categoryMap[c] || c || '-' }
function categoryColor(c) { return categoryColors[c] || '#909399' }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }

const filteredTemplates = computed(() => {
  if (!filterCategory.value) return templates.value
  return templates.value.filter(t => t.category === filterCategory.value)
})

onMounted(() => {
  templates.value = [
    {
      id: 'ac-lz',
      name: 'AC Landing Zone 云基础架构建设服务 SOW',
      category: 'landing_zone',
      source: 'standard',
      description: '安畅标准 Landing Zone SOW，覆盖账号治理、身份管理、网络架构、安全基线、合规审计、财务管理、运维监控 7 大域，支持 AWS/Azure/GCP/阿里云/华为云/腾讯云/火山引擎 7 大云平台',
      file_name: 'AC_LandingZone_SOW_CN_V1.0.docx',
      version: 3,
      packages: ['轻量版 ¥80K', '基础版 ¥180K', '标准版 ¥350K', 'S基础包 ¥150K', 'M标准包 ¥380K', 'L增强包 ¥680K'],
      created_at: '2026-05-21',
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 100 },
        { prop: 'type', label: '类型', minWidth: 80 },
        { prop: 'scope', label: '包含阶段', minWidth: 200 },
        { prop: 'accounts', label: '账号上限', minWidth: 80 },
        { prop: 'duration', label: '参考工期', minWidth: 80 },
        { prop: 'price', label: '标准定价(元)', minWidth: 100 },
      ],
      pricing: [
        { spec: '轻量版', type: '咨询包', scope: '调研+标准化架构自动化落地+KT', accounts: '10', duration: '10工作日', price: '80,000' },
        { spec: '基础版', type: '咨询包', scope: '调研+方案设计(资源/身份/网络/安全/合规)+技术验证', accounts: '30', duration: '20工作日', price: '180,000' },
        { spec: '标准版', type: '咨询包', scope: '调研+方案设计(全7域)+技术验证', accounts: '50', duration: '30工作日', price: '350,000' },
        { spec: 'S基础包', type: '咨询+实施', scope: '轻量版咨询+基础实施', accounts: '10', duration: '20工作日', price: '150,000' },
        { spec: 'M标准包', type: '咨询+实施', scope: '基础版咨询+标准实施', accounts: '30', duration: '40工作日', price: '380,000' },
        { spec: 'L增强包', type: '咨询+实施', scope: '标准版咨询+完整实施+高阶场景', accounts: '50', duration: '60工作日', price: '680,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '项目需求确认书', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '云上 IT 治理现状调研报告', phase: '阶段一', format: 'Word/PDF' },
        { id: 'D-03', name: '合规差距分析报告', phase: '阶段一', format: 'Word/PDF' },
        { id: 'D-04', name: 'Landing Zone 高阶架构设计文档(HLD)', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-05', name: 'Landing Zone 低阶实施方案(LLD)', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-06', name: 'IP 地址规划表', phase: '阶段二', format: 'Excel' },
        { id: 'D-07', name: 'IAM 权限矩阵', phase: '阶段二', format: 'Excel' },
        { id: 'D-10', name: 'Landing Zone 基础架构(可运行环境)', phase: '阶段三', format: '云上配置' },
        { id: 'D-11', name: 'IaC 代码仓库', phase: '阶段三', format: 'Git Repo' },
        { id: 'D-17', name: '验收报告', phase: '阶段四', format: 'Word' },
      ],
      content: `
        <h3>第一部分 协议基本信息</h3>
        <p>客户/服务提供商/项目名称/目标云平台/服务期间</p>
        <h3>第二部分 背景与目标</h3>
        <p>2.1 业务背景 — 账号体系混乱、身份权限分散、网络未规范、安全基线缺失、成本分摊困难</p>
        <p>2.2 项目目标 — 标准化多账号组织架构、集中式身份管理、安全合规网络、统一审计日志、成本归因体系、IaC 资产交付</p>
        <p>2.3 适用范围 — 支持 AWS/Azure/GCP/阿里云/华为云/腾讯云/火山引擎 7 大云平台</p>
        <h3>第三部分 服务范围</h3>
        <p>3.1 阶段一：调研与评估 — IT治理现状调研、合规需求分析、需求确认</p>
        <p>3.2 阶段二：方案设计 — 账号与OU架构、IAM/SSO、网络架构、安全基线、合规审计、财务管理、运维管理</p>
        <p>3.3 阶段三：实施落地 — IaC自动化部署、网络/安全/日志配置、验证测试</p>
        <p>3.4 阶段四：验收与知识转移 — UAT验收、培训、文档交付</p>
        <h3>第五部分 服务包与规格</h3>
        <p>轻量版/基础版/标准版(咨询包) + S基础包/M标准包/L增强包(咨询+实施) + 高阶场景选配</p>
        <h3>第七部分 RACI 责任矩阵</h3>
        <h3>第八部分 项目管理规定</h3>
        <h3>第九部分 验收标准</h3>
        <h3>第十部分 费用与付款安排</h3>
      `,
    },
    {
      id: 'ac-wa',
      name: 'AC 云卓越架构评估服务 SOW',
      category: 'well_architected',
      source: 'standard',
      description: '安畅标准 Well-Architected SOW，基于云厂商 WA 框架进行六大支柱评估，识别风险并输出改进路线图',
      file_name: 'AC_WellArchitected_SOW_CN_V1.0.docx',
      version: 3,
      packages: ['标准版 ¥120K', '专业版 ¥200K', '实施版 ¥380K'],
      created_at: '2026-05-21',
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 },
        { prop: 'scope', label: '包含阶段', minWidth: 200 },
        { prop: 'workloads', label: '评估工作负载', minWidth: 100 },
        { prop: 'duration', label: '参考工期', minWidth: 80 },
        { prop: 'price', label: '标准定价(元)', minWidth: 100 },
      ],
      pricing: [
        { spec: '标准版', scope: '启动+评估+报告', workloads: '1~3个', duration: '10工作日', price: '120,000' },
        { spec: '专业版', scope: '启动+评估+报告+知识转移', workloads: '1~5个', duration: '15工作日', price: '200,000' },
        { spec: '实施版', scope: '专业版+高优先级改进实施+UAT', workloads: '1~5个', duration: '30工作日', price: '380,000' },
      ],
      deliverables: [
        { id: 'D-01', name: 'WA 评估启动报告', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '六大支柱评估报告', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-03', name: '改进路线图', phase: '阶段二', format: 'PPT' },
        { id: 'D-04', name: '高优先级改进实施报告', phase: '阶段三', format: 'Word' },
      ],
      content: `
        <h3>第一部分 协议基本信息</h3>
        <h3>第二部分 背景与目标</h3>
        <p>基于云厂商 Well-Architected Framework 进行六大支柱评估：卓越运营、安全性、可靠性、性能效率、成本优化、可持续性</p>
        <h3>第三部分 服务范围</h3>
        <p>3.1 阶段一：启动与准备 — 工作负载识别、利益相关者访谈</p>
        <p>3.2 阶段二：评估与分析 — 六大支柱逐项评估、风险识别、优先级排序</p>
        <p>3.3 阶段三：改进实施(实施版) — 高优先级改进项实施、UAT验证</p>
        <p>3.4 阶段四：知识转移 — 培训、最佳实践分享</p>
      `,
    },
    {
      id: 'ac-bd',
      name: 'AC 大数据平台建设服务 SOW',
      category: 'big_data',
      source: 'standard',
      description: '安畅标准 Big Data SOW，湖仓一体架构设计、数据迁移、开发治理平台建设',
      file_name: 'AC_BigData_SOW_CN_V1.0.docx',
      version: 3,
      packages: ['S咨询包 ¥200K', 'M咨询包 ¥380K', 'S实施包 ¥500K', 'M实施包 ¥800K', 'L实施包 ¥1.2M'],
      created_at: '2026-05-21',
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 },
        { prop: 'type', label: '类型', minWidth: 80 },
        { prop: 'scope', label: '包含阶段', minWidth: 200 },
        { prop: 'nodes', label: '集群规模', minWidth: 80 },
        { prop: 'migration', label: '数据迁移量', minWidth: 80 },
        { prop: 'price', label: '标准定价(元)', minWidth: 100 },
      ],
      pricing: [
        { spec: 'S咨询包', type: '咨询', scope: '调研+方案设计', nodes: '50节点', migration: '—', price: '200,000' },
        { spec: 'M咨询包', type: '咨询', scope: '调研+方案设计+技术验证', nodes: '100节点', migration: '—', price: '380,000' },
        { spec: 'S实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移', nodes: '50节点', migration: '5TB', price: '500,000' },
        { spec: 'M实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移', nodes: '100节点', migration: '20TB', price: '800,000' },
        { spec: 'L实施包', type: '咨询+实施', scope: 'M咨询包+平台搭建+数据迁移+治理', nodes: '200节点', migration: '50TB', price: '1,200,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '大数据平台调研报告', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: '湖仓一体架构设计文档', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-03', name: '数据迁移方案', phase: '阶段二', format: 'Word' },
        { id: 'D-04', name: '大数据平台(可运行环境)', phase: '阶段三', format: '云上配置' },
        { id: 'D-05', name: '数据迁移验证报告', phase: '阶段三', format: 'Word/PDF' },
      ],
      content: `
        <h3>第一部分 协议基本信息</h3>
        <h3>第二部分 背景与目标</h3>
        <p>构建企业级云上大数据基础设施，湖仓一体架构，支持数据迁移与开发治理</p>
        <h3>第三部分 服务范围</h3>
        <p>3.1 阶段一：调研与评估 — 数据资产盘点、技术选型、需求确认</p>
        <p>3.2 阶段二：方案设计 — 湖仓一体架构、数据模型、迁移策略、治理体系</p>
        <p>3.3 阶段三：实施落地 — 平台搭建、数据迁移、开发测试</p>
        <p>3.4 阶段四：验收与知识转移</p>
      `,
    },
    {
      id: 'ac-mig',
      name: 'AC 企业云迁移服务 SOW',
      category: 'migration',
      source: 'standard',
      description: '安畅标准 Migration SOW，6R 迁移策略，迁移工厂模式，业务连续性保障，支持评估/规划/实施全流程',
      file_name: 'AC_Migration_SOW_CN_V1.0.docx',
      version: 3,
      packages: ['S评估包 ¥120K', 'M规划包 ¥280K', 'S迁移包 ¥380K', 'M迁移包 ¥680K', 'L迁移包 ¥1.2M'],
      created_at: '2026-05-21',
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 },
        { prop: 'type', label: '类型', minWidth: 80 },
        { prop: 'scope', label: '包含阶段', minWidth: 250 },
        { prop: 'servers', label: '迁移服务器', minWidth: 80 },
        { prop: 'dbs', label: '迁移数据库', minWidth: 80 },
        { prop: 'price', label: '标准定价(元)', minWidth: 100 },
      ],
      pricing: [
        { spec: 'S评估包', type: '咨询', scope: '迁移评估+规划', servers: '50台', dbs: '5个', price: '120,000' },
        { spec: 'M规划包', type: '咨询', scope: '评估+规划+基础架构设计+割接方案', servers: '100台', dbs: '10个', price: '280,000' },
        { spec: 'S迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(50台+5库)', servers: '50台', dbs: '5个', price: '380,000' },
        { spec: 'M迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(100台+10库)', servers: '100台', dbs: '10个', price: '680,000' },
        { spec: 'L迁移包', type: '咨询+实施', scope: 'M规划包+迁移实施(200台+20库)', servers: '200台', dbs: '20个', price: '1,200,000' },
      ],
      deliverables: [
        { id: 'D-01', name: '迁移评估报告', phase: '阶段一', format: 'Word/PDF' },
        { id: 'D-02', name: '迁移规划书', phase: '阶段一', format: 'Word/PDF' },
        { id: 'D-03', name: '应用依赖关系图', phase: '阶段一', format: 'Visio/PPT' },
        { id: 'D-04', name: 'TCO 对比分析', phase: '阶段一', format: 'Excel' },
        { id: 'D-05', name: '目标云基础架构设计文档', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-06', name: '割接方案与回滚预案', phase: '阶段二', format: 'Word/PDF' },
        { id: 'D-08', name: '服务器迁移记录', phase: '阶段三', format: 'Excel' },
        { id: 'D-09', name: '数据库迁移验证报告', phase: '阶段三', format: 'Word/PDF' },
        { id: 'D-10', name: '割接执行记录', phase: '阶段三', format: 'Word/Excel' },
      ],
      content: `
        <h3>第一部分 协议基本信息</h3>
        <h3>第二部分 背景与目标</h3>
        <p>2.1 业务背景 — IT基础设施老旧、弹性需求增长、多云战略</p>
        <p>2.2 项目目标 — 6R策略制定、基础架构搭建、应用迁移、数据库迁移、割接切换</p>
        <p>2.3 迁移策略(6R框架) — Rehost/Replatform/Refactor/Retire/Retain/Relocate</p>
        <h3>第三部分 服务范围</h3>
        <p>3.1 阶段一：迁移评估与规划 — 资产盘点、依赖分析、6R策略、TCO分析</p>
        <p>3.2 阶段二：迁移准备与基础架构搭建 — 目标云VPC、混合云网络、迁移工具部署</p>
        <p>3.3 阶段三：迁移实施 — 服务器迁移、数据库迁移、应用割接</p>
        <p>3.4 阶段四：验收与知识转移</p>
        <h3>第五部分 增量包</h3>
        <p>增量服务器迁移 ¥50K/10台 / 增量数据库迁移 ¥30K/个 / 增量应用割接 ¥20K/组</p>
      `,
    },
    {
      id: 'ac-iac',
      name: 'AC 基础设施即代码开发服务 SOW',
      category: 'iac',
      source: 'standard',
      description: '安畅标准 IaC SOW，Terraform 模块库开发、CI/CD 流水线、策略即代码，标准化自动化基础设施管理',
      file_name: 'AC_IaC_SOW_CN_V1.0.docx',
      version: 3,
      packages: ['S咨询包 ¥100K', 'M开发包 ¥280K', 'L全栈包 ¥480K'],
      created_at: '2026-05-21',
      pricingColumns: [
        { prop: 'spec', label: '规格', minWidth: 80 },
        { prop: 'type', label: '类型', minWidth: 100 },
        { prop: 'scope', label: '包含阶段', minWidth: 250 },
        { prop: 'modules', label: '模块数', minWidth: 60 },
        { prop: 'duration', label: '参考工期', minWidth: 80 },
        { prop: 'price', label: '标准定价(元)', minWidth: 100 },
      ],
      pricing: [
        { spec: 'S咨询包', type: '咨询', scope: '调研+框架设计', modules: '—', duration: '10工作日', price: '100,000' },
        { spec: 'M开发包', type: '咨询+开发', scope: '调研+框架设计+核心模块开发(5个)+CI/CD', modules: '5', duration: '25工作日', price: '280,000' },
        { spec: 'L全栈包', type: '咨询+开发+实施', scope: 'M开发包+全部模块(10个)+部署验证+安全合规', modules: '10', duration: '40工作日', price: '480,000' },
      ],
      deliverables: [
        { id: 'D-01', name: 'IaC 调研与框架设计文档', phase: '阶段一', format: 'Word' },
        { id: 'D-02', name: 'Terraform 模块库', phase: '阶段二', format: 'Git Repo' },
        { id: 'D-03', name: 'CI/CD 流水线配置', phase: '阶段二', format: '代码' },
        { id: 'D-04', name: '策略即代码(Policy as Code)', phase: '阶段二', format: '代码' },
        { id: 'D-05', name: '部署验证报告', phase: '阶段三', format: 'Word/PDF' },
      ],
      content: `
        <h3>第一部分 协议基本信息</h3>
        <h3>第二部分 背景与目标</h3>
        <p>标准化自动化基础设施管理，Terraform 模块库，CI/CD 流水线，策略即代码</p>
        <h3>第三部分 服务范围</h3>
        <p>3.1 阶段一：调研与框架设计 — 现有基础设施盘点、IaC 技术选型、框架设计</p>
        <p>3.2 阶段二：模块开发 — Terraform 模块库、CI/CD 流水线、Policy as Code</p>
        <p>3.3 阶段三：部署验证 — 自动化部署测试、安全合规扫描、文档交付</p>
      `,
    },
    {
      id: 'ac-pricing',
      name: '安畅标准咨询实施服务 定价与服务目录',
      category: 'pricing',
      source: 'standard',
      description: '安畅 5 大标准咨询实施服务体系完整定价目录，含 LZ/WA/BD/MIG/IaC 全部服务包定价及云厂商对标',
      file_name: '安畅标准咨询实施服务_定价与服务目录_V1.0.docx',
      version: 3,
      packages: ['5大产品线全覆盖'],
      created_at: '2026-05-21',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: `
        <h3>第一部分 服务概述</h3>
        <p>5 大标准咨询实施服务体系：AC-LZ / AC-WA / AC-BD / AC-MIG / AC-IaC</p>
        <p>差异化优势：多云支持(7大云)、咨询+实施一体化、定价透明(约为云厂商50%~70%)、IaC资产交付</p>
        <h3>第二部分 Landing Zone 定价</h3>
        <h3>第三部分 Well-Architected 定价</h3>
        <h3>第四部分 Big Data 定价</h3>
        <h3>第五部分 Migration 定价</h3>
        <h3>第六部分 IaC 定价</h3>
      `,
    },
    {
      id: 'msp-lz',
      name: 'MSP Landing Zone SOW (客户参考版)',
      category: 'landing_zone',
      source: 'standard',
      description: 'MSP 版 Landing Zone SOW，含完整项目文档包(D-01~D-21)',
      file_name: 'MSP_LandingZone_SOW_CN_V1.0.docx',
      version: 1,
      packages: ['含21个交付物模板'],
      created_at: '2026-04-01',
      pricing: [],
      pricingColumns: [],
      deliverables: [
        { id: 'D-01', name: '云上IT治理现状调研报告', phase: '调研', format: 'Word' },
        { id: 'D-02', name: '合规差距分析报告', phase: '调研', format: 'Word' },
        { id: 'D-04', name: 'HLD 架构设计文档', phase: '设计', format: 'Word' },
        { id: 'D-05', name: 'LLD 实施方案', phase: '设计', format: 'Word' },
        { id: 'D-17', name: '验收报告', phase: '验收', format: 'Word' },
        { id: 'D-19', name: '运维操作手册', phase: '验收', format: 'Word' },
      ],
      content: '<p>MSP 版 Landing Zone SOW，含 LZ-D-01 到 LZ-D-21 共 21 个交付物模板</p>',
    },
    {
      id: 'msp-mig',
      name: 'MSP 云迁移 SOW (客户参考版)',
      category: 'migration',
      source: 'standard',
      description: 'MSP 版云迁移 SOW',
      file_name: 'MSP_Migration_SOW_CN_V1.0.docx',
      version: 1,
      packages: ['评估+规划+实施'],
      created_at: '2026-04-01',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<p>MSP 版云迁移项目交付服务工作说明书</p>',
    },
    {
      id: 'msp-bd',
      name: 'MSP 大数据平台 SOW (客户参考版)',
      category: 'big_data',
      source: 'standard',
      description: 'MSP 版大数据平台 SOW',
      file_name: 'MSP_BigData_SOW_CN_V1.0.docx',
      version: 1,
      packages: ['咨询+实施'],
      created_at: '2026-04-01',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<p>MSP 版大数据平台建设服务 SOW</p>',
    },
    {
      id: 'msp-wa',
      name: 'MSP Well-Architected SOW (客户参考版)',
      category: 'well_architected',
      source: 'standard',
      description: 'MSP 版云卓越架构评估 SOW',
      file_name: 'MSP_WellArchitected_SOW_CN_V1.0.docx',
      version: 1,
      packages: ['评估+报告'],
      created_at: '2026-04-01',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<p>MSP 版云卓越架构评估服务 SOW</p>',
    },
    // ========== 00Offering ==========
    {
      id: 'offering-pcs',
      name: 'FY2026 PCS 解决方案概览',
      category: 'general',
      source: 'standard',
      description: 'FY2026 专业云服务(PCS)解决方案概览，介绍安畅整体服务能力与产品矩阵',
      file_name: 'FY2026 PCS 解决方案概览_v0.2_260128.pptx',
      version: 1,
      packages: ['解决方案概览'],
      created_at: '2026-01-28',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>FY2026 PCS 解决方案概览</h3><p>介绍安畅专业云服务(PCS)整体能力、产品矩阵、服务交付模式</p>',
    },
    {
      id: 'offering-migration',
      name: '迁移 Offering V4.1.1',
      category: 'migration',
      source: 'standard',
      description: '云迁移服务 Offering 介绍 V4.1.1，含迁移方法论、服务包、定价参考',
      file_name: '迁移offeringV4.1.1 (1).pptx',
      version: 1,
      packages: ['迁移 Offering'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>迁移 Offering V4.1.1</h3><p>云迁移服务能力介绍、6R方法论、服务包定义、定价参考</p>',
    },
    // ========== 01LZ-SOW 客户示例版 ==========
    {
      id: 'lz-customer-sample',
      name: 'Landing Zone 咨询服务工作说明书 (客户示例版)',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 咨询服务 SOW 客户示例版，含完整服务范围与交付物清单',
      file_name: 'XXX-Landing Zone 咨询服务工作说明书 (4).docx',
      version: 1,
      packages: ['客户示例版'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>Landing Zone 咨询服务工作说明书</h3><p>客户示例版，含项目背景、服务范围、交付物、验收标准</p>',
    },
    // ========== 01LZ-SOW 21个交付物模板 ==========
    {
      id: 'lz-d01',
      name: 'LZ-D-01 云上IT治理现状调研报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段一交付物：云上 IT 治理现状调研报告模板',
      file_name: 'LZ-D-01_云上IT治理现状调研报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-01', name: '云上IT治理现状调研报告', phase: '阶段一·调研', format: 'Word' }],
      content: '<h3>LZ-D-01 云上IT治理现状调研报告</h3><p>调研客户现有云上 IT 治理现状，含账号体系、身份管理、网络架构、安全合规、成本管理、运维监控等维度的现状梳理</p>',
    },
    {
      id: 'lz-d02',
      name: 'LZ-D-02 合规差距分析报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段一交付物：合规差距分析报告模板',
      file_name: 'LZ-D-02_合规差距分析报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-02', name: '合规差距分析报告', phase: '阶段一·调研', format: 'Word' }],
      content: '<h3>LZ-D-02 合规差距分析报告</h3><p>基于等保/ISO27001/PCI-DSS 等合规标准，分析客户现状与合规要求的差距</p>',
    },
    {
      id: 'lz-d03',
      name: 'LZ-D-03 项目需求确认书',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段一交付物：项目需求确认书模板',
      file_name: 'LZ-D-03_项目需求确认书.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-03', name: '项目需求确认书', phase: '阶段一·调研', format: 'Word' }],
      content: '<h3>LZ-D-03 项目需求确认书</h3><p>明确项目范围、目标、约束条件、验收标准，双方签字确认</p>',
    },
    {
      id: 'lz-d04',
      name: 'LZ-D-04 HLD 架构设计文档',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：高阶架构设计文档(HLD)模板',
      file_name: 'LZ-D-04_HLD_架构设计文档.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-04', name: 'HLD 架构设计文档', phase: '阶段二·设计', format: 'Word/PDF' }],
      content: '<h3>LZ-D-04 HLD 架构设计文档</h3><p>高阶架构设计，含账号组织结构、网络拓扑、安全架构、身份管理架构</p>',
    },
    {
      id: 'lz-d05',
      name: 'LZ-D-05 LLD 实施方案',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：低阶实施方案(LLD)模板',
      file_name: 'LZ-D-05_LLD_实施方案.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-05', name: 'LLD 实施方案', phase: '阶段二·设计', format: 'Word/PDF' }],
      content: '<h3>LZ-D-05 LLD 实施方案</h3><p>低阶实施方案，含具体资源配置、IaC 代码结构、部署步骤</p>',
    },
    {
      id: 'lz-d06',
      name: 'LZ-D-06 IP地址规划表',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：IP 地址规划表模板',
      file_name: 'LZ-D-06_IP地址规划表.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-06', name: 'IP地址规划表', phase: '阶段二·设计', format: 'Excel' }],
      content: '<h3>LZ-D-06 IP地址规划表</h3><p>VPC/Subnet/CIDR 规划，含生产/测试/开发环境地址分配</p>',
    },
    {
      id: 'lz-d07',
      name: 'LZ-D-07 IAM权限矩阵',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：IAM 权限矩阵模板',
      file_name: 'LZ-D-07_IAM权限矩阵.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-07', name: 'IAM权限矩阵', phase: '阶段二·设计', format: 'Excel' }],
      content: '<h3>LZ-D-07 IAM权限矩阵</h3><p>角色-权限映射矩阵，含管理员/开发者/审计员/运维等角色的权限定义</p>',
    },
    {
      id: 'lz-d08',
      name: 'LZ-D-08 标签策略设计文档',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：标签策略设计文档模板',
      file_name: 'LZ-D-08_标签策略设计文档.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-08', name: '标签策略设计文档', phase: '阶段二·设计', format: 'Word' }],
      content: '<h3>LZ-D-08 标签策略设计文档</h3><p>标签键值定义、强制标签策略、成本归因标签规范</p>',
    },
    {
      id: 'lz-d09',
      name: 'LZ-D-09 SCP策略设计文档',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段二交付物：SCP(服务控制策略)设计文档模板',
      file_name: 'LZ-D-09_SCP策略设计文档.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-09', name: 'SCP策略设计文档', phase: '阶段二·设计', format: 'Word' }],
      content: '<h3>LZ-D-09 SCP策略设计文档</h3><p>组织级服务控制策略，限制账号可执行的操作，防止误操作和安全风险</p>',
    },
    {
      id: 'lz-d10',
      name: 'LZ-D-10 已部署环境说明',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：已部署环境说明文档模板',
      file_name: 'LZ-D-10_已部署环境说明.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-10', name: '已部署环境说明', phase: '阶段三·实施', format: 'Word' }],
      content: '<h3>LZ-D-10 已部署环境说明</h3><p>记录已部署的 Landing Zone 环境配置，含账号/网络/安全/IAM 实际配置</p>',
    },
    {
      id: 'lz-d11',
      name: 'LZ-D-11 IaC代码仓库README',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：IaC 代码仓库 README 模板',
      file_name: 'LZ-D-11_IaC代码仓库README.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-11', name: 'IaC代码仓库README', phase: '阶段三·实施', format: 'Git Repo' }],
      content: '<h3>LZ-D-11 IaC代码仓库README</h3><p>代码仓库结构说明、模块依赖关系、部署指南、变量说明</p>',
    },
    {
      id: 'lz-d12',
      name: 'LZ-D-12 安全基线配置清单',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：安全基线配置清单模板',
      file_name: 'LZ-D-12_安全基线配置清单.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-12', name: '安全基线配置清单', phase: '阶段三·实施', format: 'Word/Excel' }],
      content: '<h3>LZ-D-12 安全基线配置清单</h3><p>安全基线配置项清单，含加密/日志/网络/IAM/审计等配置要求</p>',
    },
    {
      id: 'lz-d13',
      name: 'LZ-D-13 合规检查报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：合规检查报告模板',
      file_name: 'LZ-D-13_合规检查报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-13', name: '合规检查报告', phase: '阶段三·实施', format: 'Word/PDF' }],
      content: '<h3>LZ-D-13 合规检查报告</h3><p>基于合规标准对部署环境进行检查，输出合规项通过/不通过清单</p>',
    },
    {
      id: 'lz-d14',
      name: 'LZ-D-14 日志链路验证报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：日志链路验证报告模板',
      file_name: 'LZ-D-14_日志链路验证报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-14', name: '日志链路验证报告', phase: '阶段三·实施', format: 'Word/PDF' }],
      content: '<h3>LZ-D-14 日志链路验证报告</h3><p>验证 CloudTrail/审计日志/操作日志的采集、存储、分析链路完整性</p>',
    },
    {
      id: 'lz-d15',
      name: 'LZ-D-15 网络连通性测试报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段三交付物：网络连通性测试报告模板',
      file_name: 'LZ-D-15_网络连通性测试报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-15', name: '网络连通性测试报告', phase: '阶段三·实施', format: 'Word/PDF' }],
      content: '<h3>LZ-D-15 网络连通性测试报告</h3><p>VPC/子网/安全组/VPN/专线连通性测试结果</p>',
    },
    {
      id: 'lz-d16',
      name: 'LZ-D-16 UAT验收测试用例清单',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：UAT 验收测试用例清单模板',
      file_name: 'LZ-D-16_UAT验收测试用例清单.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-16', name: 'UAT验收测试用例清单', phase: '阶段四·验收', format: 'Word/Excel' }],
      content: '<h3>LZ-D-16 UAT验收测试用例清单</h3><p>用户验收测试用例，含功能/安全/性能/合规测试项</p>',
    },
    {
      id: 'lz-d17',
      name: 'LZ-D-17 验收报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：验收报告模板',
      file_name: 'LZ-D-17_验收报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-17', name: '验收报告', phase: '阶段四·验收', format: 'Word' }],
      content: '<h3>LZ-D-17 验收报告</h3><p>项目验收报告，含交付物清单、验收结论、双方签字</p>',
    },
    {
      id: 'lz-d18',
      name: 'LZ-D-18 项目总结报告',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：项目总结报告模板',
      file_name: 'LZ-D-18_项目总结报告.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-18', name: '项目总结报告', phase: '阶段四·验收', format: 'Word' }],
      content: '<h3>LZ-D-18 项目总结报告</h3><p>项目整体总结，含成果回顾、经验教训、后续建议</p>',
    },
    {
      id: 'lz-d19',
      name: 'LZ-D-19 运维操作手册',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：运维操作手册模板',
      file_name: 'LZ-D-19_运维操作手册.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-19', name: '运维操作手册', phase: '阶段四·验收', format: 'Word' }],
      content: '<h3>LZ-D-19 运维操作手册</h3><p>日常运维操作手册，含账号管理/权限变更/网络配置/安全审计等操作流程</p>',
    },
    {
      id: 'lz-d20',
      name: 'LZ-D-20 培训材料大纲',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：培训材料大纲模板',
      file_name: 'LZ-D-20_培训材料大纲.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-20', name: '培训材料大纲', phase: '阶段四·验收', format: 'Word/PPT' }],
      content: '<h3>LZ-D-20 培训材料大纲</h3><p>知识转移培训材料大纲，含培训模块/课时/对象/考核方式</p>',
    },
    {
      id: 'lz-d21',
      name: 'LZ-D-21 完整项目文档包清单',
      category: 'landing_zone',
      source: 'standard',
      description: 'Landing Zone 阶段四交付物：完整项目文档包清单模板',
      file_name: 'LZ-D-21_完整项目文档包清单.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'LZ-D-21', name: '完整项目文档包清单', phase: '阶段四·验收', format: 'Word' }],
      content: '<h3>LZ-D-21 完整项目文档包清单</h3><p>全部交付物清单汇总，含文档编号/名称/版本/格式/存放位置</p>',
    },
    // ========== 03BD-SOW 客户示例版 ==========
    {
      id: 'bd-dev-sample',
      name: '大数据开发服务工作说明书 (客户示例版)',
      category: 'big_data',
      source: 'standard',
      description: '大数据平台开发服务 SOW 客户示例版，含数据开发/ETL/数据分析服务范围',
      file_name: 'XXX-Big data  开发服务工作说明书 .docx',
      version: 1,
      packages: ['客户示例版'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>大数据开发服务工作说明书</h3><p>客户示例版，含数据开发/ETL pipeline/数据仓库建设服务范围</p>',
    },
    {
      id: 'bd-mig-sample',
      name: '大数据迁移服务工作说明书 (客户示例版)',
      category: 'big_data',
      source: 'standard',
      description: '大数据平台迁移服务 SOW 客户示例版，含数据迁移/平台迁移服务范围',
      file_name: 'XXX-Big data  迁移服务工作说明书  (1).docx',
      version: 1,
      packages: ['客户示例版'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>大数据迁移服务工作说明书</h3><p>客户示例版，含大数据平台迁移/数据迁移验证服务范围</p>',
    },
    {
      id: 'bd-d20',
      name: 'BD-D-20 UAT用例清单',
      category: 'big_data',
      source: 'standard',
      description: '大数据平台阶段四交付物：UAT 用例清单模板',
      file_name: 'BD-D-20_UAT用例清单.docx',
      version: 1,
      packages: ['交付物模板'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [{ id: 'BD-D-20', name: 'UAT用例清单', phase: '阶段四·验收', format: 'Word/Excel' }],
      content: '<h3>BD-D-20 UAT用例清单</h3><p>大数据平台 UAT 验收测试用例，含数据准确性/性能/功能测试项</p>',
    },
    // ========== 04QY-SOW 客户示例版 ==========
    {
      id: 'mig-customer-sample',
      name: '云迁移项目交付服务工作说明书 (客户示例版)',
      category: 'migration',
      source: 'standard',
      description: '云迁移项目交付服务 SOW 客户示例版，含完整迁移服务范围与交付物',
      file_name: '【SOW】云迁移项目交付服务工作说明书  (2).docx',
      version: 1,
      packages: ['客户示例版'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>云迁移项目交付服务工作说明书</h3><p>客户示例版，含迁移评估/规划/实施/割接全流程服务范围</p>',
    },
    // ========== 05IAC-SOW 客户示例版 ==========
    {
      id: 'iac-customer-sample',
      name: 'IAC项目工作说明书 (客户示例版)',
      category: 'iac',
      source: 'standard',
      description: 'IaC 基础设施即代码项目 SOW 客户示例版，含 Terraform 模块开发服务范围',
      file_name: 'IAC项目工作说明书.docx',
      version: 1,
      packages: ['客户示例版'],
      created_at: '2026-06-17',
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<h3>IAC项目工作说明书</h3><p>客户示例版，含 Terraform 模块开发/CI-CD/策略即代码服务范围</p>',
    },
  ]
})

function handleFileChange(file) {
  uploadForm.file = file.raw
}

function previewTemplate(row) {
  previewData.value = row
  showPreviewDialog.value = true
}

function generateFromTemplate(row) {
  showPreviewDialog.value = false
  router.push({ path: '/skills', query: { skill: 'Generate-SOW', template: row.id } })
  ElMessage.success(`已选择模板: ${row.name}，即将进入 AI 生成`)
}

function downloadTemplate(row) {
  ElMessage.info(`下载 ${row.file_name}（功能开发中）`)
}

async function handleUpload() {
  const valid = await uploadFormRef.value.validate().catch(() => false)
  if (!valid) return
  uploading.value = true
  try {
    templates.value.unshift({
      id: 'custom-' + Date.now(),
      name: uploadForm.name,
      category: uploadForm.category,
      source: 'custom',
      description: uploadForm.description,
      file_name: uploadForm.file?.name || 'unknown',
      version: 1,
      packages: [],
      created_at: new Date().toISOString().split('T')[0],
      pricing: [],
      pricingColumns: [],
      deliverables: [],
      content: '<p>模板内容将在上传后解析显示</p>',
    })
    ElMessage.success('模板上传成功')
    showUploadDialog.value = false
    Object.assign(uploadForm, { name: '', category: '', description: '', file: null })
  } finally {
    uploading.value = false
  }
}

function handleDelete(id) {
  templates.value = templates.value.filter(t => t.id !== id)
  ElMessage.success('删除成功')
}
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
.template-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.package-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.template-preview {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
  line-height: 1.8;
}
.template-preview h3 { margin: 12px 0 8px; color: #303133; font-size: 14px; }
.template-preview p { color: #606266; font-size: 13px; margin: 4px 0; }
</style>
