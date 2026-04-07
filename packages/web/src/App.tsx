import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Landing from './components/Landing/Landing';
import Workspace from './components/Workspace/Workspace';
import Toast from './components/shared/Toast';
import ConfigModal from './components/Config/ConfigModal';
import AgentProfileDrawer from './components/Profile/AgentProfileDrawer';
import ErrorBoundary from './components/shared/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/company/:id" element={<Workspace />} />
      </Routes>
      <Toast />
      <ConfigModal />
      <AgentProfileDrawer />
    </ErrorBoundary>
  );
};

export default App;
