import React, { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, Popconfirm, Tag, Space, Switch, Empty, Card, List } from 'antd';
import { SearchOutlined, UserAddOutlined, UserDeleteOutlined, SettingOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../api';

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [permModal, setPermModal] = useState({ open: false, friend: null });
  const [permForm] = Form.useForm();

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await api.get('/friends');
      setFriends(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFriends(); }, []);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const res = await api.get('/friends/search', { params: { username: searchText } });
      setSearchResults(res.data);
    } catch (e) {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (username) => {
    try {
      await api.post('/friends', { username });
      message.success(`已向 ${username} 发送好友请求`);
      setSearchResults([]);
      setSearchText('');
      fetchFriends();
    } catch (e) {
      message.error(e.response?.data?.error || '发送请求失败');
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.put(`/friends/${id}/accept`);
      message.success('已添加好友');
      fetchFriends();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/friends/${id}/reject`);
      message.success('已拒绝');
      fetchFriends();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`/friends/${id}`);
      message.success('已删除好友');
      fetchFriends();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const openPermissions = async (friend) => {
    try {
      const res = await api.get(`/friends/${friend.id}/permissions`);
      permForm.setFieldsValue({
        can_view_questions: !!res.data.can_view_questions,
        can_view_ratings: !!res.data.can_view_ratings,
      });
      setPermModal({ open: true, friend });
    } catch (e) {
      message.error('加载权限失败');
    }
  };

  const handleSavePermissions = async () => {
    try {
      const values = await permForm.validateFields();
      await api.put(`/friends/${permModal.friend.id}/permissions`, {
        can_view_questions: values.can_view_questions,
        can_view_ratings: values.can_view_ratings,
      });
      message.success('权限已更新');
      setPermModal({ open: false, friend: null });
    } catch (e) {
      message.error('保存失败');
    }
  };

  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.direction === 'incoming');
  const myFriends = friends.filter(f => f.status === 'accepted');
  const pendingOutgoing = friends.filter(f => f.status === 'pending' && f.direction === 'outgoing');

  return (
    <div>
      {/* Search area */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索用户名"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setSearchResults([]); }}
          onSearch={handleSearch}
          loading={searching}
          enterButton={<Button type="primary" icon={<SearchOutlined />}>查找</Button>}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <Card title="搜索结果" size="small" style={{ marginBottom: 20 }}>
          <List
            size="small"
            dataSource={searchResults}
            renderItem={item => (
              <List.Item actions={[
                <Button size="small" type="primary" icon={<UserAddOutlined />} onClick={() => handleAddFriend(item.username)}>
                  添加好友
                </Button>,
              ]}>
                <span style={{ fontWeight: 500 }}>{item.username}</span>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Pending incoming requests */}
      {pendingIncoming.length > 0 && (
        <Card title="待处理请求" size="small" style={{ marginBottom: 20, borderColor: '#F59E0B' }}>
          <List
            size="small"
            dataSource={pendingIncoming}
            renderItem={item => (
              <List.Item actions={[
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAccept(item.id)}>接受</Button>,
                <Button size="small" icon={<CloseOutlined />} onClick={() => handleReject(item.id)}>拒绝</Button>,
              ]}>
                <Tag color="orange">待验证</Tag>
                <span style={{ fontWeight: 500 }}>{item.friend_username}</span>
                <span style={{ color: '#999', marginLeft: 8 }}>请求添加你为好友</span>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* My friends */}
      <Card title="我的好友" size="small">
        {myFriends.length === 0 ? (
          <Empty description="暂无好友，搜索用户名添加好友吧" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="small"
            dataSource={myFriends}
            rowKey="id"
            loading={loading}
            pagination={false}
            columns={[
              {
                title: '用户名', dataIndex: 'friend_username', key: 'friend_username', width: 150,
                render: (name) => <span style={{ fontWeight: 500 }}>{name}</span>,
              },
              {
                title: '状态', key: 'status', width: 100,
                render: () => <Tag color="green">已添加</Tag>,
              },
              {
                title: '添加时间', dataIndex: 'created_at', key: 'created_at', width: 160,
                render: (v) => v?.slice(0, 10) || '—',
              },
              {
                title: '操作', key: 'action', width: 140,
                render: (_, record) => (
                  <Space>
                    <Button size="small" icon={<SettingOutlined />} onClick={() => openPermissions(record)}>
                      权限
                    </Button>
                    <Popconfirm title="删除好友？" onConfirm={() => handleRemove(record.id)}>
                      <Button size="small" danger icon={<UserDeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Pending outgoing */}
      {pendingOutgoing.length > 0 && (
        <Card title="已发送的请求" size="small" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={pendingOutgoing}
            renderItem={item => (
              <List.Item actions={[
                <Popconfirm title="撤回请求？" onConfirm={() => handleReject(item.id)}>
                  <Button size="small">撤回</Button>
                </Popconfirm>,
              ]}>
                <Tag color="default">等待对方确认</Tag>
                <span style={{ fontWeight: 500 }}>{item.friend_username}</span>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Permissions modal */}
      <Modal
        title={`共享权限 - ${permModal.friend?.friend_username || ''}`}
        open={permModal.open}
        onCancel={() => { setPermModal({ open: false, friend: null }); permForm.resetFields(); }}
        onOk={handleSavePermissions}
        width={420}
      >
        <Form form={permForm} layout="vertical">
          <Form.Item name="can_view_questions" label="允许查看我的面试题" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="can_view_ratings" label="允许查看我的面经评分" valuePropName="checked">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
