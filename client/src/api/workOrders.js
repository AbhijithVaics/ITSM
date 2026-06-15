import { api } from './client'

export async function createWorkOrder(data) {
  return api.post('/work-orders', data)
}
