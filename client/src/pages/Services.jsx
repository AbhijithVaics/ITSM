import { useState, useEffect } from 'react'
import { listServices, createService } from '../api/services'

export default function Services() {
  const [services, setServices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  useEffect(() => {
    listServices().then(setServices).catch(console.error)
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createService(form)
      setShowForm(false)
      setForm({ name: '', description: '' })
      setServices(await listServices())
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="services-page">
      <div className="page-header">
        <h1>Service Catalog</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add Service'}</button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
          <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <div className="service-grid">
        {services.map(s => (
          <div key={s.id} className="service-card">
            <h3>{s.name}</h3>
            <p className="text-muted">{s.description}</p>
            {s.subcategories?.length > 0 && (
              <>
                <h4>Subcategories</h4>
                <ul>{s.subcategories.map(sub => <li key={sub.id}>{sub.name}</li>)}</ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
