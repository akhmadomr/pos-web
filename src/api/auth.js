import client from './client'

export async function loginRequest(name, password) {
  const { data } = await client.post('/auth/login', {
    name,
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
