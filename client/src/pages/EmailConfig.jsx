import { useState, useEffect } from 'react'
import { Card, Form, Input, InputNumber, Button, Typography, message } from 'antd'
import { api } from '../api/client'

export default function EmailConfig() {
  const [form] = Form.useForm()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/email-config').then(data => form.setFieldsValue(data)).catch(console.error)
  }, [form])

  const handleSave = async (values) => {
    try {
      await api.put('/email-config', values)
      setSaved(true)
      message.success('Config saved. Restart server to apply.')
      setTimeout(() => setSaved(false), 4000)
    } catch (err) { message.error(err.message) }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Email Configuration</Typography.Title>
      <Card>
        <Form layout="vertical" form={form} onFinish={handleSave}>
          <Form.Item name="host" label="IMAP Host" rules={[{ required: true }]}>
            <Input placeholder="imap.example.com" />
          </Form.Item>
          <Form.Item name="user" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pass" label="Password">
            <Input.Password />
          </Form.Item>
          <Form.Item name="port" label="Port" initialValue={993}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save</Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
          Emails to <Typography.Text code>support@yourdomain.com</Typography.Text> will be parsed for ticket refs <Typography.Text code>INC-xxxxx</Typography.Text>, <Typography.Text code>SR-xxxxx</Typography.Text>, etc. Without a ref, a new ticket is created from the email subject/body.
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
