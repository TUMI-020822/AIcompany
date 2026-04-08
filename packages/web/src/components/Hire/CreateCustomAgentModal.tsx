import React, { useState } from 'react';
import { useStore } from '../../store';
import Modal from '../shared/Modal';
import * as api from '../../services/api';
import { DEPT_COLORS } from '../../types';

const PRESET_PROMPTS = [
  { label: '通用助手', value: '你是一个有用的AI助手，擅长回答各种问题。' },
  { label: '技术专家', value: '你是一位资深技术专家，精通各类技术问题，擅长代码编写和技术方案设计。' },
  { label: '创意写手', value: '你是一位才华横溢的创意写手，擅长创作文案、故事和各类创意内容。' },
  { label: '分析顾问', value: '你是一位专业的数据分析师和商业顾问，擅长从数据中提炼洞察并提供建议。' },
  { label: '空空白板', value: '' },
];

interface Props {
  onClose: () => void;
}

const CreateCustomAgentModal: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const currentCompany = useStore((s) => s.currentCompany);
  const setCatalogAgents = useStore((s) => s.setCatalogAgents);
  const catalogAgents = useStore((s) => s.catalogAgents);
  const addToast = useStore((s) => s.addToast);

  // Get available departments
  const allDepts = [
    '产品部', '工程部', '设计部', '数据部', '市场部', '运营部',
    '战略部', '法务部', 'HR部', '创意部',
    ...(currentCompany?.customDepts?.map(d => d.name) || []),
  ];

  const handlePresetSelect = (value: string) => {
    setSystemPrompt(value);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      addToast('请输入员工名称', 'error');
      return;
    }

    if (!currentCompany) {
      addToast('未选择公司', 'error');
      return;
    }

    setSaving(true);
    try {
      const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

      const newAgent = await api.createCustomAgent(currentCompany.id, {
        name: trimmedName,
        dept: dept || '创意部',
        description: desc.trim(),
        tags: parsedTags,
        systemPrompt: systemPrompt.trim(),
      });

      // Update catalog with new custom agent
      setCatalogAgents([...catalogAgents, newAgent]);

      addToast(`自定义员工「${trimmedName}」创建成功！`);
      onClose();
    } catch (err: any) {
      addToast(`创建失败: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="创建自定义员工" description="定义一个专属于你的AI员工角色。" onClose={onClose} width="600px">
      <div className="form-group">
        <label>员工名称 <span style={{ color: '#ef4444' }}>*</span></label>
        <input
          type="text"
          placeholder="例如：智能客服、高级顾问"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={20}
        />
      </div>

      <div className="form-group">
        <label>所属部门</label>
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">选择部门（可选）</option>
          {allDepts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>员工描述</label>
        <textarea
          placeholder="简要描述这个员工的工作职责和能力..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          maxLength={200}
        />
      </div>

      <div className="form-group">
        <label>技能标签</label>
        <input
          type="text"
          placeholder="用逗号分隔，如：写作,分析,编程"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
          多个标签用逗号分隔
        </span>
      </div>

      <div className="form-group">
        <label>系统提示词（System Prompt）</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePresetSelect(p.value)}
              className={`btn-secondary ${systemPrompt === p.value ? 'active' : ''}`}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                background: systemPrompt === p.value ? 'var(--accent)' : undefined,
                color: systemPrompt === p.value ? '#fff' : undefined,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          placeholder="定义AI员工的身份、行为规则、专业能力等..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
          提示词越详细，AI员工的表现越符合预期
        </span>
      </div>

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>
          取消
        </button>
        <button className="btn-primary" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? '创建中...' : '创建员工'}
        </button>
      </div>
    </Modal>
  );
};

export default CreateCustomAgentModal;
