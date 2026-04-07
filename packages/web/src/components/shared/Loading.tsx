/**
 * 加载状态组件
 */

import React from 'react';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  text = '加载中...',
  size = 'medium',
  fullScreen = false,
}) => {
  const sizeClass = `loading-${size}`;

  const content = (
    <div className={`loading-container ${sizeClass}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        {content}
      </div>
    );
  }

  return content;
};

export const LoadingCard: React.FC<{ title?: string }> = ({ title }) => (
  <div className="loading-card">
    <div className="loading-card-header">
      <div className="loading-skeleton loading-skeleton-title"></div>
    </div>
    <div className="loading-card-body">
      <div className="loading-skeleton loading-skeleton-line"></div>
      <div className="loading-skeleton loading-skeleton-line"></div>
      <div className="loading-skeleton loading-skeleton-line short"></div>
    </div>
    {title && <span className="loading-card-label">{title}</span>}
  </div>
);

export const LoadingList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="loading-list">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="loading-list-item">
        <div className="loading-skeleton loading-skeleton-avatar"></div>
        <div className="loading-list-content">
          <div className="loading-skeleton loading-skeleton-line"></div>
          <div className="loading-skeleton loading-skeleton-line short"></div>
        </div>
      </div>
    ))}
  </div>
);

export default Loading;
