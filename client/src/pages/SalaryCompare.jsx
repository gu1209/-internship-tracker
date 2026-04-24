import React, { useEffect, useState } from 'react';
import { Table, Button, message, Modal, Form, Input, InputNumber, Popconfirm, Tag, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api';

export default function SalaryCompare() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/salary');
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
        await api.put(`/salary/${editing.id}`, values);
      } else {
        await api.post('/salary', values);
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
      await api.delete(`/salary/${id}`);
      message.success('已删除');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '公司', dataIndex: 'company', key: 'company', width: 120, fixed: 'left' },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 140 },
    { title: '月薪', dataIndex: 'base_salary', key: 'base_salary', width: 90, render: v => v ? `¥${v}` : '—' },
    { title: '年终奖', dataIndex: 'bonus', key: 'bonus', width: 90, render: v => v ? `¥${v}` : '—' },
    { title: '股票', dataIndex: 'stock', key: 'stock', width: 90, render: v => v ? `¥${v}` : '—' },
    { title: '签字费', dataIndex: 'signing_bonus', key: 'signing_bonus', width: 90, render: v => v ? `¥${v}` : '—' },
    { title: '餐补', dataIndex: 'allowance_meal', key: 'allowance_meal', width: 80, render: v => v ? `¥${v}` : '—' },
    { title: '房补', dataIndex: 'allowance_housing', key: 'allowance_housing', width: 80, render: v => v ? `¥${v}` : '—' },
    {
      title: '总包', dataIndex: 'total_package', key: 'total_package', width: 110,
      render: v => v ? <Tag color="green">¥{v}</Tag> : '—',
    },
    { title: '日工时', dataIndex: 'work_hours', key: 'work_hours', width: 80, render: v => v ? `${v}h` : '—' },
    { title: '通勤', dataIndex: 'commute_minutes', key: 'commute_minutes', width: 80, render: v => v ? `${v}min` : '—' },
    { title: '其他', dataIndex: 'other_benefits', key: 'other_benefits', width: 120, ellipsis: true },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
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

  const chartData = data.map(d => ({
    name: d.company,
    月薪: d.base_salary || 0,
    年终: d.bonus || 0,
    股票: d.stock || 0,
    签字费: d.signing_bonus || 0,
  }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>薪资对比</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null);
          form.resetFields();
          setModalOpen(true);
        }}>
          添加薪资
        </Button>
      </div>

      {data.length >= 2 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="月薪" fill="#1890ff" />
              <Bar dataKey="年终" fill="#52c41a" />
              <Bar dataKey="股票" fill="#faad14" />
              <Bar dataKey="签字费" fill="#722ed1" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editing ? '编辑薪资' : '添加薪资'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="company" label="公司" rules={[{ required: true }]}>
              <Input placeholder="公司名称" />
            </Form.Item>
            <Form.Item name="position" label="岗位">
              <Input placeholder="岗位名称" />
            </Form.Item>
            <Form.Item name="base_salary" label="月薪">
              <InputNumber style={{ width: '100%' }} placeholder="元/月" min={0} />
            </Form.Item>
            <Form.Item name="bonus" label="年终奖">
              <InputNumber style={{ width: '100%' }} placeholder="元" min={0} />
            </Form.Item>
            <Form.Item name="stock" label="股票/期权">
              <InputNumber style={{ width: '100%' }} placeholder="元" min={0} />
            </Form.Item>
            <Form.Item name="signing_bonus" label="签字费">
              <InputNumber style={{ width: '100%' }} placeholder="元" min={0} />
            </Form.Item>
            <Form.Item name="allowance_meal" label="餐补">
              <InputNumber style={{ width: '100%' }} placeholder="元/月" min={0} />
            </Form.Item>
            <Form.Item name="allowance_housing" label="房补">
              <InputNumber style={{ width: '100%' }} placeholder="元/月" min={0} />
            </Form.Item>
            <Form.Item name="work_hours" label="日工时">
              <InputNumber style={{ width: '100%' }} placeholder="小时" min={0} />
            </Form.Item>
            <Form.Item name="commute_minutes" label="通勤时间">
              <InputNumber style={{ width: '100%' }} placeholder="分钟" min={0} />
            </Form.Item>
          </div>
          <Form.Item name="other_benefits" label="其他福利">
            <Input placeholder="补充说明" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
