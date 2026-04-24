import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Empty, Spin, message } from 'antd';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../api';

const STAGE_COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#8c8c8c'];

export default function RejectionAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/rejection');
      setData(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!data) return <Empty description="暂无数据" />;

  const { stageMap, rejStages, rejReasons, companies } = data;

  const funnelStages = ['已投递', '笔试', '一面', '二面', 'HR面', 'offer'];
  const funnelData = funnelStages.map(s => ({ name: s, value: stageMap[s] || 0 }));

  const reasonData = rejReasons.map(r => ({ name: r.rejection_reason, value: r.cnt }));
  const stageData = rejStages.map(s => ({ name: s.rejection_stage, value: s.cnt }));

  const companyColumns = [
    { title: '公司', dataIndex: 'company', key: 'company', width: 140 },
    { title: '总数', dataIndex: 'total', key: 'total', width: 70 },
    {
      title: 'Offer', dataIndex: 'offers', key: 'offers', width: 70,
      render: v => <Tag color="green">{v}</Tag>,
    },
    {
      title: '拒信', dataIndex: 'rejections', key: 'rejections', width: 70,
      render: v => <Tag color="red">{v}</Tag>,
    },
    {
      title: '通过率', dataIndex: 'pass_rate', key: 'pass_rate', width: 80,
      render: v => <span style={{ color: parseFloat(v) >= 30 ? '#52c41a' : '#ff4d4f' }}>{v}%</span>,
    },
  ];

  const totalApps = Object.values(stageMap).reduce((a, b) => a + b, 0);
  const offers = stageMap['offer'] || 0;
  const rejections = stageMap['拒信'] || 0;

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>拒因分析</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <Card size="small"><div style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>{totalApps}</div><div style={{ textAlign: 'center', color: '#999' }}>总投递</div></Card>
        <Card size="small"><div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a', textAlign: 'center' }}>{offers}</div><div style={{ textAlign: 'center', color: '#999' }}>Offer</div></Card>
        <Card size="small"><div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f', textAlign: 'center' }}>{rejections}</div><div style={{ textAlign: 'center', color: '#999' }}>拒信</div></Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card size="small" title="投递漏斗">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={60} />
              <ReTooltip />
              <Bar dataKey="value" fill="#1890ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card size="small" title="拒因分布">
          {reasonData.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无拒因记录" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={reasonData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {reasonData.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
                </Pie>
                <ReTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card size="small" title="各环节淘汰数">
        {stageData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无被拒环节记录" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ReTooltip />
              <Bar dataKey="value" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card size="small" title="各公司通过率" style={{ marginTop: 16 }}>
        {companies.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        ) : (
          <Table columns={companyColumns} dataSource={companies} rowKey="company" pagination={false} size="small" />
        )}
      </Card>
    </div>
  );
}
