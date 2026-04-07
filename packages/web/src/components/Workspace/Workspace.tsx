import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import Sidebar from './Sidebar';
import ChatPage from '../Chat/ChatPage';
import HirePage from '../Hire/HirePage';
import ContactsPage from '../Contacts/ContactsPage';
import WorkbenchPage from '../Workbench/WorkbenchPage';
import OutputPage from '../Output/OutputPage';
import { DEPT_COLORS } from '../../types';

const Workspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentCompany = useStore((s) => s.currentCompany);
  const enterCompany = useStore((s) => s.enterCompany);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const loadCatalog = useStore((s) => s.loadCatalog);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const company = await enterCompany(id);
      if (cancelled) return;
      if (!company) {
        navigate('/');
        return;
      }
      // Load catalog for hire page
      await loadCatalog(id);
      // Restore custom dept colors
      (company.customDepts || []).forEach((cd) => {
        DEPT_COLORS[cd.name] = cd.color;
      });
      setCurrentPage('chat');
      setLoading(false);
    };

    init();
    return () => { cancelled = true; };
  }, [id]);

  if (loading || !currentCompany) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'chat': return <ChatPage />;
      case 'hire': return <HirePage />;
      case 'contacts': return <ContactsPage />;
      case 'work': return <WorkbenchPage />;
      case 'output': return <OutputPage />;
      default: return <ChatPage />;
    }
  };

  return (
    <div className="workspace">
      <Sidebar />
      <div className="main-content">
        {renderPage()}
      </div>
    </div>
  );
};

export default Workspace;
