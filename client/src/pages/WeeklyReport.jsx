import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Spin, Empty, Timeline, Divider } from 'antd';
import {
  SendOutlined, TrophyOutlined, CheckCircleOutlined, CalendarOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import api from '../api';

export default function WeeklyReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/report/weekly').then(res => {
      setReport(res.data);
    }).catch(() => {
      // ignore
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!report) return <Empty description="加载失败" />;

  const weekLabel = `${report.weekStart} ~ ${report.weekEnd}`;

  return (
    <div style={{ maxWidth: 800 }}>
      <h3>📊 投递周报</h3>
      <p style={{ color: '#999', marginBottom: 24 }}>{weekLabel}</p>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="本周投递" value={report.newApplications} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总投递" value={report.total} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Offer 数" value={report.offers} prefix={<TrophyOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="完成待办" value={report.completedTodos} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {report.newApplications > 0 && (
        <Card title="本周新增投递" size="small" style={{ marginBottom: 16 }}>
          <List
            size="small"
            dataSource={report.applications}
            renderItem={item => (
              <List.Item>
                <span><strong>{item.company}</strong> - {item.position}</span>
                <Tag>{item.status}</Tag>
                <span style={{ color: '#999', fontSize: 12 }}>{item.delivery_date}</span>
              </List.Item>
            )}
          />
        </Card>
      )}

      {report.statusChanges.length > 0 && (
        <Card title="本周状态更新" size="small" style={{ marginBottom: 16 }}>
          <Timeline items={report.statusChanges.map(s => ({
            children: <span>{s.description} <span style={{ color: '#999', fontSize: 12 }}>({s.event_date})</span></span>,
          }))} />
        </Card>
      )}

      {report.upcomingInterviews.length > 0 && (
        <Card title="即将面试" size="small" style={{ marginBottom: 16 }}>
          <List
            size="small"
            dataSource={report.upcomingInterviews}
            renderItem={item => (
              <List.Item>
                <CalendarOutlined /> <strong>{item.company}</strong> - {item.position}
                <Tag color="orange" style={{ marginLeft: 'auto' }}>{item.interview_date}</Tag>
              </List.Item>
            )}
          />
        </Card>
      )}

      {report.newApplications === 0 && report.statusChanges.length === 0 && (
        <Empty description="本周暂无投递活动，继续加油！" />
      )}
    </div>
  );
}
