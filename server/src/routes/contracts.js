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
    const contracts = await prisma.customerContract.findMany({
      where: { organizationId: req.user.organizationId },
      include: { serviceLinks: { include: { service: true, sla: true } } },
    })
    res.json(contracts)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN'), validate(Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null),
})), async (req, res, next) => {
  try {
    const contract = await prisma.customerContract.create({
      data: {
        name: req.body.name,
        description: req.body.description || '',
        startDate: new Date(req.body.startDate),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
        organizationId: req.user.organizationId,
      },
    })
    res.status(201).json(contract)
  } catch (err) { next(err) }
})

router.post('/:id/link-service', requireRole('ADMIN'), validate(Joi.object({
  serviceId: Joi.number().positive().required(),
  slaId: Joi.number().positive().required(),
})), async (req, res, next) => {
  try {
    const link = await prisma.contractToService.create({
      data: {
        contractId: Number(req.params.id),
        serviceId: req.body.serviceId,
        slaId: req.body.slaId,
      },
      include: { service: true, sla: true },
    })
    res.status(201).json(link)
  } catch (err) { next(err) }
})

export default router
