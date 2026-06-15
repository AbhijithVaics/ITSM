import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTickets } from '../api/tickets'
import { getStats } from '../api/stats'
import { useAuth } from '../contexts/AuthContext'

const COLUMNS = [
  { key: 'new', label: 'New' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
]

const PRIORITY_COLORS = { 1: '#ff4444', 2: '#ff8800', 3: '#ffdd00', 4: '#88cc88' }

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()
  const { user } = useAuth()
  const limit = 100

  const load = useCallback(async () => {
    try {
      const params = { limit, offset: page * limit }
      if (filterType) params.type = filterType
      if (search) params.search = search
      const [data, statsData] = await Promise.all([listTickets(params), getStats()])
      setTickets(data.tickets)
      setTotal(data.total)
      setStats(statsData)
    } catch (e) { console.error(e) }
  }, [filterType, search, page])

  useEffect(() => { load() }, [load])

  const grouped = COLUMNS.map(col => ({
    ...col,
    items: tickets.filter(t => t.status === col.key),
  }))

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-controls">
          <input placeholder="Search tickets..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="search-input" />
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }}>
            <option value="">All Types</option>
            <option value="INCIDENT">Incidents</option>
            <option value="SERVICE_REQUEST">Service Requests</option>
            <option value="CHANGE">Changes</option>
            <option value="PROBLEM">Problems</option>
          </select>
          <button className="btn-primary" onClick={() => navigate('/create-ticket')}>New Ticket</button>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Tickets</div></div>
          <div className="stat-card"><div className="stat-value">{stats.openTickets}</div><div className="stat-label">Open</div></div>
          <div className="stat-card overdue"><div className="stat-value">{stats.overdue}</div><div className="stat-label">Overdue</div></div>
          <div className="stat-card"><div className="stat-value">{stats.slaCount}</div><div className="stat-label">SLAs</div></div>
          {Object.entries(stats.byType || {}).map(([t, c]) => (
            <div key={t} className="stat-card"><div className="stat-value">{c}</div><div className="stat-label">{t.replace('_', ' ')}</div></div>
          ))}
        </div>
      )}

      <div className="kanban-board">
        {grouped.map(col => (
          <div key={col.key} className="kanban-column">
            <div className="kanban-header">
              <span>{col.label}</span>
              <span className="count">{col.items.length}</span>
            </div>
            <div className="kanban-items">
              {col.items.map(ticket => (
                <div key={ticket.id} className="ticket-card" onClick={() => navigate(`/tickets/${ticket.id}`)}
                  style={{ borderLeftColor: PRIORITY_COLORS[ticket.priority] || '#666' }}>
                  <div className="ticket-ref">{ticket.ref}</div>
                  <div className="ticket-title">{ticket.title}</div>
                  <div className="ticket-meta">
                    <span className={`badge badge-${ticket.type?.toLowerCase()}`}>{ticket.type}</span>
                    {ticket.assignedTo && <span className="assignee">{ticket.assignedTo.profile?.firstName}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary">Prev</button>
          <span className="page-info">{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="btn-secondary">Next</button>
        </div>
      )}
    </div>
  )
}
