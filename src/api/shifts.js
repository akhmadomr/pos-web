throw new Error('SHIFTS FILE LOADED')
import client from './client'

export async function fetchCurrentShift(outletId) {
  console.log(client.defaults.baseURL)
  const params = outletId ? { outlet_id: outletId } : undefined
  const { data } = await client.get('/pos/shifts/current', { params })
  return data.data
}

export async function openShift(payload) {
  const { data } = await client.post('/pos/shifts/open', payload)
  return data.data
}

export async function fetchShiftSummary(outletId) {
  const params = outletId ? { outlet_id: outletId } : undefined
  const { data } = await client.get('/pos/shifts/summary', { params })
  return data.data
}

export async function closeShift(payload) {
  const { data } = await client.post('/pos/shifts/close', payload)
  return data
}
