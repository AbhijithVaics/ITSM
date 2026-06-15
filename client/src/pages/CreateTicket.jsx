import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket } from '../api/tickets'

export default function CreateTicket() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ type: 'INCIDENT', title: '', description: '', impact: 2, urgency: 3 })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const ticket = await createTicket(form)
      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="create-ticket">
      <h1>New Ticket</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="INCIDENT">Incident</option>
            <option value="SERVICE_REQUEST">Service Request</option>
            <option value="CHANGE">Change</option>
            <option value="PROBLEM">Problem</option>
          </select>
        </div>
        <div className="form-group">
          <label>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required minLength={3} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea rows={6} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Impact</label>
            <select value={form.impact} onChange={e => setForm({ ...form, impact: Number(e.target.value) })}>
              <option value={1}>Department</option>
              <option value={2}>Service</option>
              <option value={3}>Person</option>
            </select>
          </div>
          <div className="form-group">
            <label>Urgency</label>
            <select value={form.urgency} onChange={e => setForm({ ...form, urgency: Number(e.target.value) })}>
              <option value={1}>Critical</option>
              <option value={2}>High</option>
              <option value={3}>Medium</option>
              <option value={4}>Low</option>
            </select>
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn-primary">Create Ticket</button>
      </form>
    </div>
  )
}
