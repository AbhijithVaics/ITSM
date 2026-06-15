// Email-to-ticket via IMAP
// Set EMAIL_IMAP_HOST/USER/PASS in .env to enable
// Reference format: /(INC|SR|CHG|PRB)-\d{5}/  e.g. INC-00001

import { simpleParser } from 'mailparser'
import prisma from '../lib/prisma.js'
import { generateTicketRef } from './ticketRefGen.js'

let ImapClient = null
try {
  ImapClient = (await import('imap')).default
} catch {
  console.log('[email] imap not available, email-to-ticket disabled')
}

const REF_PATTERN = /(INC|SR|CHG|PRB)-\d{5}/g

let polling = false

export function isEmailEnabled() {
  return !!(process.env.EMAIL_IMAP_HOST && process.env.EMAIL_IMAP_USER)
}

export function startEmailPolling(intervalMs = 30000) {
  if (!isEmailEnabled() || !ImapClient) {
    console.log('[email] IMAP not configured, polling disabled')
    return
  }
  if (polling) return
  polling = true

  const tick = async () => {
    try {
      await pollInbox()
    } catch (err) {
      console.error('[email] poll error:', err.message)
    }
  }

  tick()
  setInterval(tick, intervalMs)
  console.log(`[email] polling every ${intervalMs}ms`)
}

async function pollInbox() {
  const imap = new ImapClient({
    user: process.env.EMAIL_IMAP_USER,
    password: process.env.EMAIL_IMAP_PASS,
    host: process.env.EMAIL_IMAP_HOST,
    port: Number(process.env.EMAIL_IMAP_PORT) || 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  })

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) { imap.end(); return reject(err) }

        const since = new Date(Date.now() - 3600000) // last 1h
        imap.search(['UNSEEN', ['SINCE', since.toISOString()]], (err2, results) => {
          if (err2 || !results?.length) { imap.end(); return resolve() }

          const fetch = imap.fetch(results, { bodies: '' })
          fetch.on('message', (msg) => {
            msg.on('body', async (stream) => {
              try {
                const parsed = await simpleParser(stream)
                await processEmail(parsed)
              } catch (e) {
                console.error('[email] process error:', e.message)
              }
            })
          })
          fetch.once('end', () => { imap.end(); resolve() })
        })
      })
    })
    imap.once('error', reject)
    imap.connect()
  })
}

async function processEmail(parsed) {
  const from = parsed.from?.value?.[0]?.address
  const subject = parsed.subject || ''
  const text = parsed.text || ''
  const body = `${subject}\n${text}`

  const refs = [...body.matchAll(REF_PATTERN)].map(m => m[0])
  if (refs.length > 0) {
    // Update existing ticket - add comment
    for (const ref of refs) {
      const ticket = await prisma.ticket.findUnique({ where: { ref } })
      if (ticket) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: 1, // System user
            text: `[Email from ${from}]\n${text}`,
            type: 'public',
          },
        })
        console.log(`[email] added comment to ${ref}`)
      }
    }
  } else {
    // No ref found → create new ticket
    const user = await prisma.user.findFirst({
      where: { email: from },
    })
    const orgId = user?.organizationId || 1

    // Determine type from subject
    const type = detectType(subject)
    const ref = await generateTicketRef(type, orgId)

    await prisma.ticket.create({
      data: {
        ref,
        type,
        title: subject.slice(0, 255),
        description: text,
        status: 'new',
        organizationId: orgId,
        createdById: user?.id || 1,
      },
    })
    console.log(`[email] created ${ref} from ${from}`)
  }
}

function detectType(subject) {
  const upper = subject.toUpperCase()
  if (upper.includes('INCIDENT')) return 'INCIDENT'
  if (upper.includes('REQUEST') || upper.includes('SERVICE')) return 'SERVICE_REQUEST'
  if (upper.includes('CHANGE') || upper.includes('CHG')) return 'CHANGE'
  if (upper.includes('PROBLEM')) return 'PROBLEM'
  return 'INCIDENT'
}
