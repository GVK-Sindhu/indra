import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { EngineerDashboard } from './dashboards/EngineerDashboard.js';
import { ManagerDashboard } from './dashboards/ManagerDashboard.js';
import { AdminDashboard } from './dashboards/AdminDashboard.js';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
    case 'ENGINEER':
    default:
      return <EngineerDashboard />;
  }
};

export default Dashboard;
