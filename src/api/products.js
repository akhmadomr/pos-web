import client from './client'

export async function fetchPosProducts(outletId) {
  const params = outletId ? { outlet_id: outletId } : undefined
  const { data } = await client.get('/pos/products', { params })
  return data.data ?? []
}
