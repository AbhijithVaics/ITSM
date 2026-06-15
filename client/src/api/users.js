import { api } from './client'

export async function listUsers() {
  return api.get('/users')
}

export async function createUser(data) {
  return api.post('/users', data)
}

export async function updateUser(id, data) {
  return api.patch(`/users/${id}`, data)
}
