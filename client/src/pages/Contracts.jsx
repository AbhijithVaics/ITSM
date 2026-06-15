import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [services, setServices] = useState([])
  const [slas, setSlas] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' })

  const load = useCallback(async () => {
    try {
      const [c, sv, sl] = await Promise.all([
        api.get('/contracts'),
        api.get('/services'),
        api.get('/slas'),
      ])
      setContracts(c)
      setServices(sv)
      setSlas(sl)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/contracts', form)
      setShowForm(false)
      setForm({ name: '', description: '', startDate: '', endDate: '' })
      load()
    } catch (err) { alert(err.message) }
  }

  const handleLinkService = async (contractId) => {
    const serviceId = prompt('Service ID:')
    const slaId = prompt('SLA ID:')
    if (!serviceId || !slaId) return
    try {
      await api.post(`/contracts/${contractId}/link-service`, { serviceId: Number(serviceId), slaId: Number(slaId) })
      load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="contracts-page">
      <div className="page-header">
        <h1>Customer Contracts</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'New Contract'}</button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div className="form-row">
            <div className="form-group"><label>Start Date</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required /></div>
            <div className="form-group"><label>End Date</label><input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
          </div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="contract-grid">
        {contracts.map(c => (
          <div key={c.id} className="service-card">
            <h3>{c.name}</h3>
            <p className="text-muted">{c.description}</p>
            <div className="contract-dates">
              <span>{new Date(c.startDate).toLocaleDateString()}</span>
              {c.endDate && <span> — {new Date(c.endDate).toLocaleDateString()}</span>}
            </div>
            {c.serviceLinks?.length > 0 && (
              <>
                <h4>Service Links</h4>
                <ul>{c.serviceLinks.map(l => <li key={l.id}>{l.service?.name} → {l.sla?.name}</li>)}</ul>
              </>
            )}
            <button className="btn-secondary" style={{ marginTop: 12 }} onClick={() => handleLinkService(c.id)}>+ Link Service/SLA</button>
          </div>
        ))}
      </div>
    </div>
  )
}
