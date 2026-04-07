import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { LogoIcon, CloseIcon } from '../shared/Icons';
import CreateCompanyModal from './CreateCompanyModal';
import type { Company } from '../../types';

function timeAgo(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

const Landing: React.FC = () => {
  const companies = useStore((s) => s.companies);
  const removeCompany = useStore((s) => s.removeCompany);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const enterCompany = (company: Company) => {
    navigate(`/company/${company.id}`);
  };

  return (
    <div className="landing">
      <div className="landing-header">
        <div className="landing-logo">
          <LogoIcon />
          <span>AI Agency</span>
        </div>
      </div>

      <div className="landing-hero">
        <h1 className="landing-title">
          组建你的<em>AI公司</em>
        </h1>
        <p className="landing-subtitle">
          聘用187个专业AI员工，像经营真实公司一样管理AI团队。发布任务，Agent集群自动协作，实时汇报进度。
        </p>

        <div className="landing-actions">
          <button className="btn-create" onClick={() => setShowCreate(true)}>
            + 创建新公司
          </button>
        </div>

        {companies.length > 0 && (
          <div className="companies-grid">
            {companies.map((company) => {
              const hue = company.name.charCodeAt(0) % 360;
              const empCount = (company.employees || []).length;
              const taskCount = (company.tasks || []).length;

              return (
                <div
                  key={company.id}
                  className="company-card"
                  onClick={() => enterCompany(company)}
                >
                  <div className="company-card-header">
                    <div
                      className="company-card-avatar"
                      style={{ background: `hsl(${hue},65%,55%)` }}
                    >
                      {company.name.charAt(0)}
                    </div>
                    <div className="company-card-info">
                      <h3>{company.name}</h3>
                      <p>{company.industry || '科技'}</p>
                    </div>
                  </div>
                  <div className="company-card-stats">
                    <span>员工 <strong>{empCount}</strong></span>
                    <span>任务 <strong>{taskCount}</strong></span>
                    <span>创建于 <strong>{timeAgo(company.created)}</strong></span>
                  </div>
                  <button
                    className="company-card-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定删除公司 "${company.name}" ？`)) {
                        removeCompany(company.id);
                      }
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateCompanyModal onClose={() => setShowCreate(false)} />}
    </div>
  );
};

export default Landing;
