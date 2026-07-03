import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchSettings } from '@/api/settings'

export const useSettingsStore = defineStore('settings', () => {
  const raw = ref([])
  
  const tax = ref({ enabled: '0', rate: 11 })
  const receipt = ref({
    layout: null,
  })

  const load = async () => {
    try {
      const data = await fetchSettings()
      raw.value = data
      
      data.forEach(s => {
        if (s.group === 'tax') {
          if (s.key === 'enabled') tax.value.enabled = String(s.value)
          if (s.key === 'rate') tax.value.rate = Number(s.value)
        }
        if (s.group === 'receipt') {
          receipt.value[s.key] = s.value
        }
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  return {
    raw,
    tax,
    receipt,
    load,
  }
})
