import { api } from './client'

export async function listTeams() {
  return api.get('/teams')
}

export async function createTeam(data) {
  return api.post('/teams', data)
}

export async function addTeamMember(teamId, userId, role = 'member') {
  return api.post(`/teams/${teamId}/members`, { userId, role })
}

export async function removeTeamMember(teamId, userId) {
  return api.delete(`/teams/${teamId}/members/${userId}`)
}
