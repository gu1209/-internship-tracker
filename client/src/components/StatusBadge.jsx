import React from 'react';
import { Tag } from 'antd';

const STATUS_COLORS = {
  '已投递': 'blue',
  '笔试': 'cyan',
  '一面': 'green',
  '二面': 'lime',
  'HR面': 'orange',
  'offer': 'gold',
  '拒信': 'red',
  '放弃': 'default',
};

export default function StatusBadge({ status }) {
  return <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>;
}
