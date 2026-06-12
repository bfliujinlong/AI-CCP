<template>
  <el-container class="main-layout">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo-area">
        <img v-if="branding.logo_url" :src="branding.logo_url" alt="Logo" class="custom-logo" />
        <el-icon v-else :size="28" color="#409EFF"><CloudServer /></el-icon>
        <span v-show="!isCollapsed" class="logo-text">{{ branding.system_name || 'AICC Platform' }}</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        router
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#409EFF"
        class="sidebar-menu"
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>Dashboard</template>
        </el-menu-item>
        <el-menu-item index="/customers">
          <el-icon><OfficeBuilding /></el-icon>
          <template #title>客户管理</template>
        </el-menu-item>
        <el-menu-item index="/opportunities">
          <el-icon><Opportunity /></el-icon>
          <template #title>商机管理</template>
        </el-menu-item>
        <el-sub-menu index="workflow">
          <template #title>
            <el-icon><Connection /></el-icon>
            <span>项目工作流</span>
          </template>
          <el-menu-item index="/skills">
            <el-icon><MagicStick /></el-icon>
            <template #title>AI Discovery</template>
          </el-menu-item>
          <el-menu-item index="/skills?skill=Generate-FactSheet">
            <el-icon><Document /></el-icon>
            <template #title>Fact Sheet</template>
          </el-menu-item>
          <el-menu-item index="/skills?skill=Generate-Quotation">
            <el-icon><Money /></el-icon>
            <template #title>AI 报价</template>
          </el-menu-item>
          <el-menu-item index="/skills?skill=Generate-SOW">
            <el-icon><Notebook /></el-icon>
            <template #title>SOW 生成</template>
          </el-menu-item>
          <el-menu-item index="/sow-templates">
            <el-icon><Files /></el-icon>
            <template #title>SOW 模板库</template>
          </el-menu-item>
          <el-menu-item index="/skills?skill=Generate-WBS">
            <el-icon><Grid /></el-icon>
            <template #title>WBS 生成</template>
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/cloud-compare">
          <el-icon><Cloudy /></el-icon>
          <template #title>多云对比</template>
        </el-menu-item>
        <el-sub-menu index="admin">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>管理</span>
          </template>
          <el-menu-item index="/skills">
            <el-icon><SetUp /></el-icon>
            <template #title>Skill Center</template>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Tools /></el-icon>
            <template #title>系统设置</template>
          </el-menu-item>
          <el-menu-item index="/accounts">
            <el-icon><User /></el-icon>
            <template #title>账户管理</template>
          </el-menu-item>
          <el-menu-item index="/test">
            <el-icon><Monitor /></el-icon>
            <template #title>测试页面</template>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapsed = !isCollapsed">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">Home</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" icon="UserFilled" />
              <span class="username">{{ authStore.user?.full_name || authStore.user?.username || 'User' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="settings">系统设置</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isCollapsed = ref(false)

const branding = reactive({
  system_name: 'AICC Platform',
  logo_url: '',
})

onMounted(() => {
  const saved = localStorage.getItem('aicc_branding')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(branding, data)
    } catch {}
  }
})

const activeMenu = computed(() => {
  if (route.path === '/skills' && route.query.skill) {
    return `/skills?skill=${route.query.skill}`
  }
  return route.path
})

const pageTitles = {
  '/': 'Dashboard',
  '/customers': '客户管理',
  '/opportunities': '商机管理',
  '/skills': 'Skill Center',
  '/sow-templates': 'SOW 模板库',
  '/cloud-compare': '多云对比',
  '/settings': '系统设置',
  '/accounts': '账户管理',
}

const currentPageTitle = computed(() => {
  if (route.path.includes('/customers/')) return '客户详情'
  if (route.path.includes('/opportunities/')) return '商机详情'
  if (route.path.includes('/factsheet/')) return 'Fact Sheet'
  if (route.path.includes('/quotation/')) return 'AI 报价'
  if (route.path.includes('/sow/')) return 'SOW 生成'
  if (route.path.includes('/wbs/')) return 'WBS 生成'
  return pageTitles[route.path] || ''
})

function handleCommand(command) {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  } else if (command === 'settings') {
    router.push('/settings')
  }
}

authStore.fetchUser()
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background-color: #001529;
  transition: width 0.3s;
  overflow: hidden;
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid #ffffff1a;
}

.custom-logo {
  height: 32px;
  max-width: 32px;
  object-fit: contain;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 220px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8e8e8;
  background: #fff;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #333;
}

.collapse-btn:hover {
  color: #409EFF;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #333;
}

.username {
  font-size: 14px;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
