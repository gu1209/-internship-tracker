import React, { useState } from 'react';
import { Modal, Input, DatePicker, Button, List, Tag, message, Empty, Popconfirm, Space } from 'antd';
import { ShareAltOutlined, DeleteOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../api';

export default function ShareManager({ open, onClose }) {
  const [links, setLinks] = useState([]);
  const [title, setTitle] = useState('我的投递记录');
  const [loading, setLoading] = useState(false);

  const fetchLinks = async () => {
    try {
      const res = await api.get('/share');
      setLinks(res.data);
    } catch (e) { /* ignore */ }
  };

  React.useEffect(() => { if (open) fetchLinks(); }, [open]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/share', { title });
      // Copy to clipboard (silently fail if not available)
      try {
        await navigator.clipboard.writeText(res.data.url);
        message.success('创建成功！链接已复制');
      } catch {
        message.success('创建成功！请手动复制链接');
      }
      setTitle('');
      await fetchLinks();
    } catch (e) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (token) => {
    try {
      await api.delete(`/share/${token}`);
      message.success('已删除');
      fetchLinks();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleCopy = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url).then(() => message.success('已复制')).catch(() => message.error('复制失败'));
  };

  return (
    <Modal title={<><ShareAltOutlined /> 分享链接管理</>} open={open} onCancel={onClose} footer={null} width={560}>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="链接标题"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: 200 }}
        />
        <Button type="primary" icon={<LinkOutlined />} onClick={handleCreate} loading={loading}>
          生成链接
        </Button>
      </Space>

      {links.length === 0 ? (
        <Empty description="暂无分享链接" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={links}
          renderItem={item => {
            const isExpired = item.expire_date && new Date(item.expire_date) < new Date();
            return (
              <List.Item
                actions={[
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(item.token)}>复制</Button>,
                  <Popconfirm title="删除？" onConfirm={() => handleDelete(item.token)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <div style={{ flex: 1, opacity: isExpired ? 0.5 : 1 }}>
                  <div><strong>{item.title}</strong></div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {isExpired && <Tag color="red">已过期</Tag>}
                    浏览 {item.view_count} 次 · 过期: {item.expire_date}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      )}
    </Modal>
  );
}
