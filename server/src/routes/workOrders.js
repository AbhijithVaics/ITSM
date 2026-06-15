import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const createWoSchema = Joi.object({
  ticketId: Joi.number().integer().positive().required(),
  summary: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow(''),
  agentId: Joi.number().integer().positive(),
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const wo = await prisma.workOrder.findFirst({
      where: { id: Number(req.params.id), agentId: req.user.id },
    })
    if (!wo) return res.status(404).json({ error: 'Work order not found or not assigned to you' })

    const updated = await prisma.workOrder.update({
      where: { id: wo.id },
      data: { status, completedAt: status === 'completed' ? new Date() : undefined },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

router.post('/', validate(createWoSchema), async (req, res, next) => {
  try {
    const wo = await prisma.workOrder.create({
      data: {
        ticketId: req.body.ticketId,
        summary: req.body.summary,
        description: req.body.description || '',
        agentId: req.body.agentId || null,
        status: 'open',
      },
      include: { agent: { select: { id: true, login: true, profile: true } } },
    })
    res.status(201).json(wo)
  } catch (err) { next(err) }
})

export default router
