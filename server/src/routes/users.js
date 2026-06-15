import { Router } from 'express'
import Joi from 'joi'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const createUserSchema = Joi.object({
  login: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('ADMIN', 'AGENT', 'MANAGER', 'CHANGE_MANAGER', 'USER', 'READ_ONLY').default('USER'),
  profile: Joi.object({
    firstName: Joi.string().allow(''),
    lastName: Joi.string().allow(''),
    phone: Joi.string().allow(''),
    avatar: Joi.string().allow(''),
  }).default({}),
  status: Joi.string().valid('ENABLED', 'DISABLED').default('ENABLED'),
})

router.get('/', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: { id: true, login: true, email: true, role: true, status: true, profile: true, createdAt: true },
      orderBy: { login: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN'), validate(createUserSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ login: req.body.login }, { email: req.body.email }] },
    })
    if (existing) return res.status(409).json({ error: 'Login or email already taken' })

    const hashed = await bcrypt.hash(req.body.password, 10)
    const user = await prisma.user.create({
      data: {
        login: req.body.login,
        email: req.body.email,
        password: hashed,
        role: req.body.role,
        profile: req.body.profile,
        status: req.body.status,
        organizationId: req.user.organizationId,
      },
      select: { id: true, login: true, email: true, role: true, status: true, profile: true, createdAt: true },
    })
    res.status(201).json(user)
  } catch (err) { next(err) }
})

router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { role, status, profile, email } = req.body
    const user = await prisma.user.findFirst({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role, status, profile, email },
      select: { id: true, login: true, email: true, role: true, status: true, profile: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

export default router
