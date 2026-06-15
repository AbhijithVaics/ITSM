import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const createApprovalSchema = Joi.object({
  ticketId: Joi.number().integer().positive().required(),
  approverId: Joi.number().integer().positive().required(),
})

const respondSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  comment: Joi.string().allow(''),
})

router.get('/pending', async (req, res, next) => {
  try {
    const approvals = await prisma.approval.findMany({
      where: { approverId: req.user.id, status: 'pending' },
      include: {
        ticket: { select: { id: true, ref: true, title: true, type: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(approvals)
  } catch (err) { next(err) }
})

router.post('/', validate(createApprovalSchema), requireAdminOrManager, async (req, res, next) => {
  try {
    const existing = await prisma.approval.findFirst({
      where: { ticketId: req.body.ticketId, approverId: req.body.approverId },
    })
    if (existing) return res.status(409).json({ error: 'Approval request already exists' })

    const approval = await prisma.approval.create({
      data: {
        ticketId: req.body.ticketId,
        approverId: req.body.approverId,
        status: 'pending',
      },
      include: {
        approver: { select: { id: true, login: true, profile: true } },
        ticket: { select: { id: true, ref: true, title: true } },
      },
    })
    res.status(201).json(approval)
  } catch (err) { next(err) }
})

router.patch('/:id/respond', validate(respondSchema), async (req, res, next) => {
  try {
    const approval = await prisma.approval.findFirst({
      where: { id: Number(req.params.id), approverId: req.user.id },
    })
    if (!approval) return res.status(404).json({ error: 'Approval not found' })
    if (approval.status !== 'pending') return res.status(400).json({ error: 'Already responded' })

    const updated = await prisma.approval.update({
      where: { id: approval.id },
      data: { status: req.body.status, respondedAt: new Date(), comment: req.body.comment },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

async function requireAdminOrManager(req, res, next) {
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin or Manager role required' })
  }
  next()
}

export default router
