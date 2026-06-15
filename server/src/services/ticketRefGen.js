import prisma from '../lib/prisma.js'

const REF_PREFIX = {
  INCIDENT: 'INC',
  SERVICE_REQUEST: 'SR',
  CHANGE: 'CHG',
  PROBLEM: 'PRB',
}

export async function generateTicketRef(type, organizationId) {
  const prefix = REF_PREFIX[type]
  if (!prefix) throw new Error(`Unknown ticket type: ${type}`)

  const counter = await prisma.ticketCounter.upsert({
    where: { type },
    create: { type, prefix, sequence: 1 },
    update: { sequence: { increment: 1 } },
  })

  const seq = String(counter.sequence).padStart(5, '0')
  return `${prefix}-${seq}`
}
