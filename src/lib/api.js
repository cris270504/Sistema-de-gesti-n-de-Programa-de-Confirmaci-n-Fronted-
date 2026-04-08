import axios from 'axios';
import router from '@/router';
import { LS_TOKEN_KEY,LS_USER_KEY } from '@/constants/auth';

//'https://sistemaconfirmacionapi.test/api'
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 
      'Accept': 'application/json',
      'Content-Type': 'application/json'
  },
});

api.interceptors.request.use((config) => {  
  const token = localStorage.getItem(LS_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status
    if (status === 401) {
      localStorage.removeItem(LS_TOKEN_KEY)
      localStorage.removeItem(LS_USER_KEY)
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
      }
    }
    return Promise.reject(error)
  }
)

export default api;
