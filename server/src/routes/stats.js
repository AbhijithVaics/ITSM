import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const orgId = req.user.organizationId
    const baseWhere = { organizationId: orgId }
    const userWhere = { ...baseWhere, createdById: req.user.id }

    const [total, openTickets, overdue, byType, slas, recent] = await Promise.all([
      prisma.ticket.count({ where: req.user.role === 'USER' ? userWhere : baseWhere }),
      prisma.ticket.count({ where: { ...baseWhere, status: { not: 'closed' }, ...(req.user.role === 'USER' ? { createdById: req.user.id } : {}) } }),
      prisma.ticket.count({ where: { ...baseWhere, ttrDeadline: { lt: new Date() }, status: { notIn: ['closed', 'resolved'] } } }),
      prisma.ticket.groupBy({ by: ['type'], _count: true, where: baseWhere }),
      prisma.sLA.findMany({ where: { organizationId: orgId }, include: { _count: { select: { targets: true } } } }),
      prisma.ticket.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, ref: true, title: true, type: true, status: true, createdAt: true },
      }),
    ])

    res.json({
      total,
      openTickets,
      overdue,
      byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t._count }), {}),
      slaCount: slas.length,
      recent,
    })
  } catch (err) { next(err) }
})

export default router
