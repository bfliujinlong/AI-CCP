import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { getItem, removeItem } from '@/utils/db'

const DEV_MODE = import.meta.env.DEV

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

http.interceptors.request.use(
  (config) => {
    const token = getItem('token')
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
    // 静默错误：5xx 时不弹出消息（避免覆盖 v-loading 关闭）
    const status = error.response?.status
    const msg = error.response?.data?.detail || error.message || 'Request failed'
    if (status === 401) {
      removeItem('token')
      removeItem('user')
      router.push('/login')
      ElMessage.error('Session expired, please login again')
    } else if (status && status >= 400 && status < 500) {
      // 4xx 业务错误显示
      ElMessage.error(msg)
    }
    // 5xx 错误不弹错（避免误报），由调用方处理
    return Promise.reject(error)
  }
)

export default http
