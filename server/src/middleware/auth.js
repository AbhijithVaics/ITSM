import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'vaics-dev-secret-change-in-production'

export function generateToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, orgId: user.organizationId },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, login: true, email: true, role: true, status: true, organizationId: true, profile: true },
    })
    if (!user || user.status !== 'ENABLED') {
      return res.status(401).json({ error: 'User not found or disabled' })
    }
    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
