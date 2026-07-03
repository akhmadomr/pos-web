import client from './client'

export async function fetchSettings() {
  const { data } = await client.get('/pos/settings')
  return data.data
}
