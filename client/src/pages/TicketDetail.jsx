import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Row, Col, Descriptions, Tabs, Tag, Select, Button, Input, List, Typography, Space, Timeline, Modal, Badge, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons'
import { getTicket, getTransitions, transitionTicket, assignTicket, getComments, addComment, getPendingApprovals, respondApproval } from '../api/tickets'
import { listUsers } from '../api/users'
import { createWorkOrder } from '../api/workOrders'
import { useAuth } from '../contexts/AuthContext'

const PRIORITY_LABELS = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
const PRIORITY_COLORS = { 1: '#ff4757', 2: '#ffa502', 3: '#ffdd00', 4: '#2ed573' }
const TYPE_COLORS = { INCIDENT: '#ff4757', SERVICE_REQUEST: '#4f8cff', CHANGE: '#ffa502', PROBLEM: '#be5aff' }

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
      if (res.ok) return (await res.json()).entries || []
    } catch {}
    return []
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const handleTransition = async (t) => {
    try { await transitionTicket(id, t); load(); message.success(`Transitioned to ${t}`) }
    catch (e) { message.error(e.message) }
  }

  const handleAssign = async (userId) => {
    try { await assignTicket(id, userId); load(); message.success('Assigned') }
    catch (e) { message.error(e.message) }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    try {
      await addComment({ ticketId: Number(id), text: newComment, type: commentType })
      setNewComment('')
      setComments(await getComments(id))
    } catch (e) { message.error(e.message) }
  }

  const handleApproval = async (approvalId, status) => {
    try { await respondApproval(approvalId, status); load(); message.success(`Approval ${status}`) }
    catch (e) { message.error(e.message) }
  }

  const handleCreateWo = async () => {
    if (!woSummary.trim()) return
    try {
      await createWorkOrder({ ticketId: Number(id), summary: woSummary })
      setWoSummary(''); setShowNewWo(false)
      setTicket(await getTicket(id))
      message.success('Work order created')
    } catch (e) { message.error(e.message) }
  }

  if (!ticket) return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.45)' }}>Loading...</div>

  const isOverdue = ticket.ttrDeadline && new Date(ticket.ttrDeadline) < new Date()
  const ticketApprovals = approvals.filter(a => a.ticketId === ticket.id)

  return (
    <div>
      <Row justify="space-between" align="top" style={{ marginBottom: 24 }}>
        <Col>
          <Typography.Text style={{ color: '#4f8cff', fontWeight: 700, fontSize: 16, display: 'block' }}>{ticket.ref}</Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>{ticket.title}</Typography.Title>
        </Col>
        <Col>
          <Space>
            <Tag color={TYPE_COLORS[ticket.type]}>{ticket.type}</Tag>
            <Tag>{ticket.status}</Tag>
            {isOverdue && <Tag color="red">OVERDUE</Tag>}
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Description</Typography.Text>
            <Typography.Paragraph>{ticket.description}</Typography.Paragraph>
          </Card>

          {transitions.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Actions</Typography.Text>
              <Space wrap>
                {transitions.map(t => <Button key={t} size="small" onClick={() => handleTransition(t)}>{t}</Button>)}
              </Space>
            </Card>
          )}

          <Card>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                { key: 'comments', label: `Communication (${comments.length})`, children: (
                  <div>
                    <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {comments.length === 0 ? <Typography.Text type="secondary" style={{ textAlign: 'center', padding: 20 }}>No comments yet</Typography.Text> : comments.map(c => (
                        <div key={c.id} style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: c.type === 'private' ? '1px solid rgba(255,165,2,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                          <Space style={{ marginBottom: 4 }}>
                            <Typography.Text strong style={{ fontSize: 12 }}>{c.author?.login}</Typography.Text>
                            <Tag style={{ fontSize: 9, lineHeight: '16px' }}>{c.type}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.createdAt).toLocaleString()}</Typography.Text>
                          </Space>
                          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                        </div>
                      ))}
                      <div ref={chatEnd} />
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Select value={commentType} onChange={setCommentType} style={{ width: 100 }}>
                        <Select.Option value="public">Public</Select.Option>
                        <Select.Option value="private">Private</Select.Option>
                      </Select>
                      <Input.TextArea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." rows={2} />
                      <Button type="primary" icon={<SendOutlined />} onClick={handleAddComment}>Send</Button>
                    </Space.Compact>
                  </div>
                )},
                { key: 'workorders', label: `Work Orders (${ticket.workOrders?.length || 0})`, children: (
                  <List
                    size="small"
                    dataSource={ticket.workOrders || []}
                    locale={{ emptyText: 'No work orders' }}
                    renderItem={wo => (
                      <List.Item>
                        <List.Item.Meta
                          title={<Space>{wo.summary} <Tag>{wo.status}</Tag></Space>}
                          description={<>{wo.agent?.profile?.firstName} — {new Date(wo.createdAt).toLocaleDateString()}{wo.description && <><br/>{wo.description}</>}</>}
                        />
                      </List.Item>
                    )}
                  />
                )},
                { key: 'audit', label: 'Audit Trail', children: (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {auditLog.length === 0 ? <Typography.Text type="secondary" style={{ textAlign: 'center', padding: 20, display: 'block' }}>No audit entries</Typography.Text> : (
                      <Timeline items={auditLog.map(e => ({ children: <><strong>{e.user?.login}</strong> <Tag>{e.action}</Tag> <Typography.Text type="secondary">{new Date(e.createdAt).toLocaleString()}</Typography.Text><div style={{ fontSize: 12, fontFamily: 'monospace' }}>{e.field}: {e.oldValue} → {e.newValue}</div></> }))} />
                    )}
                  </div>
                )},
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Descriptions column={1} size="small" title="Details">
              <Descriptions.Item label="Priority"><Tag color={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</Tag></Descriptions.Item>
              <Descriptions.Item label="Impact">{ticket.impact || '-'}</Descriptions.Item>
              <Descriptions.Item label="Urgency">{ticket.urgency || '-'}</Descriptions.Item>
              <Descriptions.Item label="Created">{new Date(ticket.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Updated">{new Date(ticket.updatedAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Agent</Typography.Text>
            <Select onChange={handleAssign} value={ticket.assignedTo?.id || undefined} placeholder="Unassigned" style={{ width: '100%' }} allowClear>
              {users.filter(u => ['AGENT', 'MANAGER', 'ADMIN'].includes(u.role)).map(u => (
                <Select.Option key={u.id} value={u.id}>{u.profile?.firstName || u.login}</Select.Option>
              ))}
            </Select>
          </Card>

          {ticket.ttrDeadline && (
            <Card size="small" style={{ marginBottom: 12, ...(isOverdue ? { borderLeft: '3px solid #ff4757' } : {}) }}>
              <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>SLA - TTR Deadline</Typography.Text>
              <Typography.Text style={{ fontSize: 14, fontWeight: 600, display: 'block' }}>{new Date(ticket.ttrDeadline).toLocaleString()}</Typography.Text>
              {isOverdue && <Tag color="red" style={{ marginTop: 4 }}>OVERDUE</Tag>}
            </Card>
          )}

          {ticketApprovals.map(a => (
            <Card key={a.id} size="small" style={{ marginBottom: 12, borderLeft: `3px solid ${a.status === 'approved' ? '#2ed573' : a.status === 'rejected' ? '#ff4757' : '#ffa502'}` }}>
              <Typography.Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Approval</Typography.Text>
              <Space><Tag>{a.status}</Tag></Space>
              {a.status === 'pending' && a.approverId === user.id && (
                <Space style={{ marginTop: 8 }}>
                  <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApproval(a.id, 'approved')}>Approve</Button>
                  <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleApproval(a.id, 'rejected')}>Reject</Button>
                </Space>
              )}
            </Card>
          ))}

          {ticket.ciRelationships?.length > 0 && (
            <Card size="small">
              <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Related CIs</Typography.Text>
              <List size="small" dataSource={ticket.ciRelationships} renderItem={r => <List.Item style={{ fontSize: 13 }}>{r.ci?.name} ({r.ci?.ciType})</List.Item>} />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
