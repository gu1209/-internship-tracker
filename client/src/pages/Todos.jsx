import React, { useEffect, useState } from 'react';
import { List, Button, Input, DatePicker, Select, Modal, Form, message, Tag, Popconfirm, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

export default function Todos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [apps, setApps] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedApp, setSelectedApp] = useState(null);

  const fetchApps = async () => {
    try {
      const res = await api.get('/applications', { params: { pageSize: 1000 } });
      setApps(res.data.data);
    } catch (e) { /* ignore */ }
  };

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/todos');
      setTodos(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, []);
  useEffect(() => { fetchTodos(); }, []);

  const handleToggle = async (id) => {
    try {
      await api.patch(`/todos/${id}/toggle`);
      fetchTodos();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/todos/${id}`);
      message.success('已删除');
      fetchTodos();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleAppChange = (appId) => {
    setSelectedApp(appId ? apps.find(a => a.id === appId) : null);
    // Auto-fill due_date with interview_date if available
    if (appId) {
      const app = apps.find(a => a.id === appId);
      if (app?.interview_date) {
        form.setFieldValue('due_date', dayjs(app.interview_date));
      }
    }
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/todos', {
        ...values,
        due_date: values.due_date.format('YYYY-MM-DD'),
      });
      message.success('已添加');
      setModalOpen(false);
      form.resetFields();
      setSelectedApp(null);
      fetchTodos();
    } catch (e) {
      message.error('添加失败');
    }
  };

  const isOverdue = (due_date) => {
    const today = new Date().toISOString().split('T')[0];
    return due_date < today;
  };

  const pendingTodos = todos.filter(t => !t.done);
  const completedTodos = todos.filter(t => t.done);

  const tabItems = [
    {
      key: 'pending',
      label: `待完成 (${pendingTodos.length})`,
      children: (
        <List
          loading={loading}
          dataSource={pendingTodos}
          renderItem={(item) => {
            const overdue = isOverdue(item.due_date);
            return (
              <List.Item
                actions={[
                  <Button type="text" size="small" onClick={() => handleToggle(item.id)}>完成</Button>,
                  <Popconfirm title="删除？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <div style={{ flex: 1 }}>
                  <div>
                    {item.company && <Tag color="blue">{item.company} - {item.position}</Tag>}
                    <span style={{ fontWeight: 500 }}>{item.description}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: overdue ? '#ff4d4f' : '#999' }}>
                    <CalendarOutlined /> 截止: {item.due_date} {overdue && <span style={{ color: '#ff4d4f' }}>(已过期)</span>}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      ),
    },
    {
      key: 'completed',
      label: `已完成 (${completedTodos.length})`,
      children: (
        <List
          loading={loading}
          dataSource={completedTodos}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button type="text" size="small" onClick={() => handleToggle(item.id)}>撤销</Button>,
                <Popconfirm title="删除？" onConfirm={() => handleDelete(item.id)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <div style={{ flex: 1, opacity: 0.6 }}>
                <div>
                  {item.company && <Tag color="blue">{item.company}</Tag>}
                  <span style={{ textDecoration: 'line-through' }}>{item.description}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>截止: {item.due_date}</div>
              </div>
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加待办</Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title="添加待办" open={modalOpen} onOk={handleAdd} onCancel={() => { setModalOpen(false); setSelectedApp(null); }} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="application_id" label="关联投递">
            <Select
              allowClear
              placeholder="选择关联的投递（可选），自动填充面试时间"
              options={apps.map(a => ({ value: a.id, label: `${a.company} - ${a.position}${a.interview_date ? ` (面试: ${a.interview_date})` : ''}` }))}
              onChange={handleAppChange}
            />
          </Form.Item>
          <Form.Item name="description" label="待办内容" rules={[{ required: true }]}>
            <Input placeholder="如：准备字节一面" />
          </Form.Item>
          <Form.Item name="due_date" label="截止日期" rules={[{ required: true }]} initialValue={selectedApp?.interview_date ? dayjs(selectedApp.interview_date) : dayjs().add(3, 'day')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
