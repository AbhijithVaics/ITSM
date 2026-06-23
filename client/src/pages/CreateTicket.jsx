import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Typography, message } from 'antd'
import { createTicket } from '../api/tickets'

export default function CreateTicket() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const ticket = await createTicket(values)
      message.success(`Ticket ${ticket.ref} created`)
      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>New Ticket</Typography.Title>
      <Card>
        <Form layout="vertical" form={form} onFinish={handleSubmit} initialValues={{ type: 'INCIDENT', impact: 2, urgency: 3 }}>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="INCIDENT">Incident</Select.Option>
              <Select.Option value="SERVICE_REQUEST">Service Request</Select.Option>
              <Select.Option value="CHANGE">Change</Select.Option>
              <Select.Option value="PROBLEM">Problem</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true, min: 3 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="impact" label="Impact">
            <Select>
              <Select.Option value={1}>Department</Select.Option>
              <Select.Option value={2}>Service</Select.Option>
              <Select.Option value={3}>Person</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="urgency" label="Urgency">
            <Select>
              <Select.Option value={1}>Critical</Select.Option>
              <Select.Option value={2}>High</Select.Option>
              <Select.Option value={3}>Medium</Select.Option>
              <Select.Option value={4}>Low</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>Create Ticket</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
