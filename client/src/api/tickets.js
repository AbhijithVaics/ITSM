import { api } from './client'

export async function listTickets(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get(`/tickets${qs ? `?${qs}` : ''}`)
}

export async function getTicket(id) {
  return api.get(`/tickets/${id}`)
}

export async function createTicket(data) {
  return api.post('/tickets', data)
}

export async function updateTicket(id, data) {
  return api.patch(`/tickets/${id}`, data)
}

export async function transitionTicket(id, transition) {
  return api.patch(`/tickets/${id}/transition`, { transition })
}

export async function getTransitions(id) {
  return api.get(`/tickets/${id}/transitions`)
}

export async function assignTicket(id, assignedToId) {
  return api.patch(`/tickets/${id}/assign`, { assignedToId })
}

export async function getComments(ticketId) {
  return api.get(`/comments/${ticketId}`)
}

export async function addComment(data) {
  return api.post('/comments', data)
}

export async function getPendingApprovals() {
  return api.get('/approvals/pending')
}

export async function respondApproval(id, status, comment = '') {
  return api.patch(`/approvals/${id}/respond`, { status, comment })
}
