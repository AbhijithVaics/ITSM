import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, Typography, message, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { listUsers, createUser, updateUser } from '../api/users'
import { useAuth } from '../contexts/AuthContext'

export default function Users() {
  const [users, setUsers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const load = useCallback(async () => {
    try { setUsers(await listUsers()) } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values) => {
    setLoading(true)
    try {
      await createUser(values)
      setModalOpen(false)
      form.resetFields()
      load()
      message.success('User created')
    } catch (err) { message.error(err.message) } finally { setLoading(false) }
  }

  const handleToggleStatus = async (u) => {
    const newStatus = u.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
    try {
      await updateUser(u.id, { status: newStatus })
      load()
      message.success(`User ${newStatus === 'ENABLED' ? 'enabled' : 'disabled'}`)
    } catch (err) { message.error(err.message) }
  }

  if (user?.role === 'MANAGER') return <Typography.Text type="secondary">User management restricted to Admins.</Typography.Text>

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Users</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Add User</Button>
      </Space>

      <Modal title="Create User" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="login" label="Login" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="USER">
            <Select>
              <Select.Option value="USER">User</Select.Option>
              <Select.Option value="AGENT">Agent</Select.Option>
              <Select.Option value="MANAGER">Manager</Select.Option>
              <Select.Option value="CHANGE_MANAGER">Change Manager</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
              <Select.Option value="READ_ONLY">Read Only</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 8 }}>Create</Button>
        </Form>
      </Modal>

      <Table
        dataSource={users}
        rowKey="id"
        columns={[
          { title: 'Login', dataIndex: 'login' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Role', dataIndex: 'role', render: v => <Tag>{v}</Tag> },
          { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'ENABLED' ? 'green' : 'red'}>{v}</Tag> },
          { title: 'Actions', render: (_, u) => (
            <Button size="small" onClick={() => handleToggleStatus(u)}>{u.status === 'ENABLED' ? 'Disable' : 'Enable'}</Button>
          )},
        ]}
        pagination={false}
        size="middle"
      />
    </div>
  )
}
