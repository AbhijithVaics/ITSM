import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Tag, Typography, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { listTickets } from '../api/tickets'
import { useAuth } from '../contexts/AuthContext'

const TYPE_COLORS = { INCIDENT: '#ff4757', SERVICE_REQUEST: '#4f8cff', CHANGE: '#ffa502', PROBLEM: '#be5aff' }

export default function MyRequests() {
  const [tickets, setTickets] = useState([])
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    listTickets({ limit: 50 }).then(d => setTickets(d.tickets)).catch(console.error)
  }, [])

  const myTickets = tickets.filter(t => t.createdById === user.id)

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>My Requests</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create-ticket')}>New Request</Button>
      </Space>
      <Table
        dataSource={myTickets}
        rowKey="id"
        onRow={t => ({ onClick: () => navigate(`/tickets/${t.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Ref', dataIndex: 'ref', render: (v, r) => <a onClick={() => navigate(`/tickets/${r.id}`)}>{v}</a> },
          { title: 'Title', dataIndex: 'title' },
          { title: 'Type', dataIndex: 'type', render: v => <Tag color={TYPE_COLORS[v]}>{v}</Tag> },
          { title: 'Status', dataIndex: 'status', render: v => <Tag>{v}</Tag> },
          { title: 'Created', dataIndex: 'createdAt', render: v => new Date(v).toLocaleDateString() },
        ]}
        locale={{ emptyText: 'No requests yet.' }}
        pagination={false}
        size="middle"
      />
    </div>
  )
}
