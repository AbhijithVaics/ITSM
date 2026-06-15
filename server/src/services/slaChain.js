import prisma from '../lib/prisma.js'
import { addBusinessMinutes } from './slaCalculator.js'

export async function resolveSlaDeadlines(ticket) {
  // Lookup chain: Ticket → Service → CustomerContract → SLA → SLATargets
  if (!ticket.serviceId) return { tto: null, ttr: null }

  const contractLink = await prisma.contractToService.findFirst({
    where: { serviceId: ticket.serviceId },
    include: {
      sla: {
        include: { targets: true },
      },
      contract: true,
    },
  })

  if (!contractLink?.sla) return { tto: null, ttr: null }

  const sla = contractLink.sla
  const wd = sla.workingDays
  const sh = sla.startHour
  const eh = sla.endHour
  const priority = ticket.priority

  const targets = sla.targets.filter(t => t.priority === priority)
  const ttoTarget = targets.find(t => t.metric === 'TTO')
  const ttrTarget = targets.find(t => t.metric === 'TTR')

  const createdAt = new Date(ticket.createdAt)

  return {
    tto: ttoTarget ? addBusinessMinutes(createdAt, ttoTarget.value, wd, sh, eh) : null,
    ttr: ttrTarget ? addBusinessMinutes(createdAt, ttrTarget.value, wd, sh, eh) : null,
  }
}
