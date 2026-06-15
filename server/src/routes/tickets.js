import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { applyTransition, getAvailableTransitions } from '../services/stateMachine.js'
import { generateTicketRef } from '../services/ticketRefGen.js'
import { computePriority } from '../services/priorityMatrix.js'
import { resolveSlaDeadlines } from '../services/slaChain.js'
import { createNotification } from './notifications.js'

const router = Router()

router.use(authenticate)

const createTicketSchema = Joi.object({
  type: Joi.string().valid('INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM').required(),
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().required(),
  impact: Joi.number().valid(1, 2, 3),
  urgency: Joi.number().valid(1, 2, 3, 4),
  priority: Joi.number().valid(1, 2, 3, 4),
  serviceId: Joi.number().integer().positive(),
  serviceSubcategoryId: Joi.number().integer().positive(),
  ciIds: Joi.array().items(Joi.number().integer().positive()),
})

router.get('/', async (req, res, next) => {
  try {
    const { type, status, priority, assignedToId, search, limit = 50, offset = 0 } = req.query
    const where = { organizationId: req.user.organizationId }

    if (type) where.type = type
    if (status) where.status = status
    if (priority) where.priority = Number(priority)
    if (assignedToId) where.assignedToId = Number(assignedToId)
    if (search) {
      where.OR = [
        { ref: { contains: search } },
        { title: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (req.user.role === 'USER') where.createdById = req.user.id

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, login: true, profile: true } },
          createdBy: { select: { id: true, login: true, profile: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.ticket.count({ where }),
    ])

    res.json({ tickets, total, limit: Number(limit), offset: Number(offset) })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
      include: {
        assignedTo: { select: { id: true, login: true, profile: true } },
        createdBy: { select: { id: true, login: true, profile: true } },
        comments: {
          include: { author: { select: { id: true, login: true, profile: true } } },
          orderBy: { createdAt: 'asc' },
        },
        workOrders: {
          include: { agent: { select: { id: true, login: true, profile: true } } },
        },
        approvals: {
          include: { approver: { select: { id: true, login: true, profile: true } } },
        },
        ciRelationships: {
          include: { ci: { select: { id: true, name: true, ciType: true } } },
        },
      },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    res.json(ticket)
  } catch (err) { next(err) }
})

router.post('/', validate(createTicketSchema), async (req, res, next) => {
  try {
    const ref = await generateTicketRef(req.body.type, req.user.organizationId)
    const impact = req.body.impact || 2
    const urgency = req.body.urgency || 3
    const priority = req.body.priority || computePriority(impact, urgency)

    // Create a partial ticket to compute SLA deadlines
    const partialTicket = {
      type: req.body.type,
      priority,
      serviceId: req.body.serviceId || null,
      createdAt: new Date(),
    }
    const slaDeadlines = await resolveSlaDeadlines(partialTicket)

    const ticket = await prisma.ticket.create({
      data: {
        ref,
        type: req.body.type,
        title: req.body.title,
        description: req.body.description,
        status: 'new',
        impact,
        urgency,
        priority,
        serviceId: req.body.serviceId || null,
        serviceSubcategoryId: req.body.serviceSubcategoryId || null,
        organizationId: req.user.organizationId,
        createdById: req.user.id,
        ttoDeadline: slaDeadlines.tto,
        ttrDeadline: slaDeadlines.ttr,
        ciRelationships: req.body.ciIds?.length
          ? { create: req.body.ciIds.map(ciId => ({ ciId, organizationId: req.user.organizationId })) }
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, login: true, profile: true } },
      },
    })

    res.status(201).json(ticket)
  } catch (err) { next(err) }
})

router.patch('/:id/transition', async (req, res, next) => {
  try {
    const { transition } = req.body
    if (!transition) return res.status(400).json({ error: 'transition name required' })

    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const newStatus = applyTransition(ticket.type, ticket.status, transition, req.user.role)

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: newStatus },
    })

    await prisma.auditTrail.create({
      data: {
        ticketId: ticket.id,
        userId: req.user.id,
        field: 'status',
        oldValue: ticket.status,
        newValue: newStatus,
        action: transition,
      },
    })

    if (updated.assignedToId && updated.assignedToId !== req.user.id) {
      await createNotification({
        userId: updated.assignedToId,
        type: 'TICKET_UPDATED',
        title: `Ticket ${ticket.ref} moved to ${newStatus}`,
        ticketId: ticket.id,
      }).catch(() => {})
    }

    res.json(updated)
  } catch (err) { next(err) }
})

router.get('/:id/transitions', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const transitions = getAvailableTransitions(ticket.type, ticket.status, req.user.role)
    res.json({ transitions })
  } catch (err) { next(err) }
})

router.patch('/:id/assign', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { assignedToId } = req.body
    if (!assignedToId) return res.status(400).json({ error: 'assignedToId required' })

    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { assignedToId, status: 'assigned' },
    })

    await prisma.auditTrail.create({
      data: {
        ticketId: ticket.id,
        userId: req.user.id,
        field: 'assignedToId',
        oldValue: String(ticket.assignedToId || ''),
        newValue: String(assignedToId),
        action: 'assign',
      },
    })

    await createNotification({
      userId: assignedToId,
      type: 'TICKET_ASSIGNED',
      title: `Ticket ${ticket.ref} assigned to you`,
      ticketId: ticket.id,
    }).catch(() => {})

    res.json(updated)
  } catch (err) { next(err) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, description, impact, urgency, priority, serviceId } = req.body

    const ticket = await prisma.ticket.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { title, description, impact, urgency, priority, serviceId },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

function computeSlaDeadlineDefaults(type, priority) {
  // Placeholder: In production, look up the customer contract/SLA mapping
  return { tto: null, ttr: null }
}

export default router
