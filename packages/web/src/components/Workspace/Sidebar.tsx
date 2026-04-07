import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, type PageId } from '../../store';
import { ChatIcon, HireIcon, ContactsIcon, WorkIcon, OutputIcon } from '../shared/Icons';

const NAV_ITEMS: { id: PageId; icon: React.FC<{ className?: string }>; badge?: number }[] = [
  { id: 'chat', icon: ChatIcon, badge: 3 },
  { id: 'hire', icon: HireIcon },
  { id: 'contacts', icon: ContactsIcon },
  { id: 'work', icon: WorkIcon },
  { id: 'output', icon: OutputIcon },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const currentCompany = useStore((s) => s.currentCompany);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  if (!currentCompany) return null;

  const hue = currentCompany.name.charCodeAt(0) % 360;

  return (
    <div className="sidebar">
      <div
        className="sidebar-logo"
        style={{ background: `hsl(${hue},65%,55%)` }}
        onClick={() => navigate('/')}
        title="返回首页"
      >
        {currentCompany.name.charAt(0)}
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <div
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <Icon />
              {item.badge && !isActive && (
                <span className="badge">{item.badge}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-avatar" onClick={() => navigate('/')}>
          我
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
