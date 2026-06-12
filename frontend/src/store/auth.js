import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

const DEV_MODE = true

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

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
      localStorage.setItem('token', token.value)
      localStorage.setItem('user', JSON.stringify(user.value))
      return
    }
    const res = await authApi.login({ username, password })
    token.value = res.access_token
    localStorage.setItem('token', res.access_token)
    await fetchUser()
  }

  async function fetchUser() {
    if (DEV_MODE && token.value === 'dev-mock-token') {
      return
    }
    try {
      user.value = await authApi.getMe()
    } catch {
      logout()
    }
  }

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { token, user, isAuthenticated, isAdmin, login, fetchUser, logout, setToken }
})
