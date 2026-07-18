import axios from 'axios'

const IS_DEV = import.meta.env.DEV || import.meta.env.MODE === 'development'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (IS_DEV ? 'http://127.0.0.1:3001/api' : '/api')

const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
})

const getAuthHeader = () => {
  const token = localStorage.getItem('merchant_token') || ''
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export const uploadMerchantImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await uploadClient.post('/upload', formData, {
    headers: {
      Authorization: getAuthHeader()
    }
  })

  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || '上传失败')
  }

  return response.data.data.url
}
