import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPermissionsList } from '@/services/permissions'

export const usePermissionsStore = defineStore('permissions', () => {
  const items = ref([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      items.value = await getPermissionsList()
    } catch (error) {
      console.error("Error al obtener permisos:", error)
    } finally {
      loading.value = false
    }
  }

  return { items, loading, fetchAll }
})