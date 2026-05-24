import client from './client'

export async function findCustomerByPhone(phone) {
  const { data } = await client.get('/pos/customers/find', {
    params: { phone },
  })
  return data.data
}
