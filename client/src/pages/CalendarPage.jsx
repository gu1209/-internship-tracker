import React, { useEffect, useState } from 'react';
import { Calendar, Badge, Modal, Tag, Button, Empty, Spin } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const TYPE_COLORS = {
  interview: '#fa8c16',
  todo: '#1677ff',
  timeline: '#52c41a',
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);

  const fetchEvents = async (date) => {
    setLoading(true);
    const month = date.format('YYYY-MM');
    try {
      const res = await api.get('/calendar/events', { params: { month } });
      const grouped = {};
      res.data.forEach(ev => {
        const key = ev.date;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev);
      });
      setEvents(grouped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(dayjs()); }, []);

  const handlePanelChange = (date) => {
    fetchEvents(date);
  };

  const dateCellRender = (date) => {
    const key = date.format('YYYY-MM-DD');
    const dayEvents = events[key] || [];
    if (dayEvents.length === 0) return null;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 11 }}>
        {dayEvents.slice(0, 3).map(ev => (
          <li key={`${ev.type}-${ev.id}`} style={{ marginBottom: 2 }}>
            <Badge color={TYPE_COLORS[ev.type]} />
            <span style={{ marginLeft: 4 }}>
              {ev.type === 'interview' ? `${ev.company} 面试` :
               ev.type === 'todo' ? ev.description.slice(0, 10) :
               ev.eventType}
            </span>
          </li>
        ))}
        {dayEvents.length > 3 && (
          <li style={{ color: '#999' }}>+{dayEvents.length - 3} 更多</li>
        )}
      </ul>
    );
  };

  const handleDateSelect = (date) => {
    const key = date.format('YYYY-MM-DD');
    const dayEvents = events[key] || [];
    setSelectedDate(date);
    setDayEvents(dayEvents);
  };

  return (
    <div>
      <h3><CalendarOutlined /> 日历视图</h3>
      <Spin spinning={loading}>
        <Calendar
          mode="month"
          dateCellRender={dateCellRender}
          onPanelChange={handlePanelChange}
          onSelect={handleDateSelect}
        />
      </Spin>

      <Modal
        title={selectedDate ? selectedDate.format('YYYY年MM月DD日') : ''}
        open={!!selectedDate}
        onCancel={() => setSelectedDate(null)}
        footer={null}
      >
        {dayEvents.length === 0 ? (
          <Empty description="当天无安排" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          dayEvents.map(ev => (
            <div key={`${ev.type}-${ev.id}`} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Tag color={TYPE_COLORS[ev.type]}>
                {ev.type === 'interview' ? '面试' : ev.type === 'todo' ? '待办' : ev.eventType}
              </Tag>
              <span style={{ fontWeight: 500 }}>
                {ev.company && `${ev.company}`}
                {ev.position && ` - ${ev.position}`}
                {ev.type === 'todo' && ev.description}
                {ev.type === 'timeline' && ev.description}
              </span>
              {ev.type === 'todo' && ev.done && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 4 }} />}
              {ev.type === 'todo' && !ev.done && dayjs(ev.date).isBefore(dayjs()) && (
                <Tag color="red" style={{ marginLeft: 4 }}>已过期</Tag>
              )}
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}
