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
    const hooks = await prisma.webhook.findMany({ where: { organizationId: req.user.organizationId } })
    res.json(hooks)
  } catch (err) { next(err) }
})

router.post('/', requireRole('ADMIN'), validate(Joi.object({
  name: Joi.string().required(),
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).required(),
  secret: Joi.string().allow(''),
  enabled: Joi.boolean().default(true),
})), async (req, res, next) => {
  try {
    const hook = await prisma.webhook.create({
      data: {
        name: req.body.name,
        url: req.body.url,
        events: req.body.events,
        secret: req.body.secret || '',
        enabled: req.body.enabled,
        organizationId: req.user.organizationId,
      },
    })
    res.status(201).json(hook)
  } catch (err) { next(err) }
})

router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { enabled, url, events, secret } = req.body
    const updated = await prisma.webhook.updateMany({
      where: { id: Number(req.params.id), organizationId: req.user.organizationId },
      data: { enabled, url, events, secret },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.webhook.deleteMany({ where: { id: Number(req.params.id), organizationId: req.user.organizationId } })
    res.status(204).end()
  } catch (err) { next(err) }
})

// Outbound webhook notifier - called by services
export async function fireWebhooks(orgId, event, payload) {
  try {
    const hooks = await prisma.webhook.findMany({
      where: { organizationId: orgId, enabled: true, events: { has: event } },
    })

    for (const hook of hooks) {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
      const headers = { 'Content-Type': 'application/json' }
      if (hook.secret) headers['X-Webhook-Secret'] = hook.secret

      fetch(hook.url, { method: 'POST', headers, body }).catch(err => {
        console.error(`[webhook] ${hook.name} failed:`, err.message)
      })
    }
  } catch (err) {
    console.error('[webhook] fire error:', err.message)
  }
}

export default router
