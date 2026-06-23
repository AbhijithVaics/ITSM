import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Input, Tag, Typography, Space } from 'antd'
import { api } from '../api/client'

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [filterTicketId, setFilterTicketId] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()
  const limit = 50

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
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Audit Trail</Typography.Title>
        <Input.Search placeholder="Filter by Ticket ID" allowClear onSearch={v => { setFilterTicketId(v); setPage(0) }} style={{ width: 220 }} />
      </Space>
      <Table
        dataSource={entries}
        rowKey="id"
        onRow={e => ({ onClick: () => navigate(`/tickets/${e.ticketId}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Time', dataIndex: 'createdAt', render: v => new Date(v).toLocaleString(), width: 180 },
          { title: 'User', dataIndex: ['user', 'login'] },
          { title: 'Action', dataIndex: 'action', render: v => <Tag>{v}</Tag> },
          { title: 'Field', dataIndex: 'field' },
          { title: 'Old Value', dataIndex: 'oldValue', render: v => <Typography.Text type="secondary">{v}</Typography.Text> },
          { title: 'New Value', dataIndex: 'newValue', render: v => <Typography.Text type="secondary">{v}</Typography.Text> },
          { title: 'Ticket', dataIndex: 'ticketId', render: v => <a onClick={e => { e.stopPropagation(); navigate(`/tickets/${v}`) }}>#{v}</a> },
        ]}
        pagination={{ current: page + 1, pageSize: limit, total, onChange: p => setPage(p - 1), showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No audit entries found.' }}
      />
    </div>
  )
}
