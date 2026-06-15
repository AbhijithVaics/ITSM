import { api } from './client'

export async function getStats() {
  return api.get('/stats')
}
