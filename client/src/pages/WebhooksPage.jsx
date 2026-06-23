import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Modal, Form, Input, Switch, Tag, Typography, Space, Checkbox, message, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { api } from '../api/client'

const AVAILABLE_EVENTS = ['ticket.created', 'ticket.updated', 'ticket.assigned', 'ticket.resolved', 'ticket.closed', 'approval.responded', 'comment.added']

export default function WebhooksPage() {
  const [hooks, setHooks] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try { setHooks(await api.get('/webhooks')) }
    catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values) => {
    try {
      await api.post('/webhooks', { ...values, events: values.events || [], enabled: true })
      setModalOpen(false)
      form.resetFields()
      load()
      message.success('Webhook created')
    } catch (err) { message.error(err.message) }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/webhooks/${id}`)
      load()
      message.success('Webhook deleted')
    } catch (err) { message.error(err.message) }
  }

  const handleToggle = async (hook) => {
    try {
      await api.patch(`/webhooks/${hook.id}`, { enabled: !hook.enabled })
      load()
    } catch (err) { message.error(err.message) }
  }

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Webhooks</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Add Webhook</Button>
      </Space>

      <Modal title="New Webhook" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url', message: 'Enter a valid URL' }]} placeholder="https://hooks.example.com/vaics"><Input /></Form.Item>
          <Form.Item name="secret" label="Secret (optional)"><Input.Password /></Form.Item>
          <Form.Item name="events" label="Events">
            <Checkbox.Group>
              <Row gutter={[8, 8]}>
                {AVAILABLE_EVENTS.map(ev => <Col key={ev} span={24}><Checkbox value={ev} style={{ fontSize: 13 }}>{ev}</Checkbox></Col>)}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <Button type="primary" htmlType="submit">Create</Button>
        </Form>
      </Modal>

      <Row gutter={[16, 16]}>
        {hooks.map(hook => (
          <Col xs={24} sm={12} lg={8} key={hook.id}>
            <Card
              size="small"
              title={<Space>{hook.name} <Tag color={hook.enabled ? 'green' : 'red'}>{hook.enabled ? 'Active' : 'Disabled'}</Tag></Space>}
              extra={<Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(hook.id)} />}
              actions={[<Button size="small" onClick={() => handleToggle(hook)}>{hook.enabled ? 'Disable' : 'Enable'}</Button>]}
            >
              <Typography.Paragraph copyable style={{ fontSize: 12, marginBottom: 8 }}>{hook.url}</Typography.Paragraph>
              <Space wrap size={[4, 4]}>{(hook.events || []).map(e => <Tag key={e} style={{ fontSize: 10 }}>{e}</Tag>)}</Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
