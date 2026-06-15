import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function EmailConfig() {
  const [config, setConfig] = useState({ host: '', user: '', port: 993, pass: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/email-config').then(setConfig).catch(console.error)
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const res = await api.put('/email-config', config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="email-config">
      <div className="page-header"><h1>Email Configuration</h1></div>
      <div className="form-card" style={{ maxWidth: 500 }}>
        <form onSubmit={handleSave}>
          <div className="form-group"><label>IMAP Host</label><input value={config.host} onChange={e => setConfig({...config, host: e.target.value})} placeholder="imap.example.com" /></div>
          <div className="form-group"><label>Username</label><input value={config.user} onChange={e => setConfig({...config, user: e.target.value})} /></div>
          <div className="form-group"><label>Password</label><input type="password" value={config.pass} onChange={e => setConfig({...config, pass: e.target.value})} /></div>
          <div className="form-group"><label>Port</label><input type="number" value={config.port} onChange={e => setConfig({...config, port: Number(e.target.value)})} /></div>
          <button type="submit" className="btn-primary">Save</button>
          {saved && <span style={{ color: 'var(--success)', marginLeft: 12, fontSize: 13 }}>✓ Saved (restart to apply)</span>}
        </form>
        <p className="text-muted" style={{ marginTop: 16, fontSize: 12 }}>
          Emails to <strong>support@yourdomain.com</strong> will be parsed for ticket refs <code>INC-xxxxx</code>, <code>SR-xxxxx</code>, <code>CHG-xxxxx</code>, <code>PRB-xxxxx</code>.
          Without a ref, a new ticket is created from the email subject/body.
        </p>
      </div>
    </div>
  )
}
