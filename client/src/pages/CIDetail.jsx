import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCI, getCIImpact } from '../api/ci'
import CIGraph from '../components/CIGraph'

export default function CIDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ci, setCI] = useState(null)
  const [impact, setImpact] = useState(null)
  const [activeTab, setActiveTab] = useState('graph')

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

  if (!ci) return <div className="loading">Loading...</div>

  return (
    <div className="ci-detail">
      <div className="page-header">
        <div>
          <h1>{ci.name}</h1>
          <p className="text-muted">{ci.description}</p>
        </div>
        <span className={`badge badge-${ci.status}`}>{ci.status}</span>
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')}>Relationship Graph</button>
        <button className={`tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
        <button className={`tab ${activeTab === 'impact' ? 'active' : ''}`} onClick={() => setActiveTab('impact')}>Impact Analysis</button>
      </div>

      {activeTab === 'graph' && (
        <div className="detail-section">
          <h3>CI Relationship Graph</h3>
          <p className="text-muted" style={{ marginBottom: 12 }}>Click a node to navigate. Blue=current CI, green=dependencies, orange=depended-by.</p>
          <CIGraph ci={ci} inbound={ci.inboundRelationships} outbound={ci.outboundRelationships} />
        </div>
      )}

      {activeTab === 'details' && (
        <div className="detail-grid">
          <div className="detail-section">
            <h3>Attributes</h3>
            <pre className="json-display">{JSON.stringify(ci.attributes, null, 2)}</pre>
          </div>

          <div className="detail-section">
            <h3>Relationships</h3>
            <h4>Depends On ({ci.outboundRelationships?.length || 0})</h4>
            {ci.outboundRelationships?.length === 0 && <p className="text-muted">None</p>}
            {ci.outboundRelationships?.map(r => (
              <div key={r.id} className="relation-item">
                <span className="clickable" onClick={() => navigate(`/cmdb/${r.targetCI?.id}`)} style={{ cursor: 'pointer', color: '#4f8cff' }}>{r.targetCI?.name}</span>
                <span className="badge">{r.relationshipType}</span>
              </div>
            ))}
            <h4 style={{ marginTop: 12 }}>Used By ({ci.inboundRelationships?.length || 0})</h4>
            {ci.inboundRelationships?.length === 0 && <p className="text-muted">None</p>}
            {ci.inboundRelationships?.map(r => (
              <div key={r.id} className="relation-item">
                <span className="clickable" onClick={() => navigate(`/cmdb/${r.sourceCI?.id}`)} style={{ cursor: 'pointer', color: '#2ed573' }}>{r.sourceCI?.name}</span>
                <span className="badge">{r.relationshipType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'impact' && (
        <div className="detail-section">
          <h3>Impact Analysis</h3>
          {impact?.impactedCIs?.length > 0 && (
            <>
              <h4>Impacted CIs</h4>
              {impact.impactedCIs.map(c => (
                <div key={c.id} className="relation-item">
                  <span className="clickable" onClick={() => navigate(`/cmdb/${c.id}`)} style={{ cursor: 'pointer', color: '#4f8cff' }}>{c.name}</span>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </div>
              ))}
            </>
          )}
          {impact?.relatedTickets?.length > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>Related Tickets</h4>
              {impact.relatedTickets.map(t => (
                <div key={t.id} className="ticket-ref-link clickable" onClick={() => navigate(`/tickets/${t.id}`)} style={{ cursor: 'pointer' }}>{t.ref} - {t.title} ({t.status})</div>
              ))}
            </>
          )}
          {(!impact?.impactedCIs?.length && !impact?.relatedTickets?.length) && <p className="empty-state">No impact data</p>}
        </div>
      )}
    </div>
  )
}
