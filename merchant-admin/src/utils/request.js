import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const IS_DEV = import.meta.env.DEV || import.meta.env.MODE === 'development'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (IS_DEV ? 'http://127.0.0.1:3001/api' : '/api'),
  timeout: 10000
})

const withQueryParams = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') {
    return config
  }

  if (config.params && Object.keys(config.params).length > 0) {
    config.params = {
      ...config.params
    }
  }

  return config
}

request.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return withQueryParams(config)
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code === 0) {
      return res.data
    }

    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || '请求失败'))
  },
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
