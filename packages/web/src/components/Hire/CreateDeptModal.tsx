import React, { useState } from 'react';
import { useStore } from '../../store';
import Modal from '../shared/Modal';
import * as api from '../../services/api';

const DEPT_COLORS_PRESET = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

interface Props {
  onClose: () => void;
}

const CreateDeptModal: React.FC<Props> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEPT_COLORS_PRESET[0]);
  const [saving, setSaving] = useState(false);

  const currentCompany = useStore((s) => s.currentCompany);
  const updateCompany = useStore((s) => s.updateCompany);
  const addToast = useStore((s) => s.addToast);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast('请输入部门名称', 'error');
      return;
    }

    if (!currentCompany) {
      addToast('未选择公司', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.addDepartment(currentCompany.id, { name: trimmed, color });

      // Update local state
      const customDepts = [...(currentCompany.customDepts || []), { name: trimmed, color }];
      updateCompany({ ...currentCompany, customDepts });

      addToast(`部门「${trimmed}」创建成功！`);
      onClose();
    } catch (err: any) {
      if (err.message?.includes('409')) {
        addToast('该部门已存在', 'error');
      } else {
        addToast(`创建失败: ${err.message}`, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="创建新部门" description="为公司添加新的业务部门，组织你的AI团队。" onClose={onClose}>
      <div className="form-group">
        <label>部门名称</label>
        <input
          type="text"
          placeholder="例如：客服部、质量部、创新部"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={20}
        />
      </div>

      <div className="form-group">
        <label>部门颜色</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {DEPT_COLORS_PRESET.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: c,
                border: color === c ? '3px solid #fff' : '3px solid transparent',
                cursor: 'pointer',
                boxShadow: color === c ? '0 0 0 2px #333' : 'none',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
          }}
        >
          {name.charAt(0) || '部'}
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          预览效果：{name || '部门名称'}
        </span>
      </div>

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>
          取消
        </button>
        <button className="btn-primary" onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? '创建中...' : '创建部门'}
        </button>
      </div>
    </Modal>
  );
};

export default CreateDeptModal;
