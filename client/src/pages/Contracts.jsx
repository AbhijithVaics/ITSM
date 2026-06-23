import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Button, Modal, Form, Input, DatePicker, Tag, Typography, Space, List, Select, message } from 'antd'
import { PlusOutlined, LinkOutlined } from '@ant-design/icons'
import { api } from '../api/client'

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [services, setServices] = useState([])
  const [slas, setSlas] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [linkModal, setLinkModal] = useState(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const [c, sv, sl] = await Promise.all([
        api.get('/contracts'),
        api.get('/services'),
        api.get('/slas'),
      ])
      setContracts(c)
      setServices(sv)
      setSlas(sl)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values) => {
    try {
      await api.post('/contracts', { ...values, startDate: values.dateRange?.[0]?.toISOString(), endDate: values.dateRange?.[1]?.toISOString() })
      setModalOpen(false)
      form.resetFields()
      load()
      message.success('Contract created')
    } catch (err) { message.error(err.message) }
  }

  const handleLinkService = async () => {
    if (!linkModal) return
    try {
      await api.post(`/contracts/${linkModal.contractId}/link-service`, { serviceId: linkModal.serviceId, slaId: linkModal.slaId })
      setLinkModal(null)
      load()
      message.success('Service linked')
    } catch (err) { message.error(err.message) }
  }

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Customer Contracts</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New Contract</Button>
      </Space>

      <Modal title="New Contract" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="dateRange" label="Period"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
          <Button type="primary" htmlType="submit">Create</Button>
        </Form>
      </Modal>

      <Modal title="Link Service/SLA" open={!!linkModal} onCancel={() => setLinkModal(null)} onOk={handleLinkService}>
        <Form layout="vertical">
          <Form.Item label="Service">
            <Select placeholder="Select service" onChange={v => setLinkModal({ ...linkModal, serviceId: v })}>
              {services.map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="SLA">
            <Select placeholder="Select SLA" onChange={v => setLinkModal({ ...linkModal, slaId: v })}>
              {slas.map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Row gutter={[16, 16]}>
        {contracts.map(c => (
          <Col xs={24} sm={12} lg={8} key={c.id}>
            <Card title={c.name} size="small" actions={[<Button type="link" icon={<LinkOutlined />} onClick={() => setLinkModal({ contractId: c.id, serviceId: null, slaId: null })}>Link Service</Button>]}>
              <Typography.Paragraph type="secondary">{c.description}</Typography.Paragraph>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                {new Date(c.startDate).toLocaleDateString()}{c.endDate && <> — {new Date(c.endDate).toLocaleDateString()}</>}
              </Typography.Text>
              {c.serviceLinks?.length > 0 && (
                <List size="small" dataSource={c.serviceLinks} renderItem={l => <List.Item>{l.service?.name} → <Tag>{l.sla?.name}</Tag></List.Item>} />
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
