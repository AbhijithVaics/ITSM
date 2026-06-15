import { api } from './client'

export async function listCIs(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get(`/ci${qs ? `?${qs}` : ''}`)
}

export async function getCI(id) {
  return api.get(`/ci/${id}`)
}

export async function createCI(data) {
  return api.post('/ci', data)
}

export async function getCIImpact(id) {
  return api.get(`/ci/${id}/impact`)
}
