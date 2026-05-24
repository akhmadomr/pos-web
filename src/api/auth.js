import client from './client'

export async function loginRequest(email, password) {
  const { data } = await client.post('/auth/login', {
    email,
    password,
    device_name: 'kopirex-pos',
  })
  return data.data
}

export async function logoutRequest() {
  const { data } = await client.post('/auth/logout')
  return data
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me')
  return data.data
}
