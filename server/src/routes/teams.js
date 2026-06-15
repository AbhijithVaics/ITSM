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
    const teams = await prisma.team.findMany({
      where: { organizationId: req.user.organizationId },
      include: {
        members: {
          include: { user: { select: { id: true, login: true, profile: true, role: true } } },
        },
      },
    })
    res.json(teams)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow(''),
  type: Joi.string().valid('SUPPORT', 'CHANGE_ADVISORY', 'MANAGEMENT').default('SUPPORT'),
})), async (req, res, next) => {
  try {
    const team = await prisma.team.create({
      data: {
        name: req.body.name,
        description: req.body.description || '',
        type: req.body.type,
        organizationId: req.user.organizationId,
      },
    })
    res.status(201).json(team)
  } catch (err) { next(err) }
})

router.post('/:teamId/members', requireRole('ADMIN'), validate(Joi.object({
  userId: Joi.number().positive().required(),
  role: Joi.string().valid('leader', 'member').default('member'),
})), async (req, res, next) => {
  try {
    const member = await prisma.teamMember.create({
      data: {
        teamId: Number(req.params.teamId),
        userId: req.body.userId,
        role: req.body.role,
      },
      include: { user: { select: { id: true, login: true, profile: true } } },
    })
    res.status(201).json(member)
  } catch (err) { next(err) }
})

router.delete('/:teamId/members/:userId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.teamMember.deleteMany({
      where: { teamId: Number(req.params.teamId), userId: Number(req.params.userId) },
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
