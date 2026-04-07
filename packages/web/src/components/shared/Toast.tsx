import React from 'react';
import { useStore } from '../../store';

const Toast: React.FC = () => {
  const toasts = useStore((s) => s.toasts);

  return (
    <>
      {toasts.map((t, i) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          style={{ top: `${20 + i * 60}px` }}
        >
          {t.message}
        </div>
      ))}
    </>
  );
};

export default Toast;
