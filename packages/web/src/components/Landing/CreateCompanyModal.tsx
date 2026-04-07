import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import Modal from '../shared/Modal';
import * as api from '../../services/api';
import type { Company } from '../../types';

const INDUSTRIES = [
  '科技/互联网', '金融/保险', '电商/零售', '教育/培训',
  '医疗/健康', '媒体/内容', '游戏/娱乐', '制造/工业', '咨询/服务',
];

interface Props {
  onClose: () => void;
}

const CreateCompanyModal: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const addCompany = useStore((s) => s.addCompany);
  const addToast = useStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast('请输入公司名称', 'error');
      return;
    }
    setCreating(true);
    try {
      const result = await api.createCompany({
        name: trimmed,
        industry,
        description: desc.trim(),
      });
      const company: Company = {
        id: result.id,
        name: result.name,
        industry: result.industry || '',
        desc: result.description || '',
        created: new Date(result.createdAt).getTime(),
        employees: [],
        tasks: [],
        employeeConfigs: {},
      };
      addCompany(company);
      onClose();
      navigate(`/company/${company.id}`);
    } catch (err) {
      addToast('创建公司失败: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal title="创建AI公司" description="给你的AI公司取一个名字，选择行业方向，开始组建团队。" onClose={onClose}>
      <div className="form-group">
        <label>公司名称</label>
        <input
          type="text"
          placeholder="例如：星辰AI科技"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="form-group">
        <label>所属行业</label>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>公司简介</label>
        <textarea
          placeholder="简要描述公司的业务方向和使命..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose} disabled={creating}>取消</button>
        <button className="btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? '创建中...' : '创建公司'}
        </button>
      </div>
    </Modal>
  );
};

export default CreateCompanyModal;
