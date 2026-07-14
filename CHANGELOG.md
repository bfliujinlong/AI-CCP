# CHANGELOG

## [v0.3] - 2026-07-14

### 新增
- **启动脚本 v2.0** (`start-all.bat`): 菜单式交互，支持本地版/前端+远程后端/仅前端/仅后端/停止/状态/云端 7 种模式
  - 端口检测复用，避免重复启动
  - 一键停止 8000/5173 端口进程
  - `start /B` 启动，关闭启动器窗口不影响服务

### 修复
- **AI 报价页输入框空白无响应** (`QuotationView.vue`)
  - 根因 1: `Object.assign(input, saved.input)` 浅复制，整体替换 `input.resources` 子对象，Vue 响应式丢失
  - 根因 2: localStorage 旧版保存数据字段为 null/undefined 或缺失，导致 `el-input-number` 显示空白
  - 修复: 新增 `mergeInput()` 深度合并函数（跳过 null/undefined/NaN），新增 `ensureResourceDefaults()` 强制填充默认值
- **WBS 导出失败** (`WbsView.vue`)
  - `XLSX.writeFile` 改为 `write + Blob + saveAs`（浏览器兼容性更好）
  - `exportAll` 真正实现导出 Excel + Word + JSON 三种格式
- **系统设置单价配置表格无法填写** (`SystemSettings.vue`)
  - `:data="array.filter(...)"` 改为 `computed enabledClouds`，避免 v-model 写入临时数组
- **登录报错** (云端部署)
  - nginx `proxy_pass 127.0.0.1:8000` → `backend:8000`（Docker 容器间通信）
  - `isDevMode()` 从硬编码 `return true` 改为 `import.meta.env.DEV`（生产用真实 API）
- **后端构建问题**
  - `models.py` `JSONType` → `JSONB`（SQLAlchemy 兼容）
  - Dockerfile 添加阿里云 Debian 镜像源加速
  - `wbsTemplates.js` 添加 `getProjectTypeName` 导出
  - 跳过 Alembic 迁移，使用 `AUTO_CREATE_TABLES=true`

### 优化
- `http.js`: 5xx 错误不再弹错（避免误报阻塞 v-loading）
- `QuotationView.vue`: 加 5s 兜底超时关闭 v-loading
- 后端 `_require_admin` 真正查询数据库检查 `role=admin`（之前只验证 token）

## [v0.2.1-dev] - 2026-07-10

### 修复
- WBS 导出 Excel 失败（writeFile → write+Blob+saveAs）
- WBS `exportAll` 占位"开发中"→ 真正实现导出全部
- 系统设置单价表格 v-model 失效（.filter() → computed）
- QuotationView 加 5s 兜底超时关闭 v-loading
- http.js 5xx 错误不再弹错

## [v0.2-dev] - 2026-07-10

### 新增
- **RBAC 账户管理**
  - 后端 `_require_admin` 查询数据库验证角色
  - 前端路由守卫 `meta.requiresAdmin` 限制 /settings /accounts
  - 侧边栏管理菜单 `v-if="authStore.isAdmin"` 按角色显示
  - `AccountManagement.vue` 创建/编辑/重置密码/禁用用户

### 部署
- 阿里云 ECS 8.153.152.218 (Ubuntu 24.04 + Docker 29.6.1)
- 5 容器: postgres / redis / minio / backend / frontend
- 测试账户: admin / admin123, consultant1 / test123456

## [v0.1] - 2026-06-20

### 初始版本
- Vue3 + Element Plus + Pinia 前端
- FastAPI + SQLAlchemy (async) + Alembic 后端
- PostgreSQL 16 + Redis 7 + MinIO
- AI 链路: Skill → Prompt → LLM → Structured Output
- Fact Sheet First 架构
- 三层架构: Controller / Service / Repository
- RBAC 权限控制
