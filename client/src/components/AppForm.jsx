import React, { useEffect, useState } from 'react';
import { Form, Input, Modal, DatePicker, Select, Button, Upload, message, Space, Spin, Tag } from 'antd';
import { InboxOutlined, LinkOutlined, ScanOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const STATUS_OPTIONS = ['已投递', '笔试', '一面', '二面', 'HR面', 'offer', '拒信', '放弃'];

export default function AppForm({ open, initialValues, onSubmit, onCancel }) {
  const [form] = Form.useForm();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [autoFillSource, setAutoFillSource] = useState('');
  const [resumeVersions, setResumeVersions] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('已投递');

  useEffect(() => {
    if (open) {
      api.get('/resume').then(r => setResumeVersions(r.data)).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && initialValues) {
      setCurrentStatus(initialValues.status || '已投递');
      form.setFieldsValue({
        ...initialValues,
        delivery_date: initialValues.delivery_date ? dayjs(initialValues.delivery_date) : null,
        interview_date: initialValues.interview_date ? dayjs(initialValues.interview_date) : null,
      });
    } else if (open) {
      setCurrentStatus('已投递');
      form.setFieldsValue({
        company: '',
        position: '',
        job_url: '',
        delivery_date: dayjs(),
        interview_date: null,
        status: '已投递',
        notes: '',
        resume_version_id: undefined,
        rejection_reason: '',
        rejection_stage: '',
      });
    }
    setAutoFillSource('');
    setUrlInput('');
  }, [open, initialValues, form]);

  const handleOcrUpload = async (file) => {
    setOcrLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api.post('/ocr/recognize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { parsed } = res.data;
      if (parsed.confidence === 'low' && !parsed.company && !parsed.position) {
        message.warning('识别结果置信度较低，请手动填写');
      } else {
        form.setFieldsValue({
          company: parsed.company || form.getFieldValue('company'),
          position: parsed.position || form.getFieldValue('position'),
          delivery_date: parsed.delivery_date ? dayjs(parsed.delivery_date) : form.getFieldValue('delivery_date'),
          interview_date: parsed.interview_date ? dayjs(parsed.interview_date) : null,
          notes: parsed.notes || '',
        });
        setAutoFillSource('图片识别');
        message.success(`识别成功 - ${parsed.company || '?'} / ${parsed.position || '?'}`);
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'OCR识别失败');
    } finally {
      setOcrLoading(false);
    }
    return false; // Prevent default upload behavior
  };

  const handleUrlParse = async () => {
    if (!urlInput.trim()) {
      message.warning('请输入招聘链接');
      return;
    }
    setUrlLoading(true);
    try {
      const res = await api.post('/parse-url', { url: urlInput.trim() });
      const data = res.data;
      if (!data.company && !data.position) {
        message.warning('未能解析页面信息，请手动填写');
      } else {
        form.setFieldsValue({
          company: data.company || form.getFieldValue('company'),
          position: data.position || form.getFieldValue('position'),
          job_url: data.job_url || urlInput,
        });
        setAutoFillSource(data.source ? `${data.source}解析` : '链接解析');
        message.success(`解析成功 - ${data.company || '?'} / ${data.position || '?'}`);
      }
    } catch (e) {
      message.error(e.response?.data?.error || '解析失败');
    } finally {
      setUrlLoading(false);
    }
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    const data = {
      ...values,
      delivery_date: values.delivery_date.format('YYYY-MM-DD'),
      interview_date: values.interview_date ? values.interview_date.format('YYYY-MM-DD') : '',
    };
    onSubmit(data);
  };

  return (
    <Modal
      title={
        <span>
          {initialValues ? '编辑投递' : '新增投递'}
          {autoFillSource && (
            <Tag color="green" style={{ marginLeft: 8 }}>
              <CheckOutlined /> {autoFillSource}
            </Tag>
          )}
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
      width={560}
    >
      {/* Smart input area */}
      {!initialValues && (
        <div style={{ marginBottom: 16, padding: 12, background: '#f6f6f6', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <LinkOutlined style={{ color: '#888' }} />
              <Input
                placeholder="粘贴招聘链接自动解析（BOSS直聘/拉勾/猎聘等）"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPressEnter={handleUrlParse}
              />
              <Button
                icon={<ScanOutlined />}
                loading={urlLoading}
                onClick={handleUrlParse}
              >
                解析
              </Button>
            </div>
            <Upload.Dragger
              accept="image/*"
              beforeUpload={handleOcrUpload}
              showUploadList={false}
              multiple={false}
              style={{ margin: 0 }}
            >
              {ocrLoading ? (
                <div style={{ padding: 12 }}>
                  <Spin /> <span style={{ marginLeft: 8 }}>正在识别图片...</span>
                </div>
              ) : (
                <div style={{ padding: 12 }}>
                  <InboxOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
                    拖拽或点击上传图片，自动识别投递信息
                  </p>
                </div>
              )}
            </Upload.Dragger>
          </Space>
        </div>
      )}

      <Form form={form} layout="vertical">
        <Form.Item name="company" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
          <Input placeholder="如：字节跳动" />
        </Form.Item>
        <Form.Item name="position" label="岗位名称" rules={[{ required: true, message: '请输入岗位名称' }]}>
          <Input placeholder="如：前端开发实习生" />
        </Form.Item>
        <Form.Item name="job_url" label="岗位链接">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="delivery_date" label="投递日期" rules={[{ required: true, message: '请选择日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="interview_date" label="面试时间">
          <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm" placeholder="选择面试时间（可选）" />
        </Form.Item>
        <Form.Item name="status" label="当前状态">
          <Select options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} onChange={v => setCurrentStatus(v)} />
        </Form.Item>
        <Form.Item name="resume_version_id" label="简历版本">
          <Select allowClear placeholder="选择使用的简历版本（可选）" options={resumeVersions.map(r => ({ value: r.id, label: r.version_name }))} />
        </Form.Item>
        {currentStatus === '拒信' && (
          <>
            <Form.Item name="rejection_stage" label="被拒环节">
              <Select options={['简历筛选', '笔试', '一面', '二面', 'HR面', '总监面', '终面', '其他'].map(s => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="rejection_reason" label="拒因">
              <Input placeholder="如：经验不足、岗位不匹配..." />
            </Form.Item>
          </>
        )}
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} placeholder="备注信息..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
