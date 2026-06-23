import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async ({ login: l, password }) => {
    setError('')
    setLoading(true)
    try {
      const user = await login(l, password)
      navigate(user.role === 'USER' ? '/my-requests' : '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e17', backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(79,140,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(46,213,115,0.05) 0%, transparent 60%)' }}>
      <Card style={{ width: 380, backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography.Title level={3} style={{ marginBottom: 4, color: '#4f8cff' }}>vaics</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>ITSM Platform</Typography.Text>
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item name="login" rules={[{ required: true, message: 'Enter username' }]}>
            <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Enter password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Sign In</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
