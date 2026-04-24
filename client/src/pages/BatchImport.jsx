import React, { useState } from 'react';
import { Upload, Button, Table, Steps, message, Tag, Card, Select, Space, Spin } from 'antd';
import { InboxOutlined, UploadOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../api';

const { Dragger } = Upload;

const COLUMN_MAPPING = {
  company: '公司',
  position: '岗位',
  delivery_date: '投递日期',
  interview_date: '面试时间',
  status: '状态',
  job_url: '链接',
  notes: '备注',
};

export default function BatchImport() {
  const [step, setStep] = useState(0);
  const [header, setHeader] = useState([]);
  const [preview, setPreview] = useState([]);
  const [total, setTotal] = useState(0);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHeader(res.data.header);
      setPreview(res.data.preview);
      setTotal(res.data.total);
      setStep(1);
    } catch (e) {
      message.error(e.response?.data?.error || '解析失败');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await api.post('/import/confirm', { rows: preview, mapping });
      setResult(res.data);
      setStep(2);
    } catch (e) {
      message.error(e.response?.data?.error || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = '﻿公司,岗位,投递日期,面试时间,状态,链接,备注\n字节跳动,前端实习生,2026-04-24,,已投递,,\n腾讯,后端开发实习生,2026-04-23,2026-04-28,笔试,,\n阿里,产品经理实习生,2026-04-22,,一面,,';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '投递模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewColumns = header.map(h => ({
    title: h,
    dataIndex: h,
    key: h,
    ellipsis: true,
  }));

  return (
    <div style={{ maxWidth: 900 }}>
      <h3>批量导入</h3>

      <Steps current={step} style={{ marginBottom: 24 }} items={[
        { title: '上传文件' },
        { title: '确认导入' },
        { title: '完成' },
      ]} />

      {step === 0 && (
        <Card>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
          </div>
          <Dragger accept=".csv" beforeUpload={handleUpload} showUploadList={false}>
            {loading ? (
              <div style={{ padding: 24 }}><Spin /> 解析中...</div>
            ) : (
              <>
                <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
                <p style={{ margin: '8px 0' }}>拖拽或点击上传 CSV 文件</p>
                <p style={{ color: '#999', fontSize: 13 }}>支持 Excel 另存为 CSV，最多导入 100 条</p>
              </>
            )}
          </Dragger>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <p style={{ marginBottom: 16 }}>共识别 <strong>{total}</strong> 条数据，预览前 10 条：</p>

          <Table
            dataSource={preview}
            columns={previewColumns}
            size="small"
            pagination={false}
            scroll={{ x: true }}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <span>列映射：</span>
            {Object.entries(COLUMN_MAPPING).map(([key, label]) => (
              <Select
                key={key}
                style={{ width: 140 }}
                placeholder={label}
                value={mapping[key]}
                onChange={(v) => setMapping({ ...mapping, [key]: v })}
                options={header.map(h => ({ value: h, label: h }))}
                allowClear
              />
            ))}
          </div>

          <Space>
            <Button onClick={() => setStep(0)}>上一步</Button>
            <Button type="primary" onClick={handleImport} loading={loading}>
              确认导入 {total} 条
            </Button>
          </Space>
        </Card>
      )}

      {step === 2 && result && (
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <h3>导入完成</h3>
            <p>成功导入 <Tag color="green">{result.imported} 条</Tag></p>
            {result.errors.length > 0 && (
              <div style={{ textAlign: 'left', marginTop: 16 }}>
                <h4>错误信息：</h4>
                {result.errors.map((e, i) => <div key={i} style={{ color: '#ff4d4f', fontSize: 13 }}>{e}</div>)}
              </div>
            )}
            <Button type="primary" style={{ marginTop: 16 }} onClick={() => { setStep(0); setResult(null); setMapping({}); }}>
              继续导入
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
