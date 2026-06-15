import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="cmdb-page">
      <div className="page-header">
        <h1>Configuration Management</h1>
        <div className="header-controls">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Server">Server</option>
            <option value="Application">Application</option>
            <option value="NetworkDevice">Network Device</option>
            <option value="Database">Database</option>
            <option value="Middleware">Middleware</option>
            <option value="VMware">VMware</option>
            <option value="Storage">Storage</option>
            <option value="PhysicalServer">Physical Server</option>
          </select>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Status</th><th>Description</th></tr>
        </thead>
        <tbody>
          {cis.map(ci => (
            <tr key={ci.id} className="clickable" onClick={() => navigate(`/cmdb/${ci.id}`)}>
              <td>{ci.name}</td>
              <td><span className="badge">{ci.ciType}</span></td>
              <td><span className={`badge badge-${ci.status}`}>{ci.status}</span></td>
              <td className="text-muted">{ci.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cis.length === 0 && <div className="empty-state">No configuration items found.</div>}
    </div>
  )
}
