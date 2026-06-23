import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Tag, Tabs, Typography, List, Space } from 'antd'
import { getCI, getCIImpact } from '../api/ci'
import CIGraph from '../components/CIGraph'

export default function CIDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ci, setCI] = useState(null)
  const [impact, setImpact] = useState(null)

  const load = useCallback(async () => {
    try {
      const [ciData, impactData] = await Promise.all([
        getCI(id).catch(() => null),
        getCIImpact(id).catch(() => null),
      ])
      setCI(ciData)
      setImpact(impactData)
    } catch (e) { console.error(e) }
  }, [id])

  useEffect(() => { load() }, [load])

  if (!ci) return <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.45)' }}>Loading...</div>

  return (
    <div>
      <Space align="start" style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{ci.name}</Typography.Title>
          <Typography.Text type="secondary">{ci.description}</Typography.Text>
        </div>
        <Tag color={ci.status === 'production' ? 'green' : ci.status === 'inactive' ? 'orange' : 'red'}>{ci.status}</Tag>
      </Space>

      <Tabs
        defaultActiveKey="graph"
        items={[
          { key: 'graph', label: 'Relationship Graph', children: (
            <Card size="small">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>Click a node to navigate. Blue = current CI, green = dependencies, orange = depended-by.</Typography.Paragraph>
              <CIGraph ci={ci} inbound={ci.inboundRelationships} outbound={ci.outboundRelationships} />
            </Card>
          )},
          { key: 'details', label: 'Details', children: (
            <Card size="small">
              <Typography.Text strong style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>Attributes</Typography.Text>
              <pre style={{ background: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify(ci.attributes, null, 2)}</pre>
            </Card>
          )},
          { key: 'impact', label: 'Impact Analysis', children: (
            <div>
              {impact?.impactedCIs?.length > 0 && (
                <Card size="small" style={{ marginBottom: 12 }} title="Impacted CIs">
                  <List size="small" dataSource={impact.impactedCIs} renderItem={c => (
                    <List.Item><a onClick={() => navigate(`/cmdb/${c.id}`)}>{c.name}</a> <Tag>{c.status}</Tag></List.Item>
                  )} />
                </Card>
              )}
              {impact?.relatedTickets?.length > 0 && (
                <Card size="small" title="Related Tickets">
                  <List size="small" dataSource={impact.relatedTickets} renderItem={t => (
                    <List.Item><a onClick={() => navigate(`/tickets/${t.id}`)}>{t.ref}</a> — {t.title} ({t.status})</List.Item>
                  )} />
                </Card>
              )}
              {(!impact?.impactedCIs?.length && !impact?.relatedTickets?.length) && <Typography.Text type="secondary">No impact data</Typography.Text>}
            </div>
          )},
        ]}
      />
    </div>
  )
}
