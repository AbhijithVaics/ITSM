export function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err)

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Resource already exists' })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Resource not found' })
    return res.status(400).json({ error: 'Database constraint violation' })
  }

  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({ error: 'Invalid data provided' })
  }

  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'
  res.status(status).json({ error: message })
}
