import { Router } from 'express'
import bcrypt from 'bcryptjs'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { generateToken } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const loginSchema = Joi.object({
  login: Joi.string().required(),
  password: Joi.string().required(),
})

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { login: req.body.login } })
    if (!user || user.status !== 'ENABLED') {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(req.body.password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = generateToken(user)
    res.json({
      token,
      user: { id: user.id, login: user.login, email: user.email, role: user.role, profile: user.profile },
    })
  } catch (err) { next(err) }
})

router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { authenticate } = await import('../middleware/auth.js')
    await authenticate(req, res, () => {
      res.json({ user: req.user })
    })
  } catch (err) { next(err) }
})

export default router
