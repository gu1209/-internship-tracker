import React from 'react';
import { Card, Typography, Steps, Tag, Button, Space, Input, message } from 'antd';
import { CopyOutlined, ScanOutlined, LinkOutlined, BookOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const API_BASE = 'http://121.41.118.22:3001/api';

const bookmarkletCode = `javascript:(function(){var s=document.createElement('script');s.src='${window.location.origin}/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})();`;

export default function Tools() {
  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode).then(() => {
      message.success('书签代码已复制');
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={3}>智能导入工具</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5}><ScanOutlined /> 方式一：图片识别</Title>
            <Paragraph>
              在「新增投递」弹窗中，拖拽或点击上传区域，上传投递截图、邮件截图或招聘页面截图。
              系统会自动识别公司名称、岗位、日期等信息并填入表单。
            </Paragraph>
            <Tag color="blue">支持中文OCR</Tag>
            <Tag color="green">自动填充表单</Tag>
          </div>

          <div>
            <Title level={5}><LinkOutlined /> 方式二：链接解析</Title>
            <Paragraph>
              在「新增投递」弹窗中，粘贴招聘链接（如 BOSS直聘、拉勾、猎聘、前程无忧、智联招聘），
              点击「解析」按钮，系统会自动抓取页面并提取公司和岗位信息。
            </Paragraph>
            <Tag color="blue">BOSS直聘</Tag>
            <Tag color="blue">拉勾网</Tag>
            <Tag color="blue">猎聘</Tag>
            <Tag color="blue">前程无忧</Tag>
            <Tag color="blue">智联招聘</Tag>
          </div>

          <div>
            <Title level={5}><BookOutlined /> 方式三：浏览器书签导入</Title>
            <Paragraph>
              将下方书签代码复制到浏览器书签栏，在招聘页面点击书签即可一键导入。
            </Paragraph>
            <Steps
              size="small"
              items={[
                { title: '复制书签代码', description: '点击下方按钮复制' },
                { title: '添加书签', description: '在浏览器书签栏右键 → 添加新书签 → 粘贴到 URL 栏' },
                { title: '使用', description: '打开招聘页面 → 点击书签 → 填写信息 → 导入' },
              ]}
            />
            <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <Input.TextArea
                value={bookmarkletCode}
                readOnly
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 11 }}
              />
              <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy} style={{ marginTop: 8 }}>
                复制书签代码
              </Button>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
}
