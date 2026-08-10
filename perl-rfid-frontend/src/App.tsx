import { Navigate, Route, Routes } from 'react-router-dom';
import { GuardedRoute } from './components/GuardedRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './modules/AppLayout';
import { DeviceKioskPage } from './pages/DeviceKioskPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { appRoutes } from './routes';
import { useAuth } from './providers/auth-context';

const App = () => {
  const { status } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/device" element={<DeviceKioskPage />} />
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {appRoutes.map(({ path, Component, guard, redirectTo }) =>
            guard ? (
              <Route key={path} element={<GuardedRoute guard={guard} redirectTo={redirectTo} />}>
                <Route path={path} element={<Component />} />
              </Route>
            ) : (
              <Route key={path} path={path} element={<Component />} />
            )
          )}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={status === 'authenticated' ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
};

export default App;
