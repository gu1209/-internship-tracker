import React, { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, Input, Tag, List, Popconfirm, message, Empty, Space, Switch, Table } from 'antd';
import { PlusOutlined, LinkOutlined, SettingOutlined, DeleteOutlined, UserDeleteOutlined, TeamOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../api';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [detailModal, setDetailModal] = useState({ open: false, group: null });
  const [detailLoading, setDetailLoading] = useState(false);
  const [permModal, setPermModal] = useState({ open: false, groupId: null });
  const [permForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const res = await api.post('/groups', values);
      message.success('群组创建成功');
      setCreateModal(false);
      createForm.resetFields();
      fetchGroups();
    } catch (e) {
      message.error(e.response?.data?.error || '创建失败');
    }
  };

  const handleJoin = async () => {
    if (!joinToken.trim()) {
      message.error('请输入邀请链接或Token');
      return;
    }
    try {
      // Extract token from URL if full URL is pasted
      let token = joinToken.trim();
      const match = token.match(/\/groups\/join\/(\w+)/);
      if (match) token = match[1];

      const res = await api.post(`/groups/join/${token}`);
      message.success(`已加入群组: ${res.data.group_name}`);
      setJoinModal(false);
      setJoinToken('');
      fetchGroups();
    } catch (e) {
      message.error(e.response?.data?.error || '加入失败');
    }
  };

  const openDetail = async (groupId) => {
    setDetailModal({ open: true, group: null });
    setDetailLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}`);
      setDetailModal({ open: true, group: res.data });
    } catch (e) {
      message.error('加载群组详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRemoveMember = async (groupId, userId) => {
    try {
      await api.delete(`/groups/${groupId}/members/${userId}`);
      message.success('已移除成员');
      openDetail(groupId);
      fetchGroups();
    } catch (e) {
      message.error(e.response?.data?.error || '移除失败');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      await api.delete(`/groups/${groupId}`);
      message.success('群组已删除');
      setDetailModal({ open: false, group: null });
      fetchGroups();
    } catch (e) {
      message.error(e.response?.data?.error || '删除失败');
    }
  };

  const openPermissions = async (groupId) => {
    try {
      const res = await api.get(`/groups/${groupId}/permissions`);
      permForm.setFieldsValue({
        can_view_questions: !!res.data.can_view_questions,
        can_view_ratings: !!res.data.can_view_ratings,
      });
      setPermModal({ open: true, groupId });
    } catch (e) {
      message.error('加载权限失败');
    }
  };

  const handleSavePermissions = async () => {
    try {
      const values = await permForm.validateFields();
      await api.put(`/groups/${permModal.groupId}/permissions`, {
        can_view_questions: values.can_view_questions,
        can_view_ratings: values.can_view_ratings,
      });
      message.success('权限已更新');
      setPermModal({ open: false, groupId: null });
    } catch (e) {
      message.error('保存失败');
    }
  };

  const copyInviteLink = (token) => {
    const url = `${window.location.origin}/groups/join/${token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => message.success('已复制邀请链接'));
    } else {
      message.info(`请复制: ${url}`);
    }
  };

  const memberColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 80,
      render: (r) => <Tag color={r === 'owner' ? 'orange' : 'default'}>{r === 'owner' ? '群主' : '成员'}</Tag>,
    },
    {
      title: '加入时间', dataIndex: 'joined_at', key: 'joined_at', width: 120,
      render: (v) => v?.slice(0, 10) || '—',
    },
  ];

  return (
    <div>
      {/* Top actions */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateModal(true); }}>
          创建群组
        </Button>
        <Button icon={<LinkOutlined />} onClick={() => { setJoinToken(''); setJoinModal(true); }}>
          加入群组
        </Button>
      </div>

      {/* Group cards */}
      {groups.length === 0 ? (
        <Empty description="暂无群组，创建一个开始共享吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3 }}
          dataSource={groups}
          loading={loading}
          renderItem={(item) => (
            <List.Item>
              <Card
                size="small"
                title={<><TeamOutlined /> {item.name}</>}
                extra={<Tag color={item.role === 'owner' ? 'orange' : 'default'}>{item.role === 'owner' ? '群主' : '成员'}</Tag>}
                hoverable
                onClick={() => openDetail(item.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ color: '#999', fontSize: 13 }}>{item.member_count} 名成员</div>
                {item.description && <div style={{ marginTop: 8, fontSize: 13 }}>{item.description}</div>}
              </Card>
            </List.Item>
          )}
        />
      )}

      {/* Create group modal */}
      <Modal
        title="创建群组"
        open={createModal}
        onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
        onOk={handleCreate}
        width={420}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="群组名称" rules={[{ required: true, message: '请输入群组名称' }]}>
            <Input placeholder="如：秋招互助群" />
          </Form.Item>
          <Form.Item name="description" label="群组描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Join group modal */}
      <Modal
        title="加入群组"
        open={joinModal}
        onCancel={() => { setJoinModal(false); setJoinToken(''); }}
        onOk={handleJoin}
        width={420}
      >
        <Input
          placeholder="粘贴邀请链接或Token"
          value={joinToken}
          onChange={e => setJoinToken(e.target.value)}
          prefix={<LinkOutlined />}
        />
      </Modal>

      {/* Group detail modal */}
      <Modal
        title={detailModal.group?.name || '群组详情'}
        open={detailModal.open}
        onCancel={() => { setDetailModal({ open: false, group: null }); }}
        footer={null}
        width={600}
      >
        {detailLoading ? (
          <Empty description="加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : detailModal.group && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag>{detailModal.group.members?.length || 0} 名成员</Tag>
              {detailModal.group.description && <Tag>{detailModal.group.description}</Tag>}
            </div>

            {/* Invite link */}
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-warm)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>邀请链接</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
                  {window.location.origin}/groups/join/{detailModal.group.invite_token}
                </span>
                <Button size="small" icon={<CopyOutlined />} onClick={() => copyInviteLink(detailModal.group.invite_token)}>
                  复制
                </Button>
              </div>
            </div>

            {/* My permissions */}
            <div style={{ marginBottom: 16 }}>
              <Button size="small" icon={<SettingOutlined />} onClick={() => openPermissions(detailModal.group.id)}>
                我的共享权限
              </Button>
              {detailModal.group.my_permissions && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                  面试题: {detailModal.group.my_permissions.can_view_questions ? '开' : '关'} ·
                  面经评分: {detailModal.group.my_permissions.can_view_ratings ? '开' : '关'}
                </span>
              )}
            </div>

            {/* Members table */}
            <Table
              size="small"
              dataSource={detailModal.group.members || []}
              rowKey="membership_id"
              columns={[
                ...memberColumns,
                {
                  title: '操作', key: 'action', width: 80,
                  render: (_, member) => (
                    detailModal.group.owner_id === member.user_id
                      ? <Tag color="orange">群主</Tag>
                      : detailModal.group.owner_id === detailModal.group.members?.find(m => m.role === 'owner')?.user_id
                        ? (
                          <Popconfirm title="移除该成员？" onConfirm={() => handleRemoveMember(detailModal.group.id, member.user_id)}>
                            <Button size="small" danger icon={<UserDeleteOutlined />} />
                          </Popconfirm>
                        )
                        : null
                  ),
                },
              ]}
              pagination={false}
            />

            {/* Delete group (owner only) */}
            {detailModal.group.owner_id === detailModal.group.members?.find(m => m.role === 'owner')?.user_id && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Popconfirm title="删除群组？此操作不可撤销" onConfirm={() => handleDeleteGroup(detailModal.group.id)}>
                  <Button danger size="small" icon={<DeleteOutlined />}>删除群组</Button>
                </Popconfirm>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Permissions modal */}
      <Modal
        title="群组共享权限"
        open={permModal.open}
        onCancel={() => { setPermModal({ open: false, groupId: null }); permForm.resetFields(); }}
        onOk={handleSavePermissions}
        width={420}
      >
        <Form form={permForm} layout="vertical">
          <Form.Item name="can_view_questions" label="允许群组成员查看我的面试题" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="can_view_ratings" label="允许群组成员查看我的面经评分" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
