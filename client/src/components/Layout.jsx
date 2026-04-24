import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Drawer, Avatar } from 'antd';
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
  TeamOutlined,
  UsergroupAddOutlined,
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
  { type: 'divider' },
  { key: '/friends', icon: <TeamOutlined />, label: '好友管理' },
  { key: '/groups', icon: <UsergroupAddOutlined />, label: '群组' },
  { key: '/shared', icon: <ShareAltOutlined />, label: '好友共享' },
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

  const pageTitle = getPageTitle(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="md"
          style={{
            background: 'linear-gradient(180deg, #1C1917 0%, #292524 100%)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <div style={siderLogoStyle(collapsed)}>
            <SendOutlined style={{ fontSize: collapsed ? 20 : 22, color: 'var(--primary)' }} />
            {!collapsed && <span style={{ marginLeft: 8, fontSize: 16, fontWeight: 700 }}>投递管理</span>}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ background: 'transparent', borderRight: 'none' }}
          />
        </Sider>
      )}

      {/* Mobile drawer menu */}
      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={260}
        styles={{ body: { padding: 0, background: '#1C1917' } }}
      >
        <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <SendOutlined style={{ fontSize: 22, color: 'var(--primary)' }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>投递管理</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: 'transparent', borderRight: 'none' }}
        />
      </Drawer>

      <Layout>
        <Header style={headerStyle}>
          {isMobile && (
            <Button type="text" icon={<MenuOutlined style={{ fontSize: 20 }} />} onClick={() => setMobileMenuOpen(true)} />
          )}
          <div style={{ flex: 1, paddingLeft: isMobile ? 8 : 0 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{pageTitle}</span>
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 12px', borderRadius: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: 'var(--primary)' }} />
              {!isMobile && <span style={{ fontSize: 14, color: 'var(--text)' }}>{user?.username}</span>}
            </div>
          </Dropdown>
        </Header>
        <Content style={contentStyle(isMobile)}>
          {children}
        </Content>
      </Layout>

      <ShareManager open={shareOpen} onClose={() => setShareOpen(false)} />
    </Layout>
  );
}

function getPageTitle(path) {
  const map = {
    '/': '投递记录',
    '/timeline': '时间线',
    '/todos': '待办事项',
    '/dashboard': '统计看板',
    '/calendar': '日历',
    '/ratings': '面经评分',
    '/salary': '薪资对比',
    '/resume': '简历管理',
    '/questions': '面试题库',
    '/rejection': '拒因分析',
    '/tools': '智能导入',
    '/import': '批量导入',
    '/report': '周报',
    '/admin': '用户管理',
    '/friends': '好友管理',
    '/groups': '群组',
    '/shared': '好友共享',
  };
  return map[path] || '实习投递管理';
}

function siderLogoStyle(collapsed) {
  return {
    height: 48,
    margin: collapsed ? '16px 12px' : '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  };
}

const headerStyle = {
  padding: '0 24px',
  background: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid var(--border)',
  height: 56,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

function contentStyle(isMobile) {
  return {
    margin: isMobile ? 8 : 20,
    padding: isMobile ? 12 : 24,
    background: '#fff',
    borderRadius: 12,
    minHeight: 360,
    overflowX: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };
}
