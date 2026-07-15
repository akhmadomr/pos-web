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

export async function fetchShiftHistory(params) {
  const { data } = await client.get('/pos/shifts/history', { params })
  return data
}

export async function fetchShiftAnalytics(shiftId) {
  const { data } = await client.get(`/pos/shifts/${shiftId}/analytics`)
  return data.data
}

export async function fetchExpenseCategories() {
  const { data } = await client.get('/pos/shifts/expense-categories')
  return data.data
}
