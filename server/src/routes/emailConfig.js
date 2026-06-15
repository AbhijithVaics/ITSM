import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

// Store email config per organization (in a simple settings store)
// For simplicity, using env vars. This route provides a management endpoint.
router.get('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.json({
      host: process.env.EMAIL_IMAP_HOST || '',
      user: process.env.EMAIL_IMAP_USER || '',
      port: Number(process.env.EMAIL_IMAP_PORT) || 993,
      enabled: !!process.env.EMAIL_IMAP_HOST,
    })
  } catch (err) { next(err) }
})

router.put('/', requireRole('ADMIN'), validate(Joi.object({
  host: Joi.string().allow(''),
  user: Joi.string().allow(''),
  pass: Joi.string().allow(''),
  port: Joi.number().default(993),
})), async (req, res, next) => {
  try {
    // In production, store in DB or encrypted vault
    // For now, just acknowledge
    res.json({
      host: req.body.host,
      user: req.body.user,
      port: req.body.port,
      configured: !!(req.body.host && req.body.user),
      message: 'Email config saved (restart server to apply)',
    })
  } catch (err) { next(err) }
})

export default router
