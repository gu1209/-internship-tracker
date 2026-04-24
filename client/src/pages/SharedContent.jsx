import React, { useEffect, useState } from 'react';
import { Tabs, Table, Tag, Select, Card, Rate, List, Empty, Spin, message } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import api from '../api';

const STATUS_COLORS = {
  '算法': 'red', '八股': 'orange', '场景': 'blue', 'HR': 'green',
  '项目': 'purple', '系统设计': 'cyan', '语言基础': 'lime',
};

export default function SharedContent() {
  const [sources, setSources] = useState({ friends: [], groups: [] });
  const [questions, setQuestions] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('questions');
  const [selectedSource, setSelectedSource] = useState(null); // null = all

  const fetchSources = async () => {
    try {
      const res = await api.get('/shared/sources');
      setSources(res.data);
    } catch (e) { /* ignore */ }
  };

  const fetchContent = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedSource?.user_id) params.owner_id = selectedSource.user_id;
      const [qRes, rRes] = await Promise.all([
        api.get('/shared/questions', { params }),
        api.get('/shared/ratings', { params }),
      ]);
      setQuestions(qRes.data);
      setRatings(rRes.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSources(); }, []);
  useEffect(() => { fetchContent(); }, [selectedSource]);

  const sourceOptions = [
    { value: 'all', label: '全部来源' },
    ...sources.friends.map(f => ({
      value: `friend_${f.user_id}`,
      label: `${f.username}（好友）`,
      user_id: f.user_id,
    })),
    ...sources.groups.map(g => ({
      value: `group_${g.user_id}`,
      label: `${g.username}（群组）`,
      user_id: g.user_id,
    })),
  ];

  const handleSourceChange = (val) => {
    if (val === 'all') {
      setSelectedSource(null);
    } else {
      const opt = sourceOptions.find(o => o.value === val);
      setSelectedSource(opt || null);
    }
  };

  const questionColumns = [
    {
      title: '来源', dataIndex: '_owner_username', key: '_owner_username', width: 100,
      render: (name, record) => (
        <div>
          <Tag icon={<UserOutlined />} color="blue">{name}</Tag>
          {record._source === 'group' && <Tag icon={<TeamOutlined />}>{record._source_name}</Tag>}
        </div>
      ),
    },
    {
      title: '类型', dataIndex: 'question_type', key: 'question_type', width: 80,
      render: (t) => t ? <Tag color={STATUS_COLORS[t] || 'default'}>{t}</Tag> : '—',
    },
    { title: '公司', dataIndex: 'company', key: 'company', width: 100 },
    { title: '岗位', dataIndex: 'position', key: 'position', width: 120 },
    {
      title: '题目', dataIndex: 'question', key: 'question', ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '答案', dataIndex: 'answer', key: 'answer', ellipsis: true, width: 200,
      render: (v) => v || '—',
    },
    {
      title: '难度', dataIndex: 'difficulty', key: 'difficulty', width: 100,
      render: (d) => <Rate disabled defaultValue={d} count={5} style={{ fontSize: 12 }} />,
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 140,
      render: (t) => t ? t.split(',').filter(Boolean).map(tag => <Tag key={tag} style={{ marginBottom: 2 }}>{tag}</Tag>) : '—',
    },
  ];

  return (
    <div>
      {/* Controls */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          style={{ width: 220 }}
          value={selectedSource ? `${selectedSource.user_id ? (sources.friends.find(f => f.user_id === selectedSource.user_id) ? 'friend_' : 'group_') : ''}${selectedSource.user_id}` : 'all'}
          onChange={handleSourceChange}
          options={sourceOptions}
        />
        <span style={{ color: '#999', fontSize: 13 }}>
          共 {sources.friends.length} 位好友、{sources.groups.length} 个群组共享内容
        </span>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'questions',
            label: `面试题（${questions.length}）`,
            children: (
              loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> :
              questions.length === 0 ? (
                <Empty description="暂无共享面试题" />
              ) : (
                <Table
                  columns={questionColumns}
                  dataSource={questions}
                  rowKey={(r) => `${r._owner_username}_${r.id}`}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 1000 }}
                />
              )
            ),
          },
          {
            key: 'ratings',
            label: `面经评分（${ratings.length}）`,
            children: (
              loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> :
              ratings.length === 0 ? (
                <Empty description="暂无共享面经评分" />
              ) : (
                <List
                  grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
                  dataSource={ratings}
                  renderItem={(item) => (
                    <List.Item>
                      <Card size="small">
                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tag icon={<UserOutlined />} color="blue">{item._owner_username}</Tag>
                          {item._source === 'group' && <Tag icon={<TeamOutlined />}>{item._source_name}</Tag>}
                        </div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.company}</div>
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
                      </Card>
                    </List.Item>
                  )}
                />
              )
            ),
          },
        ]}
      />
    </div>
  );
}
