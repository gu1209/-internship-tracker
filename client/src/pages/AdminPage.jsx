import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Popconfirm, message, Modal, Input, Card, Statistic } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import api from '../api';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleApprove = async (id, approved) => {
    try {
      await api.patch(`/admin/users/${id}/approve`, { approved });
      message.success(approved ? '已通过' : '已拒绝');
      fetchUsers();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      message.success('已删除');
      fetchUsers();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      message.error('密码至少 6 个字符');
      return;
    }
    setResetLoading(true);
    try {
      await api.patch(`/admin/users/${resetUserId}/reset-password`, { password: newPassword });
      message.success('密码已重置');
      setResetModalOpen(false);
      setNewPassword('');
    } catch (e) {
      message.error(e.response?.data?.error || '重置失败');
    } finally {
      setResetLoading(false);
    }
  };

  const pendingCount = users.filter(u => !u.approved).length;

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'approved',
      key: 'approved',
      width: 100,
      render: (approved, record) => {
        if (record.is_admin) return <Tag color="red">管理员</Tag>;
        if (approved) return <Tag color="green">已通过</Tag>;
        return <Tag color="orange">待审批</Tag>;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => {
        if (record.is_admin) return <span style={{ color: '#999' }}>—</span>;
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {!record.approved ? (
              <Button size="small" type="primary" icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id, true)}>
                通过
              </Button>
            ) : (
              <Button size="small" icon={<CloseOutlined />}
                onClick={() => handleApprove(record.id, false)}>
                拒绝
              </Button>
            )}
            <Button size="small" icon={<KeyOutlined />}
              onClick={() => { setResetUserId(record.id); setNewPassword(''); setResetModalOpen(true); }}>
              重置密码
            </Button>
            <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>用户管理</h3>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1 }}>
          <Statistic title="总用户数" value={users.length} />
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <Statistic title="待审批" value={pendingCount} valueStyle={{ color: pendingCount > 0 ? '#fa8c16' : '#52c41a' }} />
        </Card>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="middle"
      />

      <Modal
        title="重置密码"
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        onOk={handleResetPassword}
        confirmLoading={resetLoading}
      >
        <Input.Password
          placeholder="新密码（至少6位）"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          size="large"
          onPressEnter={handleResetPassword}
        />
      </Modal>
    </div>
  );
}
