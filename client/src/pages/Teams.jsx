import { useState, useEffect } from 'react'
import { listTeams, createTeam, addTeamMember, removeTeamMember } from '../api/teams'
import { listUsers } from '../api/users'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', type: 'SUPPORT' })

  useEffect(() => {
    listTeams().then(setTeams).catch(console.error)
    listUsers().then(setUsers).catch(console.error)
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createTeam(form)
      setShowForm(false)
      setForm({ name: '', description: '', type: 'SUPPORT' })
      setTeams(await listTeams())
    } catch (err) { alert(err.message) }
  }

  const handleAddMember = async (teamId) => {
    const userId = prompt('User ID:')
    if (!userId) return
    try {
      await addTeamMember(teamId, Number(userId))
      setTeams(await listTeams())
    } catch (err) { alert(err.message) }
  }

  const handleRemoveMember = async (teamId, userId) => {
    try {
      await removeTeamMember(teamId, userId)
      setTeams(await listTeams())
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="teams-page">
      <div className="page-header">
        <h1>Teams</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Team'}</button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="SUPPORT">Support</option>
              <option value="CHANGE_ADVISORY">Change Advisory</option>
              <option value="MANAGEMENT">Management</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="team-grid">
        {teams.map(team => (
          <div key={team.id} className="team-card">
            <h3>{team.name}</h3>
            <p className="text-muted">{team.description}</p>
            <span className="badge">{team.type}</span>
            <h4>Members</h4>
            <ul className="member-list">
              {team.members?.map(m => (
                <li key={m.id}>
                  <span>{m.user?.profile?.firstName || m.user?.login}</span>
                  <span className="member-role">{m.role}</span>
                  <button className="btn-small" onClick={() => handleRemoveMember(team.id, m.userId)}>✕</button>
                </li>
              ))}
            </ul>
            <button className="btn-secondary" onClick={() => handleAddMember(team.id)}>+ Add Member</button>
          </div>
        ))}
      </div>
    </div>
  )
}
