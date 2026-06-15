import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [filterTicketId, setFilterTicketId] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const params = { limit, offset: page * limit }
      if (filterTicketId) params.ticketId = filterTicketId
      const qs = new URLSearchParams(params).toString()
      const data = await api.get(`/audit?${qs}`)
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
  }, [filterTicketId, page])

  useEffect(() => { load() }, [load])

  return (
    <div className="audit-page">
      <div className="page-header">
        <h1>Audit Trail</h1>
        <div className="header-controls">
          <input className="search-input" placeholder="Filter by Ticket ID" value={filterTicketId} onChange={e => { setFilterTicketId(e.target.value); setPage(0) }} />
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Time</th><th>User</th><th>Action</th><th>Field</th><th>Old Value</th><th>New Value</th><th>Ticket</th></tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="clickable" onClick={() => navigate(`/tickets/${e.ticketId}`)}>
              <td>{new Date(e.createdAt).toLocaleString()}</td>
              <td>{e.user?.login}</td>
              <td><span className="badge">{e.action}</span></td>
              <td>{e.field}</td>
              <td className="text-muted">{e.oldValue}</td>
              <td className="text-muted">{e.newValue}</td>
              <td>{e.ticketId}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && <div className="empty-state">No audit entries found.</div>}

      {total > limit && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary">Prev</button>
          <span className="page-info">{page + 1} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit) - 1} onClick={() => setPage(p => p + 1)} className="btn-secondary">Next</button>
        </div>
      )}
    </div>
  )
}
