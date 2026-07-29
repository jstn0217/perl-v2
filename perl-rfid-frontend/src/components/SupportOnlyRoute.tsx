import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import { isPlatformSupport } from '../lib/permissions';

export const SupportOnlyRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!isPlatformSupport(user?.role)) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
