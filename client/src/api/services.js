import { api } from './client'

export async function listServices() {
  return api.get('/services')
}

export async function getService(id) {
  return api.get(`/services/${id}`)
}

export async function createService(data) {
  return api.post('/services', data)
}
