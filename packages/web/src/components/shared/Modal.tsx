import React from 'react';

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  width?: string;
}

const Modal: React.FC<ModalProps> = ({ title, description, onClose, children, className = '', width }) => {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${className}`} style={width ? { width } : undefined}>
        <h2>{title}</h2>
        {description && <p className="desc">{description}</p>}
        {children}
      </div>
    </div>
  );
};

export default Modal;
