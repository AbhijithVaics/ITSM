import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { errorHandler } from './middleware/errorHandler.js'

import authRoutes from './routes/auth.js'
import ticketRoutes from './routes/tickets.js'
import commentRoutes from './routes/comments.js'
import approvalRoutes from './routes/approvals.js'
import workOrderRoutes from './routes/workOrders.js'
import ciRoutes from './routes/ci.js'
import userRoutes from './routes/users.js'
import teamRoutes from './routes/teams.js'
import serviceRoutes from './routes/services.js'
import slaRoutes from './routes/sla.js'
import auditRoutes from './routes/audit.js'
import statsRoutes from './routes/stats.js'
import notificationRoutes from './routes/notifications.js'
import contractRoutes from './routes/contracts.js'
import emailConfigRoutes from './routes/emailConfig.js'
import reportRoutes from './routes/reports.js'
import webhookRoutes from './routes/webhooks.js'
import { startEmailPolling } from './services/emailInbound.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(helmet())
app.use(cors())
app.use(morgan('short'))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/work-orders', workOrderRoutes)
app.use('/api/ci', ciRoutes)
app.use('/api/users', userRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/slas', slaRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/contracts', contractRoutes)
app.use('/api/email-config', emailConfigRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/webhooks', webhookRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[vaics] server running on http://localhost:${PORT}`)
  startEmailPolling()
})

export default app
