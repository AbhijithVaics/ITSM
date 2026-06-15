export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` })
    }
    next()
  }
}

export function requireOrgAccess(req, res, next) {
  const targetOrgId = req.params.orgId || req.body.organizationId
  if (targetOrgId && Number(targetOrgId) !== req.user.organizationId) {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Cross-organization access denied' })
    }
  }
  next()
}
