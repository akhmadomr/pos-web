import client from './client'

export async function checkVoucher(code, subtotal) {
  const { data } = await client.get(`/pos/vouchers/check/${encodeURIComponent(code)}`, {
    params: { subtotal },
  })
  return data.data
}
