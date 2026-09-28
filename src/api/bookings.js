import client from './client'

export async function fetchBookings(params) {
  const { data } = await client.get('/pos/bookings', { params })
  return data
}

export async function fetchBooking(id) {
  const { data } = await client.get(`/pos/bookings/${id}`)
  return data.data
}

export async function createBooking(payload) {
  const { data } = await client.post('/pos/bookings', payload)
  return data.data
}

export async function addBookingPayment(id, payload) {
  const { data } = await client.post(`/pos/bookings/${id}/payments`, payload)
  return data.data
}

export async function checkBookingStock(id) {
  const { data } = await client.get(`/pos/bookings/${id}/check-stock`)
  return data.data
}

export async function executeBooking(id) {
  const { data } = await client.post(`/pos/bookings/${id}/execute`)
  return data.data
}

export async function cancelBooking(id, payload) {
  const { data } = await client.post(`/pos/bookings/${id}/cancel`, payload)
  return data.data
}
