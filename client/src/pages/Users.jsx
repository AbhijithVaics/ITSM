import { useState, useEffect, useCallback } from 'react'
import { listUsers, createUser, updateUser } from '../api/users'
import { useAuth } from '../contexts/AuthContext'

export default function Users() {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ login: '', email: '', password: '', role: 'USER', profile: {} })
  const { user } = useAuth()

  const load = useCallback(async () => {
    try { setUsers(await listUsers()) } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createUser(form)
      setShowForm(false)
      setForm({ login: '', email: '', password: '', role: 'USER', profile: {} })
      load()
    } catch (err) { alert(err.message) }
  }

  const handleToggleStatus = async (u) => {
    try {
      await updateUser(u.id, { status: u.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' })
      load()
    } catch (err) { alert(err.message) }
  }

  if (user?.role === 'MANAGER') return <div className="empty-state">User management restricted to Admins.</div>

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add User'}</button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group"><label>Login</label><input value={form.login} onChange={e => setForm({...form, login: e.target.value})} required /></div>
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="USER">User</option>
              <option value="AGENT">Agent</option>
              <option value="MANAGER">Manager</option>
              <option value="CHANGE_MANAGER">Change Manager</option>
              <option value="ADMIN">Admin</option>
              <option value="READ_ONLY">Read Only</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr><th>Login</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.login}</td>
              <td>{u.email}</td>
              <td><span className="badge">{u.role}</span></td>
              <td><span className={`badge badge-${u.status?.toLowerCase()}`}>{u.status}</span></td>
              <td><button className="btn-secondary" onClick={() => handleToggleStatus(u)}>{u.status === 'ENABLED' ? 'Disable' : 'Enable'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
