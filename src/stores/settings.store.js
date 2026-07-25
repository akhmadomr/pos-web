import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchSettings } from '@/api/settings'

export const useSettingsStore = defineStore('settings', () => {
  const raw = ref([])
  
  const tax = ref({ enabled: '0', rate: 11 })
  const receipt = ref({
    layout: null,
  })
  const shift = ref({
    continue_cash: '0'
  })

  const load = async () => {
    // 1. Load dari localStorage terlebih dahulu (offline support)
    const cached = localStorage.getItem('pos_settings')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        applySettings(parsed)
      } catch (e) {
        console.error('Failed to parse cached settings', e)
      }
    }

    // 2. Fetch dari network
    try {
      const data = await fetchSettings()
      localStorage.setItem('pos_settings', JSON.stringify(data))
      applySettings(data)
    } catch (error) {
      console.warn('Failed to load settings from network (offline mode active):', error)
    }
  }

  const applySettings = (data) => {
    raw.value = data
    data.forEach(s => {
      if (s.group === 'tax') {
        if (s.key === 'enabled') tax.value.enabled = String(s.value)
        if (s.key === 'rate') tax.value.rate = Number(s.value)
      }
      if (s.group === 'receipt') {
        receipt.value[s.key] = s.value
      }
      if (s.group === 'shift') {
        shift.value[s.key] = s.value
      }
    })
  }

  return {
    raw,
    tax,
    receipt,
    shift,
    load,
  }
})
