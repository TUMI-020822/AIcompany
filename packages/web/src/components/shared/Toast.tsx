import React from 'react';
import { useStore } from '../../store';

const Toast: React.FC = () => {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  return (
    <div className="toast-container">
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          style={{ top: `${20 + i * 70}px` }}
          onClick={() => dismissToast(t.id)}
        >
          <div className="toast-content">
            <span className="toast-icon">
              {t.type === 'error' && '❌'}
              {t.type === 'success' && '✅'}
              {t.type === 'warning' && '⚠️'}
              {t.type === 'info' && 'ℹ️'}
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
          {t.suggestion && (
            <div className="toast-suggestion">{t.suggestion}</div>
          )}
          <button className="toast-close" onClick={() => dismissToast(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
