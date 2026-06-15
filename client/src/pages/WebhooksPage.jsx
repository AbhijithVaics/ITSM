import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export default function WebhooksPage() {
  const [hooks, setHooks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', events: [], secret: '', enabled: true })

  const load = useCallback(async () => {
    try { setHooks(await api.get('/webhooks')) }
    catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/webhooks', form)
      setShowForm(false)
      setForm({ name: '', url: '', events: [], secret: '', enabled: true })
      load()
    } catch (err) { alert(err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this webhook?')) return
    try { await api.delete(`/webhooks/${id}`); load() }
    catch (err) { alert(err.message) }
  }

  const handleToggle = async (hook) => {
    try {
      await api.patch(`/webhooks/${hook.id}`, { enabled: !hook.enabled })
      load()
    } catch (err) { alert(err.message) }
  }

  const availableEvents = ['ticket.created', 'ticket.updated', 'ticket.assigned', 'ticket.resolved', 'ticket.closed', 'approval.responded', 'comment.added']

  const toggleEvent = (event) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }))
  }

  return (
    <div className="webhooks-page">
      <div className="page-header">
        <h1>Webhooks</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add Webhook'}</button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label>URL</label><input value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://hooks.example.com/vaics" required /></div>
          <div className="form-group"><label>Secret (optional)</label><input value={form.secret} onChange={e => setForm({...form, secret: e.target.value})} /></div>
          <div className="form-group">
            <label>Events</label>
            <div className="event-grid">
              {availableEvents.map(ev => (
                <label key={ev} className="event-checkbox">
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                  <span>{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="hook-list">
        {hooks.map(hook => (
          <div key={hook.id} className="service-card">
            <div className="wo-header">
              <strong>{hook.name}</strong>
              <div className="header-controls">
                <span className={`badge ${hook.enabled ? 'badge-enabled' : 'badge-disabled'}`}>{hook.enabled ? 'Active' : 'Disabled'}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleToggle(hook)}>Toggle</button>
                <button className="btn-small" onClick={() => handleDelete(hook.id)}>✕</button>
              </div>
            </div>
            <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hook.url}</code>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {hook.events?.map(e => <span key={e} className="badge">{e}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
