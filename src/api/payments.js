import client from './client'

export async function createPayment(payload) {
  const { data } = await client.post('/pos/payments', payload)
  return data.data
}
