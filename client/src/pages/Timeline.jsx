import React, { useEffect, useState } from 'react';
import { Timeline, Select, Button, Modal, Form, Input, DatePicker, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const EVENT_TYPES = ['投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '其他'];

const TYPE_COLORS = {
  '投递': 'blue', '笔试': 'cyan', '一面': 'green', '二面': 'lime',
  'HR面': 'orange', 'offer': 'gold', '拒信': 'red', '其他': 'gray',
};

export default function TimelinePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [appFilter, setAppFilter] = useState('');
  const [apps, setApps] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchApps = async () => {
    try {
      const res = await api.get('/applications', { params: { pageSize: 1000 } });
      setApps(res.data.data);
    } catch (e) { /* ignore */ }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (appFilter) params.application_id = appFilter;
      const res = await api.get('/timeline', { params });
      setEvents(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, []);
  useEffect(() => { fetchEvents(); }, [appFilter]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/timeline', {
        ...values,
        event_date: values.event_date.format('YYYY-MM-DD'),
      });
      message.success('已添加');
      setModalOpen(false);
      form.resetFields();
      fetchEvents();
    } catch (e) {
      message.error('添加失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/timeline/${id}`);
      message.success('已删除');
      fetchEvents();
    } catch (e) {
      message.error('删除失败');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加事件</Button>
        <Select
          style={{ width: 200 }}
          placeholder="筛选公司/岗位"
          allowClear
          value={appFilter || undefined}
          onChange={(val) => setAppFilter(val || '')}
          options={apps.map(a => ({ value: a.id, label: `${a.company} - ${a.position}` }))}
        />
      </div>

      <Timeline mode="left" pending={!events.length}>
        {events.map(ev => (
          <Timeline.Item
            key={ev.id}
            dot={<Tag color={TYPE_COLORS[ev.event_type] || 'blue'} style={{ border: 'none', padding: '2px 6px', fontSize: 10 }}>{ev.event_type}</Tag>}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {ev.company && <Tag color="blue">{ev.company}</Tag>}
                  {ev.description}
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{ev.event_date}</div>
              </div>
              <Popconfirm title="删除此事件？" onConfirm={() => handleDelete(ev.id)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          </Timeline.Item>
        ))}
      </Timeline>

      <Modal title="添加时间线事件" open={modalOpen} onOk={handleAdd} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="application_id" label="关联投递" rules={[{ required: true }]}>
            <Select options={apps.map(a => ({ value: a.id, label: `${a.company} - ${a.position}` }))} />
          </Form.Item>
          <Form.Item name="event_date" label="事件日期" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="event_type" label="事件类型" rules={[{ required: true }]}>
            <Select options={EVENT_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
