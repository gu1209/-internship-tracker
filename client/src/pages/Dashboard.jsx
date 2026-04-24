import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Tag, List } from 'antd';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SendOutlined, TrophyOutlined, ClockCircleOutlined, WarningOutlined, RiseOutlined } from '@ant-design/icons';
import api from '../api';

const STATUS_COLORS = {
  '已投递': '#60A5FA', '笔试': '#34D399', '一面': '#10B981', '二面': '#3B82F6',
  'HR面': '#F59E0B', 'offer': '#F59E0B', '拒信': '#EF4444', '放弃': '#9CA3AF',
};

const CHART_COLORS = ['#EA580C', '#0D9488', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [staleApps, setStaleApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [ovRes, trRes, staleRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/trend?range=30'),
          api.get('/analytics/stale?days=7'),
        ]);
        setOverview(ovRes.data);
        setTrend(trRes.data);
        setStaleApps(staleRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!overview || overview.total === 0) return <Empty description="暂无投递数据" />;

  const pieData = Object.entries(overview.statusDist).map(([name, value]) => ({ name, value }));
  const barData = trend.map(t => ({ date: t.delivery_date.slice(5), count: t.cnt }));

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <div style={statCardStyle('#EA580C')}>
            <Statistic title="总投递" value={overview.total} prefix={<SendOutlined />} valueStyle={{ color: '#fff', fontWeight: 700 }} />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={statCardStyle('#F59E0B')}>
            <Statistic title="Offer" value={overview.offers} prefix={<TrophyOutlined />} valueStyle={{ color: '#fff', fontWeight: 700 }} />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={statCardStyle('#0D9488')}>
            <Statistic title="回复率" value={overview.responseRate} suffix="%" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fff', fontWeight: 700 }} />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={statCardStyle('#6366F1')}>
            <Statistic title="转化率" value={overview.conversionRate} suffix="%" prefix={<RiseOutlined />} valueStyle={{ color: '#fff', fontWeight: 700 }} />
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="状态分布" size="small">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={40}
                    label={({ name, value }) => `${name} ${value}`}
                    labelLine={{ stroke: '#ccc' }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="近30天投递趋势" size="small">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e8df" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#EA580C" radius={[6, 6, 0, 0]} name="投递数" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
      </Row>

      {staleApps.length > 0 && (
        <Card title="滞留提醒（7天无进展）" size="small" style={{ marginBottom: 16, borderColor: '#F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Statistic value={staleApps.length} suffix="条" prefix={<WarningOutlined />} valueStyle={{ color: '#F59E0B' }} />
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {staleApps.slice(0, 8).map(app => (
                <Tag key={app.id} color="warning">{app.company}（{app.stale_days}天）</Tag>
              ))}
              {staleApps.length > 8 && <span style={{ color: 'var(--text-muted)' }}>等 {staleApps.length} 条</span>}
            </div>
          </div>
        </Card>
      )}

      {overview.upcomingTodos?.length > 0 && (
        <Card title="未来7天待办" size="small">
          <List
            size="small"
            dataSource={overview.upcomingTodos}
            renderItem={(item) => (
              <List.Item>
                {item.company && <Tag color="processing">{item.company}</Tag>}
                <span>{item.description}</span>
                <Tag style={{ marginLeft: 'auto' }}>{item.due_date}</Tag>
              </List.Item>
            )}
          />
        </Card>
      )}

      {overview.overdueCount > 0 && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: 12 }}>
          <WarningOutlined style={{ fontSize: 20, color: '#EF4444' }} />
          <Statistic title="过期待办" value={overview.overdueCount} valueStyle={{ color: '#EF4444' }} />
        </div>
      )}
    </div>
  );
}

function statCardStyle(color) {
  return {
    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    borderRadius: 12,
    padding: '20px 24px',
    color: '#fff',
    boxShadow: `0 4px 12px ${color}33`,
  };
}
