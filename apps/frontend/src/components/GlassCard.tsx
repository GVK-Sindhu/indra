import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hoverEffect = true }) => {
  return (
    <div
      className={`glass-panel rounded-2xl p-6 ${
        hoverEffect ? 'glass-panel-hover' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;
