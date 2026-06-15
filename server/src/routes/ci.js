import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const createCiSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  ciType: Joi.string().required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('production', 'inactive', 'decommissioned').default('production'),
  attributes: Joi.object().default({}),
})

router.get('/', async (req, res, next) => {
  try {
    const { ciType, search, limit = 50, offset = 0 } = req.query
    const where = { organizationId: req.user.organizationId }
    if (ciType) where.ciType = ciType
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      prisma.cI.findMany({ where, orderBy: { name: 'asc' }, take: Number(limit), skip: Number(offset) }),
      prisma.cI.count({ where }),
    ])
    res.json({ items, total })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const ci = await prisma.cI.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
      include: {
        inboundRelationships: {
          include: { sourceCI: { select: { id: true, name: true, ciType: true } } },
        },
        outboundRelationships: {
          include: { targetCI: { select: { id: true, name: true, ciType: true } } },
        },
      },
    })
    if (!ci) return res.status(404).json({ error: 'CI not found' })
    res.json(ci)
  } catch (err) { next(err) }
})

router.post('/', validate(createCiSchema), requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const ci = await prisma.cI.create({
      data: {
        name: req.body.name,
        ciType: req.body.ciType,
        description: req.body.description || '',
        status: req.body.status,
        attributes: req.body.attributes,
        organizationId: req.user.organizationId,
      },
    })
    res.status(201).json(ci)
  } catch (err) { next(err) }
})

router.get('/:id/impact', async (req, res, next) => {
  try {
    const ciId = Number(req.params.id)
    const ci = await prisma.cI.findFirst({ where: { id: ciId, organizationId: req.user.organizationId } })
    if (!ci) return res.status(404).json({ error: 'CI not found' })

    const outbound = await prisma.cIRelationship.findMany({
      where: { sourceCIId: ciId },
      include: { targetCI: { select: { id: true, name: true, ciType: true, status: true } } },
    })

    const tickets = await prisma.cIRelatedTicket.findMany({
      where: { ciId },
      include: { ticket: { select: { id: true, ref: true, title: true, status: true, type: true } } },
    })

    res.json({ ci, impactedCIs: outbound.map(r => r.targetCI), relatedTickets: tickets.map(t => t.ticket) })
  } catch (err) { next(err) }
})

router.post('/relationships', validate(Joi.object({
  sourceCIId: Joi.number().positive().required(),
  targetCIId: Joi.number().positive().required(),
  relationshipType: Joi.string().valid('depends_on', 'connects_to', 'impacts', 'contains', 'backup', 'clustered').default('depends_on'),
})), requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const rel = await prisma.cIRelationship.create({
      data: {
        sourceCIId: req.body.sourceCIId,
        targetCIId: req.body.targetCIId,
        relationshipType: req.body.relationshipType,
      },
    })
    res.status(201).json(rel)
  } catch (err) { next(err) }
})

export default router
