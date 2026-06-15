import { useEffect, useRef } from 'react'
import { Network } from 'vis-network'
import { DataSet } from 'vis-data'

export default function CIGraph({ ci, inbound, outbound }) {
  const containerRef = useRef(null)
  const networkRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !ci) return

    const nodes = new DataSet()
    const edges = new DataSet()

    nodes.add({ id: ci.id, label: ci.name, title: ci.ciType, color: { background: '#4f8cff', border: '#6ba0ff' }, font: { color: '#e0e6f0', size: 14 }, shape: 'box' })

    ;(inbound || []).forEach(r => {
      const s = r.sourceCI
      if (s) {
        nodes.add({ id: s.id, label: s.name, title: s.ciType, color: { background: '#2ed573', border: '#5ce68c' }, font: { color: '#e0e6f0', size: 12 }, shape: 'ellipse' })
        edges.add({ from: s.id, to: ci.id, label: r.relationshipType, arrows: 'to', color: { color: '#7a8ba8', hover: '#4f8cff' }, font: { color: '#7a8ba8', size: 10, strokeWidth: 0 } })
      }
    })

    ;(outbound || []).forEach(r => {
      const t = r.targetCI
      if (t) {
        nodes.add({ id: t.id, label: t.name, title: t.ciType, color: { background: '#ffa502', border: '#ffbe4d' }, font: { color: '#e0e6f0', size: 12 }, shape: 'ellipse' })
        edges.add({ from: ci.id, to: t.id, label: r.relationshipType, arrows: 'to', color: { color: '#7a8ba8', hover: '#4f8cff' }, font: { color: '#7a8ba8', size: 10, strokeWidth: 0 } })
      }
    })

    const options = {
      nodes: { borderWidth: 2, size: 30 },
      edges: { width: 2, smooth: { type: 'curvedCW', roundness: 0.2 } },
      physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -40, centralGravity: 0.005, springLength: 150, springConstant: 0.02 }, stabilization: { iterations: 100 } },
      interaction: { hover: true, tooltipDelay: 200 },
      layout: { improvedLayout: true },
      backgroundColor: 'transparent',
    }

    networkRef.current = new Network(containerRef.current, { nodes, edges }, options)
    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        const id = params.nodes[0]
        if (id !== ci.id) {
          window.open(`/cmdb/${id}`, '_self')
        }
      }
    })

    return () => { networkRef.current?.destroy() }
  }, [ci, inbound, outbound])

  return <div ref={containerRef} style={{ width: '100%', height: '400px', borderRadius: '10px', background: 'rgba(18,25,45,0.5)' }} />
}
