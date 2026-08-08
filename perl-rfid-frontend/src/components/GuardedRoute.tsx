import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import type { RouteGuard } from '../routes';

interface GuardedRouteProps {
  guard: RouteGuard;
  redirectTo: string;
}

/** Generic role-guard used by every route in `routes.ts` that declares a `guard`. */
export const GuardedRoute = ({ guard, redirectTo }: GuardedRouteProps) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!guard(user?.role)) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <Outlet />;
};
