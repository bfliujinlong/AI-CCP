import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/customer/CustomerList.vue'),
      },
      {
        path: 'customers/:id',
        name: 'CustomerDetail',
        component: () => import('@/views/customer/CustomerDetail.vue'),
      },
      {
        path: 'opportunities',
        name: 'Opportunities',
        component: () => import('@/views/opportunity/OpportunityList.vue'),
      },
      {
        path: 'opportunities/:id',
        name: 'OpportunityDetail',
        component: () => import('@/views/opportunity/OpportunityDetail.vue'),
      },
      {
        path: 'factsheet/:opportunityId',
        name: 'FactSheet',
        component: () => import('@/views/factsheet/FactSheetView.vue'),
      },
      {
        path: 'quotation/:opportunityId',
        name: 'Quotation',
        component: () => import('@/views/quotation/QuotationView.vue'),
      },
      {
        path: 'sow/:opportunityId',
        name: 'SOW',
        component: () => import('@/views/sow/SowView.vue'),
      },
      {
        path: 'sow-templates',
        name: 'SowTemplates',
        component: () => import('@/views/sow/SowTemplate.vue'),
      },
      {
        path: 'wbs/:opportunityId',
        name: 'WBS',
        component: () => import('@/views/wbs/WbsView.vue'),
      },
      {
        path: 'cloud-compare',
        name: 'CloudCompare',
        component: () => import('@/views/cloud/CloudCompare.vue'),
      },
      {
        path: 'skills',
        name: 'Skills',
        component: () => import('@/views/skill/SkillList.vue'),
      },
      {
        path: 'settings',
        name: 'SystemSettings',
        component: () => import('@/views/admin/SystemSettings.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'accounts',
        name: 'AccountManagement',
        component: () => import('@/views/admin/AccountManagement.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'test',
        name: 'TestPage',
        component: () => import('@/views/test/TestPage.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/')
  } else {
    next()
  }
})

export default router
