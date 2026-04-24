import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Tag, List } from 'antd';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SendOutlined, TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../api';

const STATUS_COLORS = {
  '已投递': '#1890ff', '笔试': '#13c2c2', '一面': '#52c41a', '二面': '#a0d911',
  'HR面': '#fa8c16', 'offer': '#faad14', '拒信': '#ff4d4f', '放弃': '#d9d9d9',
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [ovRes, trRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/trend?range=30'),
        ]);
        setOverview(ovRes.data);
        setTrend(trRes.data);
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
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总投递数" value={overview.total} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Offer 数" value={overview.offers} prefix={<TrophyOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="回复率" value={overview.responseRate} suffix="%" prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="转化率" value={overview.conversionRate} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="状态分布" size="small">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#d9d9d9'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="近30天投递趋势" size="small">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1890ff" radius={[4, 4, 0, 0]} name="投递数" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
      </Row>

      {overview.upcomingTodos?.length > 0 && (
        <Card title="未来7天待办" size="small">
          <List
            size="small"
            dataSource={overview.upcomingTodos}
            renderItem={(item) => (
              <List.Item>
                {item.company && <Tag color="blue">{item.company}</Tag>}
                <span>{item.description}</span>
                <Tag style={{ marginLeft: 'auto' }}>{item.due_date}</Tag>
              </List.Item>
            )}
          />
        </Card>
      )}

      {overview.overdueCount > 0 && (
        <Card style={{ marginTop: 16, borderColor: '#ff4d4f' }}>
          <Statistic title="过期待办" value={overview.overdueCount} valueStyle={{ color: '#ff4d4f' }} />
        </Card>
      )}
    </div>
  );
}
