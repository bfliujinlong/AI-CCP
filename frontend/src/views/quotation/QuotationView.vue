<template>
  <div class="quotation-view" v-loading="loading">
    <el-page-header @back="$router.push(`/opportunities/${opportunityId}`)" :title="'返回商机'">
      <template #content>
        <span class="page-title">AI 报价 - {{ opportunityName }}</span>
      </template>
    </el-page-header>

    <!-- 关键指标 -->
    <el-row :gutter="16" style="margin-top: 20px" v-if="estimate">
      <el-col :span="6">
        <el-card shadow="hover" class="metric-card metric-blue">
          <div class="metric-label">总工时</div>
          <div class="metric-value">{{ estimate.totalHours }} 人天</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="metric-card metric-green">
          <div class="metric-label">总成本</div>
          <div class="metric-value">¥{{ formatMoney(cost?.totalCost || 0) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="metric-card metric-purple">
          <div class="metric-label">业务系统</div>
          <div class="metric-value">{{ input.resources.business_systems }} 个</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="metric-card metric-orange">
          <div class="metric-label">项目周期</div>
          <div class="metric-value">{{ estimate.totalWeeks }} 周</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- 左侧输入区 -->
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>评估输入</span>
              <div>
                <el-button size="small" @click="recalculate" type="primary">
                  <el-icon><Refresh /></el-icon> 重新计算
                </el-button>
                <el-button size="small" @click="resetToDefault">重置默认</el-button>
              </div>
            </div>
          </template>

          <el-collapse v-model="activePanels" style="border: none">
            <!-- 资源分析 -->
            <el-collapse-item name="resources">
              <template #title>
                <span>资源分析
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">资源数量×权重=规模因子，是工时计算的核心输入，实时影响计划</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-form label-width="180px" size="small">
                <el-form-item label="业务系统数量">
                  <el-input-number v-model="input.resources.business_systems" :min="0" @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 320px"><strong>影响程度：极高</strong><br/>权重 10（最高），每增加 1 个系统，实时增加 10 × 平均复杂度的工时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="虚拟机数量">
                  <el-input-number v-model="input.resources.vms" :min="0" @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 320px"><strong>影响程度：中</strong><br/>权重 0.2，每增加 10 台，实时增加 2 × 平均复杂度的工时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="Kubernetes 节点数">
                  <el-input-number v-model="input.resources.kubernetes_nodes" :min="0" @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 320px"><strong>影响程度：中</strong><br/>权重 0.3，每增加 10 个节点，实时增加 3 × 平均复杂度的工时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="容器实例数">
                  <el-input-number v-model="input.resources.container_instances" :min="0" @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 320px"><strong>影响程度：低</strong><br/>权重 0.1，每增加 10 个实例，实时增加 1 × 平均复杂度的工时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-divider content-position="left">
                  <span>数据库资源（权重 1.0/实例）
                    <el-tooltip placement="top" effect="light">
                      <template #content><div style="max-width: 320px"><strong>影响程度：中高</strong><br/>权重 1.0，每增加 1 个实例，实时增加 1 × 平均复杂度的工时</div></template>
                      <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </el-divider>
                <el-row :gutter="12">
                  <el-col :span="8" v-for="db in dbTypes" :key="db.key">
                    <el-form-item :label="db.label" label-width="100px">
                      <el-input-number v-model="input.resources.databases[db.key]" :min="0" @change="recalculate" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>
            </el-collapse-item>

            <!-- 应用技术栈 -->
            <el-collapse-item name="techStack">
              <template #title>
                <span>应用技术栈评估
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">技术复杂度每变化 1 分，实时影响总工时（资源规模因子 × 1）</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-form label-width="160px" size="small">
                <el-form-item label="开发语言">
                  <el-checkbox-group v-model="input.techStack.languages" @change="recalculate">
                    <el-checkbox v-for="(val, key) in techWeights.languages" :key="key" :label="key">{{ langLabels[key] }} ({{ val }})</el-checkbox>
                  </el-checkbox-group>
                  <el-tooltip placement="top" effect="light">
                    <template #content>
                      <div style="max-width: 320px">
                        <strong>复杂度权重说明</strong><br/>
                        Java: 3.5 / Python: 2.5 / .NET: 3.0 / PHP: 2.0<br/>
                        Node.js: 2.5 / Go: 3.0 / 其他: 4.0<br/>
                        <em>选择多种语言会增加整体复杂度</em>
                      </div>
                    </template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="前端框架">
                  <el-checkbox-group v-model="input.techStack.frameworks" @change="recalculate">
                    <el-checkbox v-for="(val, key) in techWeights.frameworks" :key="key" :label="key">{{ frameworkLabels[key] }} ({{ val }})</el-checkbox>
                  </el-checkbox-group>
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px"><strong>复杂度权重</strong><br/>Vue: 2.5 / React: 3.0 / Angular: 3.5 / jQuery: 2.0 / 无: 1.5</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="多语言支持">
                  <el-radio-group v-model="input.techStack.multiLanguage" @change="recalculate">
                    <el-radio label="no">否 (1.0)</el-radio>
                    <el-radio label="simple">简单 2-3 种 (2.5)</el-radio>
                    <el-radio label="complex">复杂 5 种+ (4.0)</el-radio>
                  </el-radio-group>
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">否: 1.0 / 简单(2-3种): 2.5 / 复杂(5种+): 4.0</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="架构类型">
                  <el-radio-group v-model="input.techStack.architecture" @change="recalculate">
                    <el-radio label="monolith">单体 (2.0)</el-radio>
                    <el-radio label="micro">微服务 (4.0)</el-radio>
                    <el-radio label="hybrid">混合 (3.5)</el-radio>
                  </el-radio-group>
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">单体: 2.0 / 微服务: 4.0 / 混合: 3.5</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="第三方集成">
                  <el-radio-group v-model="input.techStack.thirdParty" @change="recalculate">
                    <el-radio label="none">无 (1.0)</el-radio>
                    <el-radio label="few">少量 1-3 (2.5)</el-radio>
                    <el-radio label="medium">中等 4-10 (3.5)</el-radio>
                    <el-radio label="many">大量 10+ (4.5)</el-radio>
                  </el-radio-group>
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">无: 1.0 / 少量: 2.5 / 中等: 3.5 / 大量: 4.5</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="计算技术复杂度">
                  <el-tag :type="estimate ? 'primary' : 'info'" size="large">
                    {{ estimate?.techComplexity || '-' }} / 5.0
                  </el-tag>
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">每变化 0.1 分，工时变化约资源规模因子 × 0.1</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 其他复杂度 -->
            <el-collapse-item name="complexity">
              <template #title>
                <span>其他复杂度评估
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">每维度每变化 1 分，总工时变化约资源规模因子 × 0.2</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-form label-width="160px" size="small">
                <el-form-item label="业务复杂度 (1-5)">
                  <el-slider v-model="input.complexity.business" :min="1" :max="5" :step="0.1" show-input @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">1级：单一流程 / 2级：少数关联 / 3级：多关联 / 4级：复杂多部门 / 5级：跨组织动态</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="集成复杂度 (1-5)">
                  <el-slider v-model="input.complexity.integration" :min="1" :max="5" :step="0.1" show-input @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">1级：无集成 / 2级：简单API / 3级：多系统 / 4级：异构大量 / 5级：跨组织实时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="安全要求 (1-5)">
                  <el-slider v-model="input.complexity.security" :min="1" :max="5" :step="0.1" show-input @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">1级：基本认证 / 2级：角色权限 / 3级：多因素加密 / 4级：高级控制审计 / 5级：零信任军事级</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
                <el-form-item label="合规等级 (1-5)">
                  <el-slider v-model="input.complexity.compliance" :min="1" :max="5" :step="0.1" show-input @change="recalculate" />
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">1级：无要求 / 2级：内部规范 / 3级：行业法规 / 4级：严格法规(医疗金融) / 5级：多国严格法规</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </el-form-item>
              </el-form>
            </el-collapse-item>

            <!-- 应用复杂度评估表 -->
            <el-collapse-item name="apps">
              <template #title>
                <span>应用复杂度评估 ({{ input.apps.length }} 个应用)
                  <el-tooltip placement="top" effect="light">
                    <template #content>
                      <div style="max-width: 350px">
                        <strong>四维评分体系 (1-5 分)</strong><br/>
                        对每个应用从 4 个维度评分，取平均分映射 L1-L5 等级<br/>
                        再乘以修正系数得到最终人天
                      </div>
                    </template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-button size="small" type="primary" @click="addApp" style="margin-bottom: 12px">
                <el-icon><Plus /></el-icon> 添加应用
              </el-button>
              <el-table :data="input.apps" border size="small" v-if="input.apps.length > 0">
                <el-table-column label="应用名称" width="150">
                  <template #default="{ row }">
                    <el-input v-model="row.name" size="small" placeholder="应用名" />
                  </template>
                </el-table-column>
                <el-table-column width="80">
                  <template #header>
                    <span>D1 架构
                      <el-tooltip placement="top" effect="light">
                        <template #content>
                          <div style="max-width: 320px">
                            <strong>架构复杂度</strong><br/>
                            1分：单体应用，无状态，无硬件依赖<br/>
                            2分：少量微服务(2-4)，基本无状态<br/>
                            3分：中等微服务(5-10)，部分有状态<br/>
                            4分：较多微服务(10+)，有状态，依赖特定硬件<br/>
                            5分：大规模微服务(20+)，强状态，深度重构
                          </div>
                        </template>
                        <el-icon style="color: #409EFF; cursor: help"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <el-input-number v-model="row.d1" :min="1" :max="5" size="small" style="width: 70px" @change="recalculate" />
                  </template>
                </el-table-column>
                <el-table-column width="80">
                  <template #header>
                    <span>D2 数据
                      <el-tooltip placement="top" effect="light">
                        <template #content>
                          <div style="max-width: 320px">
                            <strong>数据复杂度</strong><br/>
                            1分：单一 RDS，无实时性要求<br/>
                            2分：1-2 种 DB，弱一致性，RPO>30min<br/>
                            3分：多类型 DB，强一致性，RPO<5min<br/>
                            4分：自建 DB 集群，实时数据流，窗口<2h<br/>
                            5分：多地多活，0 停机，国密加密
                          </div>
                        </template>
                        <el-icon style="color: #409EFF; cursor: help"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <el-input-number v-model="row.d2" :min="1" :max="5" size="small" style="width: 70px" @change="recalculate" />
                  </template>
                </el-table-column>
                <el-table-column width="80">
                  <template #header>
                    <span>D3 耦合
                      <el-tooltip placement="top" effect="light">
                        <template #content>
                          <div style="max-width: 320px">
                            <strong>耦合度</strong><br/>
                            1分：无外部集成，无本地文件依赖<br/>
                            2分：1-3 个外部接口，偶尔写本地日志<br/>
                            3分：4-8 个接口，MQ 消费，NFS 挂载<br/>
                            4分：9-15 个接口，强依赖本地路径/IP<br/>
                            5分：15+ 接口，私有协议，供应商 SDK 限制
                          </div>
                        </template>
                        <el-icon style="color: #409EFF; cursor: help"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <el-input-number v-model="row.d3" :min="1" :max="5" size="small" style="width: 70px" @change="recalculate" />
                  </template>
                </el-table-column>
                <el-table-column width="80">
                  <template #header>
                    <span>D4 改造
                      <el-tooltip placement="top" effect="light">
                        <template #content>
                          <div style="max-width: 320px">
                            <strong>改造深度</strong><br/>
                            1分：Rehost（纯迁移），零代码改动<br/>
                            2分：Rehost+微调，调整启动脚本/环境变量<br/>
                            3分：Re-platform，调整 Ingress/HPA，轻度代码(<5%)<br/>
                            4分：Refactor 中度重构，服务拆分，代码改 5-20%<br/>
                            5分：Re-architect 架构级改造，代码改>20%
                          </div>
                        </template>
                        <el-icon style="color: #409EFF; cursor: help"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <el-input-number v-model="row.d4" :min="1" :max="5" size="small" style="width: 70px" @change="recalculate" />
                  </template>
                </el-table-column>
                <el-table-column width="200">
                  <template #header>
                    <span>修正系数
                      <el-tooltip placement="top" effect="light">
                        <template #content>
                          <div style="max-width: 320px">
                            <strong>修正系数（连乘）</strong><br/>
                            自动化工具 ×0.8：Crane/Velero 覆盖 80%+<br/>
                            文档缺失 ×1.5：Runbook/架构图/源码缺失<br/>
                            带宽限制 ×1.2：无专线或带宽&lt;100Mbps<br/>
                            合规要求 ×1.3：数据出境/等保/国密改造
                          </div>
                        </template>
                        <el-icon style="color: #409EFF; cursor: help"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </template>
                  <template #default="{ row }">
                    <el-checkbox v-model="row.modifiers.automation" size="small" @change="recalculate">自动化×0.8</el-checkbox>
                    <el-checkbox v-model="row.modifiers.docMissing" size="small" @change="recalculate">文档缺失×1.5</el-checkbox>
                    <el-checkbox v-model="row.modifiers.bandwidth" size="small" @change="recalculate">带宽限制×1.2</el-checkbox>
                    <el-checkbox v-model="row.modifiers.compliance" size="small" @change="recalculate">合规×1.3</el-checkbox>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="70">
                  <template #default="{ $index }">
                    <el-button size="small" type="danger" text @click="input.apps.splice($index, 1); recalculate()">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="添加应用后逐个评分（架构/数据/耦合/改造深度）" :image-size="60" />
            </el-collapse-item>

            <!-- 迁移服务计费项 -->
            <el-collapse-item name="migration">
              <template #title>
                <span>迁移服务计费项
                  <el-tooltip placement="top" effect="light">
                    <template #content><div style="max-width: 300px">按实际迁移量计算工时：主机/容器/存储/中间件/数据库<br/>每个计费项有固定的人天/单位比率<br/>与资源分析模块独立计算，结果累加到总工时</div></template>
                    <el-icon style="color: #409EFF; cursor: help; margin-left: 4px"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-form label-width="200px" size="small">
                <el-row :gutter="12">
                  <el-col :span="12" v-for="item in migrationItemDefs" :key="item.id">
                    <el-form-item :label="item.name">
                      <el-input-number v-model="input.migrationItems[item.id]" :min="0" size="small" @change="recalculate" style="width: 120px" />
                      <el-tooltip placement="top" effect="light">
                        <template #content><div style="max-width: 280px"><strong>{{ item.name }}</strong><br/>每 {{ item.perUnitDays }} {{ item.unit }} = 1 人天<br/>角色: {{ CONFIG.ROLES[item.role]?.name || item.role }}</div></template>
                        <el-icon style="color: #409EFF; cursor: help; margin-left: 8px"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>
            </el-collapse-item>

            <!-- 人员成本配置 -->
            <el-collapse-item title="人员成本配置" name="cost">
              <el-form label-width="180px" size="small">
                <el-row :gutter="12">
                  <el-col :span="12">
                    <el-form-item label="初级工程师(元/天)">
                      <el-input-number v-model="input.rates.junior" :min="1000" :step="500" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="初级人数">
                      <el-input-number v-model="input.counts.junior" :min="0" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="中级工程师(元/天)">
                      <el-input-number v-model="input.rates.mid" :min="1500" :step="500" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="中级人数">
                      <el-input-number v-model="input.counts.mid" :min="0" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="高级工程师(元/天)">
                      <el-input-number v-model="input.rates.senior" :min="2500" :step="500" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="高级人数">
                      <el-input-number v-model="input.counts.senior" :min="0" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="项目经理(元/天)">
                      <el-input-number v-model="input.rates.pm" :min="3000" :step="500" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="PM 人数">
                      <el-input-number v-model="input.counts.pm" :min="0" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-divider content-position="left">额外成本</el-divider>
                <el-row :gutter="12">
                  <el-col :span="8">
                    <el-form-item label="培训成本(元)" label-width="120px">
                      <el-input-number v-model="input.extraCosts.training" :min="0" :step="5000" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="应急储备(元)" label-width="120px">
                      <el-input-number v-model="input.extraCosts.contingency" :min="0" :step="5000" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="硬件资源(元)" label-width="120px">
                      <el-input-number v-model="input.extraCosts.resource" :min="0" :step="10000" @change="recalculate" />
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>

      <!-- 右侧结果区 -->
      <el-col :span="10" v-if="estimate">
        <el-card shadow="never" style="margin-bottom: 16px">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>估算结果</span>
              <div>
                <el-button size="small" @click="exportQuotation('csv')">CSV</el-button>
                <el-button size="small" type="primary" @click="exportQuotation('word')">Word</el-button>
                <el-button size="small" @click="exportQuotation('pdf')">PDF</el-button>
              </div>
            </div>
          </template>

          <!-- 核心数据 -->
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="资源规模因子">{{ estimate.resourceFactor }}</el-descriptions-item>
            <el-descriptions-item label="平均复杂度">{{ estimate.avgComplexity }} / 5.0</el-descriptions-item>
            <el-descriptions-item label="基础工时">{{ estimate.baseHours }} 人天</el-descriptions-item>
            <el-descriptions-item label="技术复杂度">{{ estimate.techComplexity }} / 5.0</el-descriptions-item>
            <el-descriptions-item label="应用迁移工时">{{ estimate.appDaysLow }}-{{ estimate.appDaysHigh }} 人天</el-descriptions-item>
            <el-descriptions-item label="迁移服务工时">{{ estimate.migrationDays }} 人天</el-descriptions-item>
            <el-descriptions-item label="总工时" :span="2">
              <span style="font-size: 18px; font-weight: bold; color: #409EFF">{{ estimate.totalHours }} 人天</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 阶段工时分配 -->
        <el-card shadow="never" style="margin-bottom: 16px">
          <template #header>阶段工时分配</template>
          <div v-for="(ratio, phase) in phaseRatios" :key="phase" class="phase-bar">
            <div class="phase-label">{{ phaseLabels[phase] }}</div>
            <div class="phase-track">
              <div class="phase-fill" :style="{ width: ((estimate.phaseHours[phase] / estimate.totalHours) * 100) + '%', background: phaseColors[phase] }"></div>
            </div>
            <div class="phase-value">{{ estimate.phaseHours[phase] }} 人天 ({{ (ratio * 100) + '%' }})</div>
          </div>
        </el-card>

        <!-- 成本明细 -->
        <el-card shadow="never" style="margin-bottom: 16px" v-if="cost">
          <template #header>成本明细</template>
          <el-table :data="costRows" border size="small">
            <el-table-column prop="item" label="项目" min-width="140" />
            <el-table-column prop="detail" label="明细" min-width="120" />
            <el-table-column prop="amount" label="金额(元)" width="120" align="right">
              <template #default="{ row }">
                ¥{{ formatMoney(row.amount) }}
              </template>
            </el-table-column>
          </el-table>
          <div class="cost-total">
            总计: <span class="cost-total-value">¥{{ formatMoney(cost.totalCost) }}</span>
          </div>
        </el-card>

        <!-- 应用评估汇总 -->
        <el-card shadow="never" v-if="estimate.appAssessment.apps.length > 0">
          <template #header>应用评估汇总 ({{ estimate.appAssessment.summary.count }} 个应用)</template>
          <el-table :data="estimate.appAssessment.apps" border size="small">
            <el-table-column prop="name" label="应用名称" min-width="120" />
            <el-table-column label="评分" width="80">
              <template #default="{ row }">{{ row.avgScore }}</template>
            </el-table-column>
            <el-table-column prop="level" label="等级" width="100" />
            <el-table-column label="修正后人天" width="120">
              <template #default="{ row }">{{ row.modifiedDaysLow }}-{{ row.modifiedDaysHigh }}</template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 8px; font-size: 13px; color: #606266">
            总计: {{ estimate.appDaysLow }}-{{ estimate.appDaysHigh }} 人天
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作按钮 -->
    <el-card shadow="never" style="margin-top: 20px">
      <div style="display: flex; gap: 12px; justify-content: center">
        <el-button type="primary" @click="saveResult">保存报价</el-button>
        <el-button @click="$router.push(`/sow/${opportunityId}`)">生成 SOW</el-button>
        <el-button @click="$router.push(`/wbs/${opportunityId}`)">生成 WBS</el-button>
        <el-button @click="$router.push(`/opportunities/${opportunityId}`)">返回商机</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { opportunityApi, factsheetApi } from '@/api'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { exportDocument } from '@/utils/export'
import { getJSON, setJSON } from '@/utils/db'
import {
  CONFIG, calculateEstimate, calculateCost, getDefaultInput,
} from '@/utils/estimation'

const route = useRoute()
const opportunityId = route.params.opportunityId
const loading = ref(false)
const opportunityName = ref('')
const activePanels = ref(['resources', 'techStack'])

// 输入数据
const input = reactive(getDefaultInput())

// 估算结果
const estimate = ref(null)
const cost = ref(null)

// 常量
const dbTypes = [
  { key: 'mysql', label: 'MySQL' },
  { key: 'oracle', label: 'Oracle' },
  { key: 'sqlserver', label: 'SQL Server' },
  { key: 'redis', label: 'Redis' },
  { key: 'mongodb', label: 'MongoDB' },
]
const techWeights = CONFIG.TECH_WEIGHTS
const langLabels = { java: 'Java', python: 'Python', net: '.NET', php: 'PHP', nodejs: 'Node.js', go: 'Go', other: '其他' }
const frameworkLabels = { vue: 'Vue', react: 'React', angular: 'Angular', jquery: 'jQuery', none: '无框架', other: '其他' }
const migrationItemDefs = CONFIG.MIGRATION_SERVICE_ITEMS
const phaseRatios = CONFIG.HOUR_RATIOS
const phaseLabels = { discovery: '需求调研', planning: '方案规划', implementation: '实施部署', testing: '测试验证', acceptance: '验收交付' }
const phaseColors = { discovery: '#409EFF', planning: '#67C23A', implementation: '#E6A23C', testing: '#F56C6C', acceptance: '#909399' }

// 计算属性
const costRows = computed(() => {
  if (!cost.value) return []
  const p = cost.value.personnel
  return [
    { item: '初级工程师', detail: `${p.junior.count}人 × ${p.junior.rate}元/天`, amount: p.junior.cost },
    { item: '中级工程师', detail: `${p.mid.count}人 × ${p.mid.rate}元/天`, amount: p.mid.cost },
    { item: '高级工程师', detail: `${p.senior.count}人 × ${p.senior.rate}元/天`, amount: p.senior.cost },
    { item: '项目经理', detail: `${p.pm.count}人 × ${p.pm.rate}元/天`, amount: p.pm.cost },
    { item: '人力成本小计', detail: '', amount: cost.value.personnelCost },
    { item: '培训成本', detail: '', amount: cost.value.training },
    { item: '应急储备', detail: '', amount: cost.value.contingency },
    { item: '硬件资源', detail: '', amount: cost.value.resource },
  ]
})

// 方法
function formatMoney(val) {
  return Number(val || 0).toLocaleString()
}

function recalculate() {
  try {
    estimate.value = calculateEstimate(input)
    cost.value = calculateCost(estimate.value, input.rates, input.counts, input.extraCosts)
  } catch (e) {
    console.error('[QuotationView] 计算估算失败:', e)
  }
}

function resetToDefault() {
  Object.assign(input, getDefaultInput())
  recalculate()
}

function addApp() {
  input.apps.push({
    name: `应用${input.apps.length + 1}`,
    d1: 2, d2: 2, d3: 2, d4: 1,
    modifiers: { automation: false, docMissing: false, bandwidth: false, compliance: false, other: 1 },
  })
  recalculate()
}

function saveResult() {
  const result = {
    estimate: estimate.value,
    cost: cost.value,
    input: JSON.parse(JSON.stringify(input)),
    saved_at: new Date().toISOString(),
  }
  setJSON(`aicc_quotation_${opportunityId}`, result)
  ElMessage.success('报价已保存，刷新页面不丢')
}

async function exportQuotation(format = 'csv') {
  if (!estimate.value) return
  const e = estimate.value
  const c = cost.value
  const fileName = `报价单_${opportunityName.value}_${dayjs().format('YYYYMMDD')}`

  if (format === 'csv') {
    const rows = [
      ['项目', '数值'],
      ['总工时(人天)', e.totalHours],
      ['总成本(元)', c.totalCost],
      ['项目周期(周)', e.totalWeeks],
      ['资源规模因子', e.resourceFactor],
      ['平均复杂度', e.avgComplexity],
      ['基础工时', e.baseHours],
      ['应用迁移工时', `${e.appDaysLow}-${e.appDaysHigh}`],
      ['迁移服务工时', e.migrationDays],
      ['初级工程师成本', c.personnel.junior.cost],
      ['中级工程师成本', c.personnel.mid.cost],
      ['高级工程师成本', c.personnel.senior.cost],
      ['项目经理成本', c.personnel.pm.cost],
      ['培训成本', c.training],
      ['应急储备', c.contingency],
      ['硬件资源', c.resource],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    ElMessage.success('CSV 已导出')
    return
  }

  const doc = {
    title: `报价单 - ${opportunityName.value}`,
    subtitle: `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm')} | 总工时: ${e.totalHours}人天 | 总成本: ¥${formatMoney(c.totalCost)}`,
    sections: [
      {
        heading: '一、估算摘要',
        table: {
          headers: ['项目', '数值'],
          rows: [
            ['总工时', `${e.totalHours} 人天`],
            ['总成本', `¥${formatMoney(c.totalCost)}`],
            ['项目周期', `${e.totalWeeks} 周`],
            ['资源规模因子', String(e.resourceFactor)],
            ['平均复杂度', `${e.avgComplexity} / 5.0`],
            ['技术复杂度', `${e.techComplexity} / 5.0`],
          ],
        },
      },
      {
        heading: '二、阶段工时分配',
        table: {
          headers: ['阶段', '工时(人天)', '占比'],
          rows: Object.entries(phaseRatios).map(([phase, ratio]) => [
            phaseLabels[phase], String(e.phaseHours[phase]), `${(ratio * 100)}%`,
          ]),
        },
      },
      {
        heading: '三、成本明细',
        table: {
          headers: ['项目', '明细', '金额(元)'],
          rows: costRows.value.map(r => [r.item, r.detail, formatMoney(r.amount)]),
        },
      },
    ],
  }

  if (e.appAssessment.apps.length > 0) {
    doc.sections.push({
      heading: '四、应用复杂度评估',
      table: {
        headers: ['应用名称', '平均分', '等级', '修正后人天'],
        rows: e.appAssessment.apps.map(a => [a.name, String(a.avgScore), a.level, `${a.modifiedDaysLow}-${a.modifiedDaysHigh}`]),
      },
    })
  }

  if (e.migrationServices.length > 0) {
    doc.sections.push({
      heading: '五、迁移服务计费项',
      table: {
        headers: ['服务项', '数量', '单位', '人天'],
        rows: e.migrationServices.map(s => [s.name, String(s.quantity), s.unit, String(s.totalDays)]),
      },
    })
  }

  try {
    ElMessage.info(`正在导出 ${format.toUpperCase()}...`)
    await exportDocument(format, doc, fileName)
    ElMessage.success(`${format.toUpperCase()} 已导出`)
  } catch (err) {
    ElMessage.error(`导出失败: ${err.message}`)
  }
}

// 初始化
onMounted(async () => {
  loading.value = true
  try {
    try {
      const opp = await opportunityApi.get(opportunityId)
      opportunityName.value = opp.name
    } catch (e) {
      console.warn('[QuotationView] 加载商机信息失败，使用默认数据:', e)
      opportunityName.value = '未知商机'
    }
    // 加载已保存的报价
    const saved = getJSON(`aicc_quotation_${opportunityId}`)
    if (saved?.input) {
      Object.assign(input, saved.input)
    }
    // 计算估算
    recalculate()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-title { font-size: 18px; font-weight: 600; }
.form-tip { margin-left: 8px; color: #909399; font-size: 12px; }

.metric-card {
  text-align: center;
  padding: 20px;
}
.metric-label { font-size: 14px; color: #909399; margin-bottom: 8px; }
.metric-value { font-size: 24px; font-weight: bold; }
.metric-blue { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.metric-green { background: linear-gradient(135deg, #48bb78 0%, #38b2ac 100%); color: white; }
.metric-purple { background: linear-gradient(135deg, #9f7aea 0%, #ed64a6 100%); color: white; }
.metric-orange { background: linear-gradient(135deg, #f6ad55 0%, #f56565 100%); color: white; }

.phase-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.phase-label { width: 80px; font-size: 13px; color: #606266; flex-shrink: 0; }
.phase-track {
  flex: 1;
  height: 24px;
  background: #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
}
.phase-fill {
  height: 100%;
  border-radius: 12px;
  transition: width 0.5s ease;
}
.phase-value { width: 160px; font-size: 12px; color: #909399; flex-shrink: 0; text-align: right; }

.cost-total {
  margin-top: 12px;
  text-align: right;
  font-size: 16px;
  font-weight: bold;
}
.cost-total-value { color: #F56C6C; font-size: 20px; }
</style>
