import React, { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, Popconfirm, Tag, Card, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import api from '../api';

export default function ResumeVersions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/resume');
      setData(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.put(`/resume/${editing.id}`, values);
      } else {
        await api.post('/resume', values);
      }
      message.success('保存成功');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchData();
    } catch (e) {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/resume/${id}`);
      message.success('已删除');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '版本名', dataIndex: 'version_name', key: 'version_name', width: 140,
      render: (v) => <Tag color="blue"><FileTextOutlined /> {v}</Tag>,
    },
    { title: '目标岗位', dataIndex: 'target_position', key: 'target_position', width: 160 },
    {
      title: '内容', dataIndex: 'content', key: 'content',
      render: (v) => v ? <span style={{ color: '#666' }}>{v.slice(0, 100)}{v.length > 100 ? '...' : ''}</span> : '—',
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160 },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(record);
            form.setFieldsValue(record);
            setModalOpen(true);
          }} />
          <Popconfirm title="删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>简历版本管理</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null);
          form.resetFields();
          setModalOpen(true);
        }}>
          新建版本
        </Button>
      </div>

      {data.length === 0 ? (
        <Empty description="暂无简历版本" />
      ) : (
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      )}

      <Modal
        title={editing ? '编辑简历版本' : '新建简历版本'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        width={650}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="version_name" label="版本名" rules={[{ required: true }]}>
              <Input placeholder="如：前端版v2" />
            </Form.Item>
            <Form.Item name="target_position" label="目标岗位">
              <Input placeholder="如：前端开发" />
            </Form.Item>
          </div>
          <Form.Item name="content" label="简历内容">
            <Input.TextArea rows={10} placeholder="粘贴简历内容或要点..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
