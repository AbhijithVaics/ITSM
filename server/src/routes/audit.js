import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'

const router = Router()
router.use(authenticate)

router.get('/', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { ticketId, limit = 100, offset = 0 } = req.query
    const where = { ticket: { organizationId: req.user.organizationId } }
    if (ticketId) where.ticketId = Number(ticketId)

    const [entries, total] = await Promise.all([
      prisma.auditTrail.findMany({
        where,
        include: { user: { select: { id: true, login: true, profile: true } } },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.auditTrail.count({ where }),
    ])
    res.json({ entries, total })
  } catch (err) { next(err) }
})

export default router
