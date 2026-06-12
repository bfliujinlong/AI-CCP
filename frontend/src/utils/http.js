import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const DEV_MODE = import.meta.env.DEV

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (DEV_MODE && !error.response) {
      return Promise.reject(error)
    }
    const msg = error.response?.data?.detail || error.message || 'Request failed'
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
      ElMessage.error('Session expired, please login again')
    } else {
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  }
)

export default http
