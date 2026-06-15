import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const createCommentSchema = Joi.object({
  ticketId: Joi.number().integer().positive().required(),
  text: Joi.string().min(1).required(),
  type: Joi.string().valid('public', 'private').default('public'),
})

router.get('/:ticketId', async (req, res, next) => {
  try {
    const ticketId = Number(req.params.ticketId)
    const where = { ticketId, ticket: { organizationId: req.user.organizationId } }
    if (req.user.role === 'USER') where.type = 'public'

    const comments = await prisma.comment.findMany({
      where,
      include: { author: { select: { id: true, login: true, profile: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(comments)
  } catch (err) { next(err) }
})

router.post('/', validate(createCommentSchema), async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.body.ticketId, organizationId: req.user.organizationId },
    })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const comment = await prisma.comment.create({
      data: {
        ticketId: req.body.ticketId,
        authorId: req.user.id,
        text: req.body.text,
        type: req.body.type,
      },
      include: { author: { select: { id: true, login: true, profile: true } } },
    })
    res.status(201).json(comment)
  } catch (err) { next(err) }
})

export default router
