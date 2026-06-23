import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Tag, Typography, Space } from 'antd'
import { listCIs } from '../api/ci'

export default function CMDB() {
  const [cis, setCIs] = useState([])
  const [filterType, setFilterType] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const params = { limit: 100 }
    if (filterType) params.ciType = filterType
    listCIs(params).then(d => setCIs(d.items)).catch(console.error)
  }, [filterType])

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Configuration Management</Typography.Title>
        <Select allowClear placeholder="Type" style={{ width: 160 }} onChange={v => setFilterType(v || '')}>
          <Select.Option value="Server">Server</Select.Option>
          <Select.Option value="Application">Application</Select.Option>
          <Select.Option value="NetworkDevice">Network Device</Select.Option>
          <Select.Option value="Database">Database</Select.Option>
          <Select.Option value="Middleware">Middleware</Select.Option>
          <Select.Option value="VMware">VMware</Select.Option>
          <Select.Option value="Storage">Storage</Select.Option>
          <Select.Option value="PhysicalServer">Physical Server</Select.Option>
        </Select>
      </Space>
      <Table
        dataSource={cis}
        rowKey="id"
        onRow={ci => ({ onClick: () => navigate(`/cmdb/${ci.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'ciType', render: v => <Tag>{v}</Tag> },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'production' ? 'green' : v === 'inactive' ? 'orange' : 'red'}>{v}</Tag> },
          { title: 'Description', dataIndex: 'description', render: v => <Typography.Text type="secondary">{v}</Typography.Text> },
        ]}
        locale={{ emptyText: 'No configuration items found.' }}
        pagination={false}
        size="middle"
      />
    </div>
  )
}
