import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Progress, Tag, Typography } from 'antd'
import { api } from '../api/client'

export default function Reports() {
  const [agentStats, setAgentStats] = useState([])
  const [resolutionData, setResolutionData] = useState([])

  const load = useCallback(async () => {
    try {
      const [agents, resolutions] = await Promise.all([
        api.get('/reports/tickets-by-agent').catch(() => []),
        api.get('/reports/resolution-times').catch(() => []),
      ])
      setAgentStats(agents)
      setResolutionData(resolutions)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Reports</Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }} title="Agent Performance">
        <Table
          dataSource={agentStats}
          rowKey={a => a.agent.id}
          columns={[
            { title: 'Agent', dataIndex: ['agent', 'profile', 'firstName'], render: (v, r) => v || r.agent?.login },
            { title: 'Total', dataIndex: 'total' },
            { title: 'Open', dataIndex: 'open' },
            { title: 'Closed', dataIndex: 'closed' },
            { title: 'SLA Met', dataIndex: 'slaMet', render: v => <span style={{ color: '#2ed573' }}>{v}</span> },
            { title: 'SLA Breached', dataIndex: 'slaBreached', render: v => <span style={{ color: '#ff4757' }}>{v}</span> },
            { title: 'SLA Compliance', render: (_, a) => a.slaCompliance !== null ? (
              <Progress percent={Math.round(a.slaCompliance)} size="small" status={a.slaCompliance >= 90 ? 'success' : a.slaCompliance >= 70 ? 'normal' : 'exception'} />
            ) : '-'},
          ]}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card size="small" title="Resolution Times (by Ticket Type)">
        <Table
          dataSource={resolutionData}
          rowKey="type"
          columns={[
            { title: 'Type', dataIndex: 'type', render: v => <Tag>{v}</Tag> },
            { title: 'Count', dataIndex: 'count' },
            { title: 'Avg (hrs)', dataIndex: 'avgHours' },
            { title: 'Min (hrs)', dataIndex: 'minHours' },
            { title: 'Max (hrs)', dataIndex: 'maxHours' },
          ]}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'No resolved tickets yet.' }}
        />
      </Card>
    </div>
  )
}
