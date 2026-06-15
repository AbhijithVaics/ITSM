import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const slas = await prisma.sLA.findMany({
      where: { organizationId: req.user.organizationId },
      include: { targets: true },
    })
    res.json(slas)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN'), validate(Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow(''),
  workingDays: Joi.array().items(Joi.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
  startHour: Joi.number().min(0).max(23).default(9),
  endHour: Joi.number().min(1).max(24).default(18),
})), async (req, res, next) => {
  try {
    const sla = await prisma.sLA.create({
      data: {
        name: req.body.name,
        description: req.body.description || '',
        workingDays: req.body.workingDays,
        startHour: req.body.startHour,
        endHour: req.body.endHour,
        organizationId: req.user.organizationId,
      },
    })
    res.status(201).json(sla)
  } catch (err) { next(err) }
})

router.post('/:slaId/targets', requireRole('ADMIN'), validate(Joi.object({
  priority: Joi.number().valid(1, 2, 3, 4).required(),
  metric: Joi.string().valid('TTO', 'TTR').required(),
  value: Joi.number().positive().required(),
})), async (req, res, next) => {
  try {
    const target = await prisma.sLATarget.create({
      data: {
        slaId: Number(req.params.slaId),
        priority: req.body.priority,
        metric: req.body.metric,
        value: req.body.value,
      },
    })
    res.status(201).json(target)
  } catch (err) { next(err) }
})

export default router
