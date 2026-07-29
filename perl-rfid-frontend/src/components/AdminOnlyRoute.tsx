import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import { canViewSchoolWorkspace } from '../lib/permissions';

export const AdminOnlyRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || !canViewSchoolWorkspace(user.role)) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
