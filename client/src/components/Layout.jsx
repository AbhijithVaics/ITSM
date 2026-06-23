import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Badge, Typography } from 'antd'
import {
  DashboardOutlined, UserOutlined, TeamOutlined, AppstoreOutlined,
  SettingOutlined, FileTextOutlined, AuditOutlined, MailOutlined,
  BarChartOutlined, LinkOutlined, LogoutOutlined, BellOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadCount } from '../api/notifications'

const { Sider, Content, Header } = AntLayout

const navItems = [
  { path: '/', label: 'Dashboard', icon: <DashboardOutlined />, roles: ['ADMIN', 'AGENT', 'MANAGER', 'CHANGE_MANAGER'] },
  { path: '/my-requests', label: 'My Requests', icon: <FileTextOutlined />, roles: ['USER'] },
  { path: '/users', label: 'Users', icon: <UserOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/teams', label: 'Teams', icon: <TeamOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/cmdb', label: 'CMDB', icon: <AppstoreOutlined />, roles: ['ADMIN', 'AGENT', 'MANAGER'] },
  { path: '/services', label: 'Services', icon: <SettingOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/contracts', label: 'Contracts', icon: <ProjectOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/audit', label: 'Audit', icon: <AuditOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/email-config', label: 'Email', icon: <MailOutlined />, roles: ['ADMIN'] },
  { path: '/reports', label: 'Reports', icon: <BarChartOutlined />, roles: ['ADMIN', 'MANAGER'] },
  { path: '/webhooks', label: 'Webhooks', icon: <LinkOutlined />, roles: ['ADMIN'] },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = user?.role
  const [unread, setUnread] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try { setUnread((await getUnreadCount()).count) } catch {}
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = navItems.filter(i => i.roles.includes(role))

  const menuItems = filtered.map(i => ({
    key: i.path,
    icon: i.icon,
    label: i.label,
  }))

  const userMenu = {
    items: [
      { key: 'profile', label: `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`, disabled: true },
      { type: 'divider' },
      { key: 'role', label: `Role: ${user?.role}`, disabled: true },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout() },
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24, padding: '0 16px' }}>
          <Typography.Title level={collapsed ? 5 : 4} style={{ color: '#4f8cff', margin: 0 }}>
            {collapsed ? 'V' : 'vaics'}
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 16px' }}>
          <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#4f8cff', flexShrink: 0 }} />
              {!collapsed && (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.profile?.firstName || user?.login}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{user?.role}</div>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </Sider>
      <AntLayout>
        <Header style={{ background: 'rgba(18,25,45,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          <Badge count={unread} size="small" offset={[-2, 2]}>
            <BellOutlined style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)' }} />
          </Badge>
        </Header>
        <Content style={{ padding: '24px 32px', overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
