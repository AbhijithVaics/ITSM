import { api } from './client'

export async function listNotifications() {
  return api.get('/notifications')
}

export async function getUnreadCount() {
  return api.get('/notifications/unread-count')
}

export async function markRead(id) {
  return api.patch(`/notifications/${id}/read`)
}

export async function markAllRead() {
  return api.patch('/notifications/read-all')
}
