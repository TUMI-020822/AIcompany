import React, { useEffect } from 'react';
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
  const companies = useStore((s) => s.companies);
  const currentCompany = useStore((s) => s.currentCompany);
  const setCurrentCompany = useStore((s) => s.setCurrentCompany);
  const currentPage = useStore((s) => s.currentPage);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  useEffect(() => {
    const company = companies.find((c) => c.id === id);
    if (!company) {
      navigate('/');
      return;
    }
    setCurrentCompany(company);
    // Restore custom dept colors
    (company.customDepts || []).forEach((cd) => {
      DEPT_COLORS[cd.name] = cd.color;
    });
    setCurrentPage('chat');
  }, [id, companies, navigate, setCurrentCompany, setCurrentPage]);

  if (!currentCompany) return null;

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
