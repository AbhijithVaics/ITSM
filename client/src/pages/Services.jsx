import { useState, useEffect } from 'react'
import { Card, Row, Col, Button, Modal, Form, Input, Tag, Typography, Space, List, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { listServices, createService } from '../api/services'

export default function Services() {
  const [services, setServices] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    listServices().then(setServices).catch(console.error)
  }, [])

  const handleCreate = async (values) => {
    try {
      await createService(values)
      setModalOpen(false)
      form.resetFields()
      setServices(await listServices())
      message.success('Service created')
    } catch (err) { message.error(err.message) }
  }

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Service Catalog</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Add Service</Button>
      </Space>

      <Modal title="New Service" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Button type="primary" htmlType="submit">Create</Button>
        </Form>
      </Modal>

      <Row gutter={[16, 16]}>
        {services.map(s => (
          <Col xs={24} sm={12} lg={8} key={s.id}>
            <Card title={s.name} size="small" bodyStyle={{ paddingTop: 8 }}>
              <Typography.Paragraph type="secondary">{s.description}</Typography.Paragraph>
              {s.subcategories?.length > 0 && (
                <>
                  <Typography.Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Subcategories</Typography.Text>
                  <List size="small" dataSource={s.subcategories} renderItem={sub => <List.Item>{sub.name}</List.Item>} />
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
