import client from './client'

export async function fetchOutletStocks() {
  const { data } = await client.get('/pos/outlet-stocks')
  return data
}

export async function fetchPosStockOpnames(params = {}) {
  const { data } = await client.get('/pos/stock-opnames', { params })
  return data
}

export async function submitStockOpname(payload) {
  const { data } = await client.post('/pos/stock-opnames', payload)
  return data
}
