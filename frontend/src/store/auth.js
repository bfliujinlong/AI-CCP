import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import { getItem, setItem, removeItem, getJSON, setJSON } from '@/utils/db'

const DEV_MODE = false  // 后端已真实运行，关闭 mock 登录，使用真实 JWT token

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getItem('token') || '')
  const user = ref(getJSON('user', null))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(username, password) {
    if (DEV_MODE) {
      token.value = 'dev-mock-token'
      user.value = {
        id: '00000000-0000-0000-0000-000000000001',
        username: username,
        email: username + '@aicc.com',
        full_name: username === 'admin' ? 'System Admin' : username,
        role: username === 'admin' ? 'admin' : 'consultant',
        is_active: true,
      }
      setItem('token', token.value)
      setJSON('user', user.value)
      return
    }
    const res = await authApi.login({ username, password })
    token.value = res.access_token
    setItem('token', res.access_token)
    await fetchUser()
  }

  async function fetchUser() {
    if (DEV_MODE && token.value === 'dev-mock-token') {
      return
    }
    try {
      user.value = await authApi.getMe()
      setJSON('user', user.value)
    } catch {
      logout()
    }
  }

  function setToken(newToken) {
    token.value = newToken
    setItem('token', newToken)
  }

  function logout() {
    token.value = ''
    user.value = null
    removeItem('token')
    removeItem('user')
  }

  return { token, user, isAuthenticated, isAdmin, login, fetchUser, logout, setToken }
})
