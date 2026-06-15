import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding VAICS database...')

  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Default Organization', code: 'DEFAULT' },
  })

  const adminPw = await bcrypt.hash('admin123', 10)
  const agentPw = await bcrypt.hash('agent123', 10)
  const userPw = await bcrypt.hash('user123', 10)

  const admin = await prisma.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      login: 'admin',
      email: 'admin@vaics.local',
      password: adminPw,
      role: 'ADMIN',
      status: 'ENABLED',
      profile: { firstName: 'System', lastName: 'Admin' },
      organizationId: org.id,
    },
  })

  const agent = await prisma.user.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      login: 'agent1',
      email: 'agent1@vaics.local',
      password: agentPw,
      role: 'AGENT',
      status: 'ENABLED',
      profile: { firstName: 'Support', lastName: 'Agent' },
      organizationId: org.id,
    },
  })

  await prisma.user.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      login: 'user1',
      email: 'user1@vaics.local',
      password: userPw,
      role: 'USER',
      status: 'ENABLED',
      profile: { firstName: 'Regular', lastName: 'User' },
      organizationId: org.id,
    },
  })

  console.log('  Organization: DEFAULT')
  console.log('  Admin user: admin / admin123  (role: ADMIN)')
  console.log('  Agent user: agent1 / agent123 (role: AGENT)')
  console.log('  End user:   user1  / user123  (role: USER)')

  const ticketCounters = await prisma.ticketCounter.findMany()
  if (ticketCounters.length === 0) {
    const types = [
      { type: 'INCIDENT', prefix: 'INC', sequence: 0 },
      { type: 'SERVICE_REQUEST', prefix: 'SR', sequence: 0 },
      { type: 'CHANGE', prefix: 'CHG', sequence: 0 },
      { type: 'PROBLEM', prefix: 'PRB', sequence: 0 },
    ]
    await prisma.ticketCounter.createMany({ data: types })
    console.log('  Ticket counters initialized')
  }

  const service = await prisma.service.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'IT Support', description: 'General IT support services', organizationId: org.id },
  })

  await prisma.serviceSubcategory.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Hardware', description: 'Hardware issues', serviceId: service.id },
  })

  await prisma.sLA.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Standard SLA', description: 'Default SLA', organizationId: org.id },
  })

  console.log('  Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
