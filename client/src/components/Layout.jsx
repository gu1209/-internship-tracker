import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Drawer } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  SendOutlined,
  ClockCircleOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  ToolOutlined,
  MenuOutlined,
  ImportOutlined,
  CalendarOutlined,
  StarOutlined,
  ShareAltOutlined,
  BarChartOutlined,
  SafetyOutlined,
  DollarOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import ShareManager from './ShareManager';

const { Sider, Content, Header } = Layout;

const baseMenuItems = [
  { key: '/', icon: <SendOutlined />, label: '投递记录' },
  { key: '/timeline', icon: <ClockCircleOutlined />, label: '时间线' },
  { key: '/todos', icon: <CheckSquareOutlined />, label: '待办事项' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '统计看板' },
  { type: 'divider' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '日历' },
  { key: '/ratings', icon: <StarOutlined />, label: '面经评分' },
  { key: '/salary', icon: <DollarOutlined />, label: '薪资对比' },
  { key: '/resume', icon: <FileTextOutlined />, label: '简历管理' },
  { key: '/questions', icon: <QuestionCircleOutlined />, label: '面试题库' },
  { key: '/rejection', icon: <FallOutlined />, label: '拒因分析' },
  { key: '/tools', icon: <ToolOutlined />, label: '智能导入' },
  { key: '/import', icon: <ImportOutlined />, label: '批量导入' },
  { key: '/report', icon: <BarChartOutlined />, label: '周报' },
];

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isAdmin = user?.is_admin;

  const menuItems = [...baseMenuItems];
  if (isAdmin) {
    menuItems.push(
      { type: 'divider' },
      { key: '/admin', icon: <SafetyOutlined />, label: '用户管理' },
    );
  }

  useEffect(() => {
    const handleResize = () => setCollapsed(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const userMenuItems = [
    { key: 'share', icon: <ShareAltOutlined />, label: '分享链接', onClick: () => setShareOpen(true) },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="md">
          <div style={{ height: 32, margin: 16, color: '#fff', fontSize: collapsed ? 14 : 16, fontWeight: 'bold', textAlign: 'center' }}>
            {collapsed ? '📮' : '实习投递管理'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
      )}

      {/* Mobile drawer menu */}
      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={240}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px 16px 8px', fontSize: 18, fontWeight: 'bold' }}>📮 实习投递管理</div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>

      <Layout>
        <Header style={{
          padding: isMobile ? '0 12px' : '0 24px',
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          {isMobile && (
            <Button type="text" icon={<MenuOutlined style={{ fontSize: 20 }} />} onClick={() => setMobileMenuOpen(true)} />
          )}
          <div style={{ flex: 1 }} />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {!isMobile && user?.username}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{
          margin: isMobile ? 8 : 24,
          padding: isMobile ? 12 : 24,
          background: '#fff',
          borderRadius: 8,
          minHeight: 360,
          overflowX: 'auto',
        }}>
          {children}
        </Content>
      </Layout>

      <ShareManager open={shareOpen} onClose={() => setShareOpen(false)} />
    </Layout>
  );
}
