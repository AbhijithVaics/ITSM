import { Router } from 'express'
import Joi from 'joi'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { ticket: { select: { ref: true } } },
    })
    res.json(notifications)
  } catch (err) { next(err) }
})

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    })
    res.json({ count })
  } catch (err) { next(err) }
})

router.patch('/:id/read', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: Number(req.params.id), userId: req.user.id },
      data: { read: true },
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

router.patch('/read-all', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

export async function createNotification({ userId, type, title, message, ticketId }) {
  return prisma.notification.create({ data: { userId, type, title, message, ticketId } })
}

export default router
