import { useState, useEffect, useCallback } from 'react'
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
    <div className="reports-page">
      <div className="page-header"><h1>Reports</h1></div>

      <section className="detail-section">
        <h3>Agent Performance</h3>
        <table className="data-table">
          <thead>
            <tr><th>Agent</th><th>Total</th><th>Open</th><th>Closed</th><th>SLA Met</th><th>SLA Breached</th><th>SLA Compliance</th></tr>
          </thead>
          <tbody>
            {agentStats.map(a => (
              <tr key={a.agent.id}>
                <td>{a.agent.profile?.firstName || a.agent.login}</td>
                <td>{a.total}</td>
                <td>{a.open}</td>
                <td>{a.closed}</td>
                <td style={{ color: 'var(--success)' }}>{a.slaMet}</td>
                <td style={{ color: 'var(--danger)' }}>{a.slaBreached}</td>
                <td>
                  {a.slaCompliance !== null ? (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${a.slaCompliance}%`, background: a.slaCompliance >= 90 ? 'var(--success)' : a.slaCompliance >= 70 ? 'var(--warning)' : 'var(--danger)' }} />
                      <span>{a.slaCompliance}%</span>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h3>Resolution Times (by Ticket Type)</h3>
        <table className="data-table">
          <thead>
            <tr><th>Type</th><th>Count</th><th>Avg (hrs)</th><th>Min (hrs)</th><th>Max (hrs)</th></tr>
          </thead>
          <tbody>
            {resolutionData.map(r => (
              <tr key={r.type}>
                <td><span className="badge">{r.type}</span></td>
                <td>{r.count}</td>
                <td>{r.avgHours}</td>
                <td>{r.minHours}</td>
                <td>{r.maxHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resolutionData.length === 0 && <p className="empty-state">No resolved tickets yet.</p>}
      </section>
    </div>
  )
}
