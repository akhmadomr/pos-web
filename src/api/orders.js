import client from './client'

export async function createOrder(payload) {
  const { data } = await client.post('/pos/orders', payload)
  return data.data
}

export async function fetchOrders(params) {
  const { data } = await client.get('/pos/orders', { params })
  return data
}

export async function fetchOrder(id) {
  const { data } = await client.get(`/pos/orders/${id}`)
  return data.data
}

export async function updateOrderStatus(id, status) {
  const { data } = await client.patch(`/pos/orders/${id}/status`, { status })
  return data.data
}

export async function cancelOrder(id) {
  const { data } = await client.post(`/pos/orders/${id}/cancel`)
  return data.data
}

export async function requestEditOrder(id, payload) {
  const { data } = await client.post(`/pos/orders/${id}/request-edit`, payload)
  return data
}

export async function requestCancelOrder(id, reason) {
  const { data } = await client.post(`/pos/orders/${id}/request-cancel`, { reason })
  return data
}
