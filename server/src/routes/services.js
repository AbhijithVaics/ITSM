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
    const services = await prisma.service.findMany({
      where: { organizationId: req.user.organizationId },
      include: {
        subcategories: true,
        contractLinks: { include: { contract: true } },
      },
    })
    res.json(services)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow(''),
  status: Joi.string().valid('active', 'inactive').default('active'),
})), async (req, res, next) => {
  try {
    const service = await prisma.service.create({
      data: { name: req.body.name, description: req.body.description || '', status: req.body.status, organizationId: req.user.organizationId },
    })
    res.status(201).json(service)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const service = await prisma.service.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
      include: { subcategories: true, contractLinks: { include: { contract: true, sla: true } } },
    })
    if (!service) return res.status(404).json({ error: 'Service not found' })
    res.json(service)
  } catch (err) { next(err) }
})

router.post('/:id/subcategories', requireRole('ADMIN'), validate(Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow(''),
})), async (req, res, next) => {
  try {
    const sub = await prisma.serviceSubcategory.create({
      data: { name: req.body.name, description: req.body.description || '', serviceId: Number(req.params.id) },
    })
    res.status(201).json(sub)
  } catch (err) { next(err) }
})

export default router
