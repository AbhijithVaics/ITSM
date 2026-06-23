import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Select, Input, Button, Tag, Typography, Badge, Space } from 'antd'
import { PlusOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { listTickets } from '../api/tickets'
import { getStats } from '../api/stats'

const COLUMNS = [
  { key: 'new', label: 'New', color: '#4f8cff' },
  { key: 'assigned', label: 'Assigned', color: '#ffa502' },
  { key: 'in_progress', label: 'In Progress', color: '#2ed573' },
  { key: 'pending', label: 'Pending', color: '#7a8ba8' },
  { key: 'resolved', label: 'Resolved', color: '#2ed573' },
  { key: 'closed', label: 'Closed', color: '#7a8ba8' },
]

const PRIORITY_COLORS = { 1: '#ff4757', 2: '#ffa502', 3: '#ffdd00', 4: '#2ed573' }
const TYPE_COLORS = { INCIDENT: '#ff4757', SERVICE_REQUEST: '#4f8cff', CHANGE: '#ffa502', PROBLEM: '#be5aff' }

export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const limit = 100

  const load = useCallback(async () => {
    try {
      const params = { limit }
      if (filterType) params.type = filterType
      if (search) params.search = search
      const [data, statsData] = await Promise.all([listTickets(params), getStats()])
      setTickets(data.tickets)
      setStats(statsData)
    } catch (e) { console.error(e) }
  }, [filterType, search])

  useEffect(() => { load() }, [load])

  const grouped = COLUMNS.map(col => ({ ...col, items: tickets.filter(t => t.status === col.key) }))

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Dashboard</Typography.Title>
        <Space>
          <Input.Search placeholder="Search tickets..." allowClear onSearch={v => { setSearch(v) }} style={{ width: 220 }} />
          <Select allowClear placeholder="Type" style={{ width: 140 }} onChange={v => setFilterType(v || '')}>
            <Select.Option value="INCIDENT">Incidents</Select.Option>
            <Select.Option value="SERVICE_REQUEST">Service Requests</Select.Option>
            <Select.Option value="CHANGE">Changes</Select.Option>
            <Select.Option value="PROBLEM">Problems</Select.Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-ticket')}>New Ticket</Button>
        </Space>
      </Row>

      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Total Tickets" value={stats.total} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="Open" value={stats.openTickets} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small" style={stats.overdue > 0 ? { borderLeft: '3px solid #ff4757' } : {}}><Statistic title="Overdue" value={stats.overdue} valueStyle={stats.overdue > 0 ? { color: '#ff4757' } : {}} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="SLAs" value={stats.slaCount} /></Card></Col>
          {Object.entries(stats.byType || {}).map(([t, c]) => (
            <Col key={t} xs={12} sm={8} md={4}><Card size="small"><Statistic title={t.replace('_', ' ')} value={c} /></Card></Col>
          ))}
        </Row>
      )}

      <div className="kanban-board">
        {grouped.map(col => (
          <div key={col.key} className="kanban-column">
            <Card
              size="small"
              title={<span>{col.label} <Tag>{col.items.length}</Tag></span>}
              style={{ borderTop: `3px solid ${col.color}` }}
              bodyStyle={{ padding: 8 }}
            >
              <div className="kanban-items">
                {col.items.map(ticket => (
                  <Card key={ticket.id} size="small" className="ticket-card" hoverable onClick={() => navigate(`/tickets/${ticket.id}`)}
                    style={{ borderLeft: `3px solid ${PRIORITY_COLORS[ticket.priority] || '#666'}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4f8cff', marginBottom: 2 }}>{ticket.ref}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ticket.title}</div>
                    <Tag color={TYPE_COLORS[ticket.type]} style={{ fontSize: 10, margin: 0 }}>{ticket.type}</Tag>
                    {ticket.assignedTo && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>{ticket.assignedTo.profile?.firstName}</span>}
                    {ticket.ttrDeadline && new Date(ticket.ttrDeadline) < new Date() && <Badge count="OVERDUE" size="small" style={{ marginLeft: 4 }} />}
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
