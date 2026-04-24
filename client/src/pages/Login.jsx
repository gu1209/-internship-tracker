import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Result } from 'antd';
import { UserOutlined, LockOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (e) {
      const err = e.response?.data?.error || '登录失败';
      if (err.includes('审批') || err.includes('审核')) {
        setPending(true);
      } else {
        message.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const data = await register(values.username, values.password);
      message.success(data.message || '注册成功，请等待管理员审批');
      setPending(true);
    } catch (e) {
      message.error(e.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <div style={styles.container}>
        <Card style={styles.card}>
          <Result
            status="warning"
            title="等待审批"
            subTitle="你的账号已注册，正在等待管理员审核通过。审核通过后即可登录使用。"
            extra={
              <Button type="primary" onClick={() => setPending(false)}>
                返回登录
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.brandSection}>
          <div style={styles.logo}>
            <SendOutlined style={{ fontSize: 36, color: '#fff' }} />
          </div>
          <h1 style={styles.brandTitle}>实习投递管理</h1>
          <p style={styles.brandSub}>跟踪每一次投递，把握每一个机会</p>
        </div>
      </div>
      <div style={styles.rightPanel}>
        <Card style={styles.formCard}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={styles.formTitle}>欢迎回来</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>登录你的账号继续</p>
          </div>
          <Tabs
            items={[
              {
                key: 'login',
                label: '登录',
                children: (
                  <Form onFinish={handleLogin} layout="vertical" size="large">
                    <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                      <Input prefix={<UserOutlined />} placeholder="用户名" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                      <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} style={styles.submitBtn}>
                      登录
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'register',
                label: '注册',
                children: (
                  <Form onFinish={handleRegister} layout="vertical" size="large">
                    <Form.Item name="username" rules={[{ required: true, message: '请输入用户名', min: 3 }]}>
                      <Input prefix={<UserOutlined />} placeholder="用户名（至少3位）" />
                    </Form.Item>
                    <Form.Item name="password" rules={[{ required: true, message: '请输入密码', min: 6 }]}>
                      <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6位）" />
                    </Form.Item>
                    <Form.Item name="confirm" dependencies={['password']}
                      rules={[
                        { required: true, message: '请确认密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('password') === value) return Promise.resolve();
                            return Promise.reject(new Error('两次密码不一致'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} style={styles.submitBtn}>
                      注册
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    background: '#fff',
  },
  leftPanel: {
    flex: isMobile ? '0 0 200px' : 1,
    background: `linear-gradient(135deg, rgba(234,88,12,0.92) 0%, rgba(194,65,12,0.95) 100%), url(/campus-bg.jpg) center/cover`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? 32 : 48,
  },
  brandSection: {
    textAlign: 'center',
    color: '#fff',
  },
  logo: {
    width: isMobile ? 60 : 80,
    height: isMobile ? 60 : 80,
    borderRadius: isMobile ? 14 : 20,
    background: 'rgba(255,255,255,0.2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isMobile ? 16 : 24,
    backdropFilter: 'blur(10px)',
  },
  brandTitle: {
    fontSize: isMobile ? 24 : 36,
    fontWeight: 800,
    margin: '0 0 12px',
    letterSpacing: 2,
  },
  brandSub: {
    fontSize: isMobile ? 13 : 16,
    opacity: 0.85,
    margin: 0,
    fontWeight: 300,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? 24 : 48,
    background: '#fff',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    border: 'none',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    borderRadius: 16,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 4px',
  },
  submitBtn: {
    height: 44,
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 10,
    marginTop: 8,
  },
};
