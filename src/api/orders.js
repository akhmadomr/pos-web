import client from './client'

export async function createOrder(payload) {
  const { data } = await client.post('/pos/orders', payload)
  return data.data
}
