import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getTicket, getTransitions, transitionTicket, assignTicket, getComments, addComment, getPendingApprovals, respondApproval } from '../api/tickets'
import { listUsers } from '../api/users'
import { createWorkOrder } from '../api/workOrders'
import { useAuth } from '../contexts/AuthContext'

export default function TicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [transitions, setTransitions] = useState([])
  const [comments, setComments] = useState([])
  const [users, setUsers] = useState([])
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState('public')
  const [approvals, setApprovals] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [showNewWo, setShowNewWo] = useState(false)
  const [woSummary, setWoSummary] = useState('')
  const [activeTab, setActiveTab] = useState('comments')
  const chatEnd = useRef(null)

  const load = useCallback(async () => {
    try {
      const [t, tc, cm, approvalsData] = await Promise.all([
        getTicket(id),
        getTransitions(id).catch(() => ({ transitions: [] })),
        getComments(id).catch(() => []),
        getPendingApprovals().catch(() => []),
      ])
      setTicket(t)
      setTransitions(tc.transitions || [])
      setComments(Array.isArray(cm) ? cm : [])
      setApprovals(approvalsData)

      const [u, audit] = await Promise.all([
        listUsers().catch(() => []),
        fetchAudit(id),
      ])
      setUsers(u)
      setAuditLog(audit)
    } catch (e) { console.error(e) }
  }, [id])

  const fetchAudit = async (ticketId) => {
    try {
      const res = await fetch(`http://localhost:4000/api/audit?ticketId=${ticketId}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('vaics_token')}` },
      })
      if (res.ok) {
        const data = await res.json()
        return data.entries || []
      }
    } catch {}
    return []
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const handleTransition = async (t) => {
    try { await transitionTicket(id, t); load() }
    catch (e) { alert(e.message) }
  }

  const handleAssign = async (userId) => {
    try { await assignTicket(id, userId); load() }
    catch (e) { alert(e.message) }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      await addComment({ ticketId: Number(id), text: newComment, type: commentType })
      setNewComment('')
      const cm = await getComments(id)
      setComments(cm)
    } catch (e) { alert(e.message) }
  }

  const handleApproval = async (approvalId, status) => {
    try { await respondApproval(approvalId, status); load() }
    catch (e) { alert(e.message) }
  }

  const handleCreateWo = async (e) => {
    e.preventDefault()
    if (!woSummary.trim()) return
    try {
      await createWorkOrder({ ticketId: Number(id), summary: woSummary })
      setWoSummary('')
      setShowNewWo(false)
      const t = await getTicket(id)
      setTicket(t)
    } catch (e) { alert(e.message) }
  }

  if (!ticket) return <div className="loading">Loading...</div>

  const isOverdue = ticket.ttrDeadline && new Date(ticket.ttrDeadline) < new Date()

  return (
    <div className="ticket-detail">
      <div className="detail-top">
        <div>
          <h1>{ticket.ref}</h1>
          <h2>{ticket.title}</h2>
        </div>
        <div className="detail-badges">
          <span className={`badge badge-${ticket.type?.toLowerCase()}`}>{ticket.type}</span>
          <span className={`badge badge-status-${ticket.status}`}>{ticket.status}</span>
          {isOverdue && <span className="badge badge-overdue">OVERDUE</span>}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <h3>Description</h3>
            <p>{ticket.description}</p>
          </section>

          {transitions.length > 0 && (
            <section className="detail-section">
              <h3>Actions</h3>
              <div className="transition-buttons">
                {transitions.map(t => (
                  <button key={t} className="btn-secondary" onClick={() => handleTransition(t)}>{t}</button>
                ))}
              </div>
            </section>
          )}

          <section className="detail-section">
            <div className="tab-bar">
              <button className={`tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Communication</button>
              <button className={`tab ${activeTab === 'workorders' ? 'active' : ''}`} onClick={() => setActiveTab('workorders')}>Work Orders ({ticket.workOrders?.length || 0})</button>
              <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Trail</button>
            </div>

            {activeTab === 'comments' && (
              <>
                <div className="comment-thread">
                  {comments.length === 0 && <p className="empty-state">No comments yet</p>}
                  {comments.map(c => (
                    <div key={c.id} className={`comment ${c.type}`}>
                      <div className="comment-header">
                        <strong>{c.author?.login}</strong>
                        <span className="comment-type-badge">{c.type}</span>
                        <time>{new Date(c.createdAt).toLocaleString()}</time>
                      </div>
                      <div className="comment-text">{c.text}</div>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form className="comment-form" onSubmit={handleAddComment}>
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." />
                  <div className="comment-form-controls">
                    <select value={commentType} onChange={e => setCommentType(e.target.value)}>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <button type="submit" className="btn-primary">Send</button>
                  </div>
                </form>
              </>
            )}

            {activeTab === 'workorders' && (
              <div className="wo-list">
                {ticket.workOrders?.length === 0 && <p className="empty-state">No work orders</p>}
                {ticket.workOrders?.map(wo => (
                  <div key={wo.id} className="wo-item">
                    <div className="wo-header">
                      <strong>{wo.summary}</strong>
                      <span className={`badge badge-status-${wo.status}`}>{wo.status}</span>
                    </div>
                    <div className="wo-meta">{wo.agent?.profile?.firstName} — {new Date(wo.createdAt).toLocaleDateString()}</div>
                    {wo.description && <p className="wo-desc">{wo.description}</p>}
                  </div>
                ))}
                {showNewWo ? (
                  <form onSubmit={handleCreateWo} className="wo-form">
                    <input value={woSummary} onChange={e => setWoSummary(e.target.value)} placeholder="Work order summary" />
                    <div className="wo-form-actions">
                      <button type="submit" className="btn-primary">Create</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowNewWo(false)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn-secondary" onClick={() => setShowNewWo(true)}>+ Add Work Order</button>
                )}
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="audit-list">
                {auditLog.length === 0 && <p className="empty-state">No audit entries</p>}
                {auditLog.map(e => (
                  <div key={e.id} className="audit-entry">
                    <div className="audit-header">
                      <strong>{e.user?.login}</strong>
                      <span className="badge">{e.action}</span>
                      <time>{new Date(e.createdAt).toLocaleString()}</time>
                    </div>
                    <div className="audit-detail">{e.field}: {e.oldValue} → {e.newValue}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="detail-sidebar">
          <div className="detail-section">
            <h3>Details</h3>
            <dl>
              <dt>Priority</dt>
              <dd>{ticket.priority || '-'}</dd>
              <dt>Impact</dt>
              <dd>{ticket.impact || '-'}</dd>
              <dt>Urgency</dt>
              <dd>{ticket.urgency || '-'}</dd>
              <dt>Created</dt>
              <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt>
              <dd>{new Date(ticket.updatedAt).toLocaleString()}</dd>
            </dl>
          </div>

          <div className="detail-section">
            <h3>Agent</h3>
            <div className="assignee-select">
              <select onChange={e => handleAssign(Number(e.target.value))} value={ticket.assignedTo?.id || ''}>
                <option value="">Unassigned</option>
                {users.filter(u => ['AGENT', 'MANAGER', 'ADMIN'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.profile?.firstName || u.login}</option>
                ))}
              </select>
            </div>
          </div>

          {ticket.ttrDeadline && (
            <div className="detail-section">
              <h3>SLA</h3>
              <div className={`sla-timer ${isOverdue ? 'overdue' : ''}`}>
                <div className="sla-label">TTR Deadline</div>
                <div className="sla-time">{new Date(ticket.ttrDeadline).toLocaleString()}</div>
                {isOverdue && <div className="sla-status">⚠ Overdue</div>}
              </div>
            </div>
          )}

          {approvals.filter(a => a.ticketId === ticket.id).map(a => (
            <div key={a.id} className="detail-section">
              <h3>Approval</h3>
              <div className={`approval-status status-${a.status}`}>
                <span>Status: {a.status}</span>
                {a.status === 'pending' && a.approverId === user.id && (
                  <div className="approval-actions">
                    <button className="btn-approve" onClick={() => handleApproval(a.id, 'approved')}>✓ Approve</button>
                    <button className="btn-reject" onClick={() => handleApproval(a.id, 'rejected')}>✗ Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {ticket.ciRelationships?.length > 0 && (
            <div className="detail-section">
              <h3>Related CIs</h3>
              <ul className="ci-list">
                {ticket.ciRelationships.map(r => (
                  <li key={r.id}>{r.ci?.name} ({r.ci?.ciType})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
