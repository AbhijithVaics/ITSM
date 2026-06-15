import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadCount } from '../api/notifications'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '▦', roles: ['ADMIN', 'AGENT', 'MANAGER', 'CHANGE_MANAGER'] },
  { path: '/my-requests', label: 'My Requests', icon: '☰', roles: ['USER'] },
  { path: '/users', label: 'Users', icon: '👤', roles: ['ADMIN', 'MANAGER'] },
  { path: '/teams', label: 'Teams', icon: '▤', roles: ['ADMIN', 'MANAGER'] },
  { path: '/cmdb', label: 'CMDB', icon: '◈', roles: ['ADMIN', 'AGENT', 'MANAGER'] },
  { path: '/services', label: 'Services', icon: '⚙', roles: ['ADMIN', 'MANAGER'] },
  { path: '/contracts', label: 'Contracts', icon: '📋', roles: ['ADMIN', 'MANAGER'] },
  { path: '/audit', label: 'Audit', icon: '📝', roles: ['ADMIN', 'MANAGER'] },
  { path: '/audit', label: 'Audit', icon: '📝', roles: ['ADMIN', 'MANAGER'] },
  { path: '/email-config', label: 'Email', icon: '✉', roles: ['ADMIN'] },
  { path: '/reports', label: 'Reports', icon: '📊', roles: ['ADMIN', 'MANAGER'] },
  { path: '/webhooks', label: 'Webhooks', icon: '🔗', roles: ['ADMIN'] },
]

export function Layout() {
  const { user, logout } = useAuth()
  const role = user?.role
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getUnreadCount()
        setUnread(data.count)
      } catch {}
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = navItems.filter(i => i.roles.includes(role))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          vaics
          {unread > 0 && <span className="notif-badge">{unread}</span>}
        </div>
        <nav>
          {filtered.map(item => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-badge">
            <span className="user-avatar">{user?.profile?.firstName?.[0] || user?.login?.[0]}</span>
            <div>
              <div className="user-name">{user?.profile?.firstName} {user?.profile?.lastName}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
