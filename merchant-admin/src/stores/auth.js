import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('merchant_token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('merchant_info') || '{}'))

  const setToken = (newToken) => {
    token.value = newToken
    localStorage.setItem('merchant_token', newToken)
  }

  const setUserInfo = (info) => {
    userInfo.value = info
    localStorage.setItem('merchant_info', JSON.stringify(info))
  }

  const logout = () => {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('merchant_token')
    localStorage.removeItem('merchant_info')
  }

  return {
    token,
    userInfo,
    setToken,
    setUserInfo,
    logout
  }
})
