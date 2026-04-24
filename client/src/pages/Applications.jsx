import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Input, Select, Popconfirm, message, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, CalendarOutlined, FileTextOutlined } from '@ant-design/icons';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import AppForm from '../components/AppForm';

const STATUS_OPTIONS = ['全部', '已投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '放弃'];
const STATUS_FLOW = ['已投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '放弃'];

export default function Applications() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [timelineData, setTimelineData] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      if (companyFilter) params.company = companyFilter;
      const res = await api.get('/applications', { params });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, statusFilter]);

  const handleCreate = async (values) => {
    try {
      await api.post('/applications', values);
      message.success('创建成功');
      setFormOpen(false);
      fetchData();
    } catch (e) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values) => {
    try {
      await api.put(`/applications/${editing.id}`, values);
      message.success('更新成功');
      setFormOpen(false);
      setEditing(null);
      fetchData();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/applications/${id}`);
      message.success('已删除');
      fetchData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/applications/${id}/status`, { status: newStatus });
      message.success(`状态已更新为 ${newStatus}`);
      fetchData();
    } catch (e) {
      message.error(e.response?.data?.error || '更新失败');
    }
  };

  const loadTimeline = async (id) => {
    if (timelineData[id]) return;
    try {
      const res = await api.get('/timeline', { params: { application_id: id } });
      setTimelineData(prev => ({ ...prev, [id]: res.data }));
    } catch (e) {
      message.error('加载时间线失败');
    }
  };

  const columns = [
    {
      title: '公司', dataIndex: 'company', key: 'company', width: 160,
      render: (text, record) => {
        const isStale = record.stale_days >= 7;
        return (
          <div>
            <strong style={isStale ? { color: '#d48806' } : {}}>{text}</strong>
            {isStale && <Tag color="orange" style={{ marginLeft: 4 }}>停滞 {record.stale_days}天</Tag>}
            {record.job_url && (
              <Tooltip title="打开岗位链接">
                <LinkOutlined style={{ marginLeft: 6, color: '#1890ff', cursor: 'pointer' }} onClick={() => window.open(record.job_url)} />
              </Tooltip>
            )}
          </div>
        );
      },
    },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 160 },
    { title: '投递日期', dataIndex: 'delivery_date', key: 'delivery_date', width: 110, sorter: (a, b) => a.delivery_date.localeCompare(b.delivery_date) },
    {
      title: '面试时间', dataIndex: 'interview_date', key: 'interview_date', width: 140,
      render: (val) => val ? (
        <span><CalendarOutlined /> {val}</span>
      ) : (
        <span style={{ color: '#d9d9d9' }}>未设置</span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status, record) => {
        const currentIdx = STATUS_FLOW.indexOf(status);
        const nextStatuses = STATUS_FLOW.slice(currentIdx + 1);
        if (nextStatuses.length === 0) return <StatusBadge status={status} />;
        return (
          <Select
            value={status}
            size="small"
            style={{ width: 90 }}
            onChange={(val) => handleStatusChange(record.id, val)}
            options={[{ value: status, label: status }, ...nextStatuses.map(s => ({ value: s, label: s }))]}
          />
        );
      },
    },
    {
      title: '备注', dataIndex: 'notes', key: 'notes', width: 120, ellipsis: true,
      render: (val) => val ? <Tooltip title={val}><FileTextOutlined /> {val}</Tooltip> : <span style={{ color: '#d9d9d9' }}>—</span>,
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); setFormOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>新增投递</Button>
        <Select
          style={{ width: 120 }}
          value={statusFilter || '全部'}
          onChange={(val) => { setStatusFilter(val === '全部' ? '' : val); setPage(1); }}
          options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
        />
        <Input.Search
          placeholder="搜索公司"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          onSearch={() => setPage(1)}
          style={{ width: 200 }}
          allowClear
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 900 }}
        rowClassName={(record) => record.stale_days >= 7 ? 'stale-row' : ''}
        pagination={{ current: page, total, pageSize, onChange: (p) => setPage(p), showTotal: (t) => `共 ${t} 条` }}
        expandable={{
          expandedRowKeys: expandedRow ? [expandedRow] : [],
          expandedRowRender: (record) => {
            const items = timelineData[record.id] || [];
            if (items.length === 0) return <div style={{ color: '#999', padding: 8 }}>暂无进度记录</div>;
            return (
              <div style={{ padding: 8 }}>
                {items.map(t => (
                  <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="blue">{t.event_date}</Tag>
                    <StatusBadge status={t.event_type} />
                    <span>{t.description}</span>
                  </div>
                ))}
              </div>
            );
          },
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpandedRow(record.id);
              loadTimeline(record.id);
            } else {
              setExpandedRow(null);
            }
          },
        }}
      />

      <AppForm
        open={formOpen}
        initialValues={editing}
        onSubmit={editing ? handleUpdate : handleCreate}
        onCancel={() => { setFormOpen(false); setEditing(null); }}
      />
    </div>
  );
}
