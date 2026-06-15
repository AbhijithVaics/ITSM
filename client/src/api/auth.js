import { api } from './client'

export async function login(login, password) {
  const data = await api.post('/auth/login', { login, password })
  localStorage.setItem('vaics_token', data.token)
  localStorage.setItem('vaics_user', JSON.stringify(data.user))
  return data.user
}

export async function getMe() {
  return api.get('/auth/me')
}

export function logout() {
  localStorage.removeItem('vaics_token')
  localStorage.removeItem('vaics_user')
}
