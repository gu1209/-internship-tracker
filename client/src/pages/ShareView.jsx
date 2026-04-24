import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Tag, Empty, Spin, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const STATUS_COLORS = {
  '已投递': '#60A5FA', '笔试': '#34D399', '一面': '#10B981', '二面': '#3B82F6',
  'HR面': '#F59E0B', 'offer': '#F59E0B', '拒信': '#EF4444', '放弃': '#9CA3AF',
};

function StatusBadge({ status }) {
  return (
    <Tag style={{
      background: STATUS_COLORS[status] || '#9CA3AF',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontWeight: 500,
      padding: '2px 10px',
    }}>{status}</Tag>
  );
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #FFFBF5)' }}>
      <Spin size="large" />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #FFFBF5)' }}>
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Title level={3}>😔 {error}</Title>
        <Paragraph style={{ color: '#A8A29E' }}>该分享链接可能已过期或不存在</Paragraph>
      </div>
    </div>
  );

  const columns = [
    { title: '公司', dataIndex: 'company', key: 'company', width: 150 },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 180 },
    { title: '投递日期', dataIndex: 'delivery_date', key: 'delivery_date', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: s => <StatusBadge status={s} /> },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', minHeight: '100vh', background: 'var(--bg, #FFFBF5)' }}>
      <div style={{
        background: 'linear-gradient(135deg, #EA580C, #C2410C)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        color: '#fff',
      }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          {data.title}
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', margin: '8px 0 0' }}>
          只读视图 · 共 {data.applications.length} 条记录
        </Paragraph>
      </div>

      {data.applications.length === 0 ? (
        <Empty description="暂无投递记录" />
      ) : (
        <Table rowKey={(r, i) => i} columns={columns} dataSource={data.applications} pagination={false} />
      )}
    </div>
  );
}
