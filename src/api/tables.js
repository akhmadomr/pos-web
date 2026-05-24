import client from './client'

export async function fetchTables(outletId) {
  const params = outletId ? { outlet_id: outletId } : undefined
  const { data } = await client.get('/pos/tables', { params })
  return data.data ?? []
}
