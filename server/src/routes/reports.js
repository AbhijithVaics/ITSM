import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/tickets-by-agent', async (req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { organizationId: req.user.organizationId, assignedToId: { not: null } },
      select: { assignedToId: true, status: true, ttoDeadline: true, ttrDeadline: true, createdAt: true, resolvedAt: true },
    })

    const byAgent = {}
    for (const t of tickets) {
      const id = t.assignedToId
      if (!byAgent[id]) byAgent[id] = { total: 0, open: 0, closed: 0, slaBreached: 0, slaMet: 0 }
      byAgent[id].total++
      if (t.status === 'closed') byAgent[id].closed++
      else byAgent[id].open++
      if (t.ttrDeadline && t.resolvedAt) {
        if (new Date(t.resolvedAt) <= new Date(t.ttrDeadline)) byAgent[id].slaMet++
        else byAgent[id].slaBreached++
      }
    }

    const agents = await prisma.user.findMany({
      where: { id: { in: Object.keys(byAgent).map(Number) } },
      select: { id: true, login: true, profile: true },
    })

    const agentMap = Object.fromEntries(agents.map(a => [a.id, a]))
    const result = Object.entries(byAgent).map(([id, stats]) => ({
      agent: agentMap[Number(id)] || { id: Number(id), login: 'Unknown' },
      ...stats,
      slaCompliance: stats.slaMet + stats.slaBreached > 0
        ? Math.round((stats.slaMet / (stats.slaMet + stats.slaBreached)) * 100)
        : null,
    }))

    res.json(result)
  } catch (err) { next(err) }
})

router.get('/resolution-times', async (req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { organizationId: req.user.organizationId, status: 'closed', resolvedAt: { not: null } },
      select: { type: true, createdAt: true, resolvedAt: true },
    })

    const byType = {}
    for (const t of tickets) {
      const type = t.type
      if (!byType[type]) byType[type] = []
      const ms = new Date(t.resolvedAt) - new Date(t.createdAt)
      byType[type].push(Math.round(ms / 3600000)) // hours
    }

    const result = Object.entries(byType).map(([type, times]) => ({
      type,
      count: times.length,
      avgHours: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minHours: Math.min(...times),
      maxHours: Math.max(...times),
    }))

    res.json(result)
  } catch (err) { next(err) }
})

export default router
