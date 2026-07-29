import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import { canViewLiveMonitor } from '../lib/permissions';

export const StaffOnlyRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || !canViewLiveMonitor(user.role)) {
    return <Navigate to="/logs" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
