import http from '@/utils/http'
import { mockApi, isDevMode } from './mock'

const USE_MOCK = isDevMode()

function withMock(mockFn, realFn) {
  if (USE_MOCK) return mockFn
  return realFn
}

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  register: (data) => http.post('/auth/register', data),
  getMe: () => http.get('/auth/me'),
}

export const customerApi = {
  list: (params) => withMock(() => mockApi.customers.list(params), () => http.get('/customers', { params }))(),
  get: (id) => withMock(() => mockApi.customers.get(id), () => http.get(`/customers/${id}`))(),
  create: (data) => withMock(() => mockApi.customers.create(data), () => http.post('/customers', data))(),
  update: (id, data) => withMock(() => mockApi.customers.update(id, data), () => http.put(`/customers/${id}`, data))(),
  delete: (id) => withMock(() => mockApi.customers.delete(id), () => http.delete(`/customers/${id}`))(),
}

export const opportunityApi = {
  list: (params) => withMock(() => mockApi.opportunities.list(params), () => http.get('/opportunities', { params }))(),
  get: (id) => withMock(() => mockApi.opportunities.get(id), () => http.get(`/opportunities/${id}`))(),
  create: (data) => withMock(() => mockApi.opportunities.create(data), () => http.post('/opportunities', data))(),
  update: (id, data) => withMock(() => mockApi.opportunities.update(id, data), () => http.put(`/opportunities/${id}`, data))(),
  delete: (id) => withMock(() => mockApi.opportunities.delete(id), () => http.delete(`/opportunities/${id}`))(),
  stats: () => withMock(() => mockApi.opportunities.stats(), () => http.get('/opportunities/stats'))(),
}

export const factsheetApi = {
  list: (opportunityId, params) => withMock(() => mockApi.factsheets.list(opportunityId), () => http.get(`/fact-sheets/opportunity/${opportunityId}`, { params }))(),
  create: (data) => withMock(() => mockApi.factsheets.create(data), () => http.post('/fact-sheets', data))(),
  update: (id, data) => http.put(`/fact-sheets/${id}`, data),
  registry: (params) => withMock(() => mockApi.factsheets.registry(), () => http.get('/fact-sheets/registry', { params }))(),
}

export const skillApi = {
  // Skill 强制走后端 API（不再走 mock），由后端 registry seed 内置 skill
  list: (params) => http.get('/skills', { params }),
  get: (id) => http.get(`/skills/${id}`),
  create: (data) => http.post('/skills', data),
  update: (id, data) => http.put(`/skills/${id}`, data),
  delete: (id) => http.delete(`/skills/${id}`),
  // execute 支持传 llm_config（让后端走真实 LLM）
  execute: (data) => http.post('/skills/execute', data),
  // Skill 学习系统
  saveExecution: (data) => withMock(() => mockApi.skills.saveExecution(data), () => http.post('/skills/executions', data))(),
  getHistory: (params) => withMock(() => mockApi.skills.getHistory(params), () => http.get('/skills/executions', { params }))(),
  submitFeedback: (executionId, feedback) => withMock(() => mockApi.skills.submitFeedback(executionId, feedback), () => http.post(`/skills/executions/${executionId}/feedback`, feedback))(),
  getLearningStats: () => withMock(() => mockApi.skills.getLearningStats(), () => http.get('/skills/learning-stats'))(),
  getLearnedQuotationParams: (projectType) => withMock(() => mockApi.skills.getLearnedQuotationParams(projectType), () => http.get('/skills/learned-params', { params: { project_type: projectType } }))(),
}

export const dashboardApi = {
  stats: () => withMock(() => mockApi.dashboard.stats(), () => http.get('/dashboard/stats'))(),
}

export const llmApi = {
  test: (data) => http.post('/llm/test', data),
  chat: (data) => http.post('/llm/chat', data),
}

export const cloudPricingApi = {
  getProviders: () => withMock(() => mockApi.cloudPricing.getProviders(), () => http.get('/cloud-pricing/providers'))(),
  getEcsPrices: (region) => withMock(() => mockApi.cloudPricing.getEcsPrices(region), () => http.get('/cloud-pricing/ecs', { params: { region } }))(),
  getK8sPrices: (region) => withMock(() => mockApi.cloudPricing.getK8sPrices(region), () => http.get('/cloud-pricing/k8s', { params: { region } }))(),
  getRdsPrices: (region) => withMock(() => mockApi.cloudPricing.getRdsPrices(region), () => http.get('/cloud-pricing/rds', { params: { region } }))(),
  getOssPrices: (region) => withMock(() => mockApi.cloudPricing.getOssPrices(region), () => http.get('/cloud-pricing/oss', { params: { region } }))(),
  getNetworkPrices: (region) => withMock(() => mockApi.cloudPricing.getNetworkPrices(region), () => http.get('/cloud-pricing/network', { params: { region } }))(),
  calculateCost: (data) => withMock(() => mockApi.cloudPricing.calculateCost(data), () => http.post('/cloud-pricing/calculate', data))(),
  getStatus: () => withMock(() => mockApi.cloudPricing.getStatus(), () => http.get('/cloud-pricing/status'))(),
}

export const meetingHistoryApi = {
  record: (data) => http.post('/meeting-analysis/record', data),
  list: (params) => http.get('/meeting-analysis/history', { params }),
}

export const auditLogApi = {
  list: (params) => http.get('/audit-logs', { params }),
  stats: () => http.get('/audit-logs/stats'),
}

export const meetingApi = {
  extractText: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return http.post('/meeting-analysis/extract-text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  transcribe: (file, llmConfig) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', llmConfig.api_key)
    formData.append('base_url', llmConfig.base_url)
    formData.append('model', llmConfig.transcribe_model || 'whisper-1')
    return http.post('/meeting-analysis/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    })
  },
}

export const accountApi = {
  list: (params) => withMock(() => mockApi.accounts.list(params), () => http.get('/accounts', { params }))(),
  count: () => withMock(() => mockApi.accounts.count(), () => http.get('/accounts/count'))(),
  create: (data) => withMock(() => mockApi.accounts.create(data), () => http.post('/accounts', data))(),
  update: (id, data) => withMock(() => mockApi.accounts.update(id, data), () => http.put(`/accounts/${id}`, data))(),
  delete: (id) => withMock(() => mockApi.accounts.delete(id), () => http.delete(`/accounts/${id}`))(),
  resetPassword: (id, data) => withMock(() => mockApi.accounts.resetPassword(id, data), () => http.post(`/accounts/${id}/reset-password`, data))(),
  sendPhoneCode: (phone) => withMock(() => mockApi.accounts.sendPhoneCode(phone), () => http.post('/accounts/phone/send-code', { phone }))(),
  verifyPhoneCode: (phone, code) => withMock(() => mockApi.accounts.verifyPhoneCode(phone, code), () => http.post('/accounts/phone/verify-code', { phone, code }))(),
  getSecurityConfig: () => withMock(() => mockApi.accounts.getSecurityConfig(), () => http.get('/accounts/security-config'))(),
}
