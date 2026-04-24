import React, { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, Select, Popconfirm, Tag, Card, Rate, InputNumber, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';

const TYPE_OPTIONS = ['算法', '八股', '场景', 'HR', '项目', '系统设计', '语言基础', '其他'];
const SOURCE_OPTIONS = ['一面', '二面', '三面', 'HR面', '总监面', '终面', '笔试'];
const TYPE_COLORS = { 算法: 'red', 八股: 'orange', 场景: 'blue', HR: 'green', 项目: 'purple', '系统设计': 'cyan', '语言基础': 'lime' };

export default function InterviewQuestions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [companyFilter, setCompanyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (companyFilter) params.company = companyFilter;
      if (typeFilter) params.type = typeFilter;
      if (search) params.search = search;
      const res = await api.get('/questions', { params });
      setData(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [companyFilter, typeFilter]);

  const handleSearch = () => fetchData();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const tags = (values.tags || []).join(',');
      if (editing) {
        await api.put(`/questions/${editing.id}`, { ...values, tags });
      } else {
        await api.post('/questions', { ...values, tags });
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
      await api.delete(`/questions/${id}`);
      message.success('已删除');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '类型', dataIndex: 'question_type', key: 'question_type', width: 80,
      render: (t) => t ? <Tag color={TYPE_COLORS[t] || 'default'}>{t}</Tag> : '—',
    },
    { title: '公司', dataIndex: 'company', key: 'company', width: 100 },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 120 },
    {
      title: '题目', dataIndex: 'question', key: 'question',
      render: (v) => v ? <span>{v.slice(0, 80)}{v.length > 80 ? '...' : ''}</span> : '—',
    },
    {
      title: '难度', dataIndex: 'difficulty', key: 'difficulty', width: 100,
      render: (d) => <Rate disabled defaultValue={d} count={5} style={{ fontSize: 12 }} />,
    },
    {
      title: '来源', dataIndex: 'source', key: 'source', width: 80,
      render: (s) => s ? <Tag>{s}</Tag> : '—',
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 140,
      render: (t) => t ? t.split(',').filter(Boolean).map(tag => <Tag key={tag} style={{ marginBottom: 2 }}>{tag}</Tag>) : '—',
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(record);
            form.setFieldsValue({
              ...record,
              tags: record.tags ? record.tags.split(',') : [],
            });
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>面试题库</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <Input.Search placeholder="搜索题目/答案" value={search} onChange={e => setSearch(e.target.value)} onSearch={handleSearch} style={{ width: 200 }} allowClear />
          <Select placeholder="公司" value={companyFilter || undefined} onChange={v => setCompanyFilter(v || '')} allowClear style={{ width: 120 }} />
          <Select placeholder="类型" value={typeFilter || undefined} onChange={v => setTypeFilter(v || '')} allowClear style={{ width: 100 }} options={TYPE_OPTIONS.map(t => ({ value: t, label: t }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null);
            form.resetFields();
            setModalOpen(true);
          }}>
            添加题目
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <Empty description="暂无面试题目" />
      ) : (
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />
      )}

      <Modal
        title={editing ? '编辑题目' : '添加题目'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        width={650}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="company" label="公司">
              <Input placeholder="公司名称" />
            </Form.Item>
            <Form.Item name="position" label="岗位">
              <Input placeholder="岗位名称" />
            </Form.Item>
            <Form.Item name="source" label="面试轮次">
              <Select options={SOURCE_OPTIONS.map(s => ({ value: s, label: s }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="question_type" label="题目类型">
              <Select options={TYPE_OPTIONS.map(t => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="difficulty" label="难度">
              <Rate />
            </Form.Item>
            <Form.Item name="interview_date" label="面试日期">
              <Input type="date" />
            </Form.Item>
          </div>
          <Form.Item name="question" label="题目" rules={[{ required: true, message: '题目不能为空' }]}>
            <Input.TextArea rows={3} placeholder="题目描述..." />
          </Form.Item>
          <Form.Item name="answer" label="我的答案">
            <Input.TextArea rows={4} placeholder="记录答案或思路..." />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签回车添加" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
