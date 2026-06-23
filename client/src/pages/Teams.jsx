import { useState, useEffect } from 'react'
import { Card, Row, Col, Button, Modal, Form, Input, Select, Tag, List, Typography, Space, message } from 'antd'
import { PlusOutlined, MinusOutlined, UserAddOutlined } from '@ant-design/icons'
import { listTeams, createTeam, addTeamMember, removeTeamMember } from '../api/teams'
import { listUsers } from '../api/users'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [memberModal, setMemberModal] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    listTeams().then(setTeams).catch(console.error)
    listUsers().then(setUsers).catch(console.error)
  }, [])

  const handleCreate = async (values) => {
    try {
      await createTeam(values)
      setModalOpen(false)
      form.resetFields()
      setTeams(await listTeams())
      message.success('Team created')
    } catch (err) { message.error(err.message) }
  }

  const handleAddMember = async (teamId) => {
    const userId = memberModal.userId
    if (!userId) return
    try {
      await addTeamMember(teamId, userId)
      setMemberModal(null)
      setTeams(await listTeams())
      message.success('Member added')
    } catch (err) { message.error(err.message) }
  }

  const handleRemoveMember = async (teamId, userId) => {
    try {
      await removeTeamMember(teamId, userId)
      setTeams(await listTeams())
      message.success('Member removed')
    } catch (err) { message.error(err.message) }
  }

  return (
    <div>
      <Space style={{ marginBottom: 24, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Teams</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>New Team</Button>
      </Space>

      <Modal title="New Team" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="type" label="Type" initialValue="SUPPORT">
            <Select>
              <Select.Option value="SUPPORT">Support</Select.Option>
              <Select.Option value="CHANGE_ADVISORY">Change Advisory</Select.Option>
              <Select.Option value="MANAGEMENT">Management</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit">Create</Button>
        </Form>
      </Modal>

      <Modal title="Add Member" open={!!memberModal} onCancel={() => setMemberModal(null)} onOk={() => handleAddMember(memberModal?.teamId)}>
        <Select style={{ width: '100%' }} placeholder="Select user" onChange={v => setMemberModal({ ...memberModal, userId: v })}>
          {users.map(u => <Select.Option key={u.id} value={u.id}>{u.profile?.firstName || u.login} ({u.role})</Select.Option>)}
        </Select>
      </Modal>

      <Row gutter={[16, 16]}>
        {teams.map(team => (
          <Col xs={24} sm={12} lg={8} key={team.id}>
            <Card title={team.name} extra={<Tag>{team.type}</Tag>} size="small" actions={[
              <Button type="link" icon={<UserAddOutlined />} onClick={() => setMemberModal({ teamId: team.id, userId: null })}>Add Member</Button>,
            ]}>
              <Typography.Paragraph type="secondary">{team.description}</Typography.Paragraph>
              <Typography.Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Members</Typography.Text>
              <List size="small" dataSource={team.members || []} renderItem={m => (
                <List.Item actions={[<Button type="text" size="small" danger icon={<MinusOutlined />} onClick={() => handleRemoveMember(team.id, m.userId)} />]}>
                  <List.Item.Meta title={m.user?.profile?.firstName || m.user?.login} description={m.role} />
                </List.Item>
              )} />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
