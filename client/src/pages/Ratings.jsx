import React, { useEffect, useState } from 'react';
import { Card, Rate, Button, Modal, Form, Input, Tag, List, Popconfirm, message, Empty, Select } from 'antd';
import { StarOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../api';

export default function Ratings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ratings');
      setRatings(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRatings(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const tags = (values.tags || []).join(',');
      if (editing) {
        await api.put(`/ratings/${editing.id}`, { ...values, tags });
      } else {
        await api.post('/ratings', { ...values, tags });
      }
      message.success('保存成功');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchRatings();
    } catch (e) {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ratings/${id}`);
      message.success('已删除');
      fetchRatings();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const tagOptions = ['面试体验好', '流程规范', '面试官友好', '反馈及时', '加班多', '薪资高', '通勤远', '成长快'];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3><StarOutlined /> 面经与评分</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          添加评分
        </Button>
      </div>

      {ratings.length === 0 ? (
        <Empty description="暂无评分记录" />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
          dataSource={ratings}
          renderItem={(item) => (
            <List.Item>
              <Card size="small" title={item.company}>
                <Rate disabled defaultValue={item.rating} style={{ fontSize: 14 }} />
                {item.interview_stage && <Tag style={{ marginTop: 4 }}>{item.interview_stage}</Tag>}
                {item.salary && <Tag color="green" style={{ marginTop: 4 }}>{item.salary}</Tag>}
                {item.tags && item.tags.split(',').filter(Boolean).map(t => (
                  <Tag key={t} color="blue" style={{ marginTop: 4 }}>{t}</Tag>
                ))}
                {item.interview_notes && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#666', whiteSpace: 'pre-wrap' }}>
                    {item.interview_notes}
                  </div>
                )}
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => {
                    setEditing(item);
                    form.setFieldsValue({
                      ...item,
                      tags: item.tags ? item.tags.split(',') : [],
                    });
                    setModalOpen(true);
                  }} />
                  <Popconfirm title="删除？" onConfirm={() => handleDelete(item.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      <Modal
        title={editing ? '编辑评分' : '添加评分'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="company" label="公司" rules={[{ required: true }]}>
            <Input placeholder="公司名称" />
          </Form.Item>
          <Form.Item name="rating" label="评分">
            <Rate />
          </Form.Item>
          <Form.Item name="interview_stage" label="面试阶段">
            <Select options={[
              '电话面试', '技术一面', '技术二面', 'HR面', '总监面', '终面',
            ].map(s => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="salary" label="薪资/待遇">
            <Input placeholder="如：200/天" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" options={tagOptions.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="interview_notes" label="面试笔记">
            <Input.TextArea rows={4} placeholder="记录面试题目、体验、感受..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
