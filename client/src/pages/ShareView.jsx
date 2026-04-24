import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Tag, Empty, Spin, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const STATUS_COLORS = {
  '已投递': 'blue', '笔试': 'cyan', '一面': 'green', '二面': 'lime',
  'HR面': 'orange', 'offer': 'gold', '拒信': 'red', '放弃': 'default',
};

function StatusBadge({ status }) {
  return <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>;
}

export default function ShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/share/${token}/data`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error); });
        return res.json();
      })
      .then(d => { setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (error) return (
    <div style={{ textAlign: 'center', padding: 100 }}>
      <Title level={3}>😔 {error}</Title>
      <Paragraph>该分享链接可能已过期或不存在</Paragraph>
    </div>
  );

  const columns = [
    { title: '公司', dataIndex: 'company', key: 'company', width: 150 },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 180 },
    { title: '投递日期', dataIndex: 'delivery_date', key: 'delivery_date', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: s => <StatusBadge status={s} /> },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>📮 {data.title}</Title>
      <Paragraph style={{ color: '#999' }}>只读视图 · 共 {data.applications.length} 条记录</Paragraph>
      {data.applications.length === 0 ? (
        <Empty description="暂无投递记录" />
      ) : (
        <Table rowKey={(r, i) => i} columns={columns} dataSource={data.applications} pagination={false} />
      )}
    </div>
  );
}
