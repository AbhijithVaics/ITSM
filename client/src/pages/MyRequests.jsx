import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTickets, getComments } from '../api/tickets'
import { useAuth } from '../contexts/AuthContext'

export default function MyRequests() {
  const [tickets, setTickets] = useState([])
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    listTickets({ limit: 50 }).then(d => setTickets(d.tickets)).catch(console.error)
  }, [])

  const myTickets = tickets.filter(t => t.createdById === user.id)

  return (
    <div className="my-requests">
      <div className="page-header">
        <h1>My Requests</h1>
        <button className="btn-primary" onClick={() => navigate('/create-ticket')}>New Request</button>
      </div>

      {myTickets.length === 0 && <div className="empty-state">No requests yet.</div>}

      <div className="request-list">
        {myTickets.map(ticket => (
          <TicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/tickets/${ticket.id}`)} />
        ))}
      </div>
    </div>
  )
}

function TicketRow({ ticket, onClick }) {
  return (
    <div className="request-card" onClick={onClick}>
      <div className="request-header">
        <span className="ticket-ref">{ticket.ref}</span>
        <span className={`badge badge-status-${ticket.status}`}>{ticket.status}</span>
      </div>
      <div className="request-title">{ticket.title}</div>
      <div className="request-meta">
        <span>{ticket.type}</span>
        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
