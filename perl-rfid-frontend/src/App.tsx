import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminOnlyRoute } from './components/AdminOnlyRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StaffOnlyRoute } from './components/StaffOnlyRoute';
import { SupportOnlyRoute } from './components/SupportOnlyRoute';
import { AppLayout } from './modules/AppLayout';
import { AttendanceLogsPage } from './pages/AttendanceLogsPage';
import { AttendanceMonitorPage } from './pages/AttendanceMonitorPage';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { LoginPage } from './pages/LoginPage';
import { SchoolProfileAdminPage } from './pages/SchoolProfileAdminPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SupportSchoolsPage } from './pages/SupportSchoolsPage';
import { LandingPage } from './pages/LandingPage';
import { useAuth } from './providers/auth-context';
import { NotificationLogsPage } from './pages/NotificationLogsPage';

const App = () => {
  const { status } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardHomePage />} />
          <Route path="logs" element={<AttendanceLogsPage />} />
          <Route element={<StaffOnlyRoute />}>
            <Route path="monitor" element={<AttendanceMonitorPage />} />
          </Route>
          <Route element={<AdminOnlyRoute />}>
            <Route path="admin/profile" element={<SchoolProfileAdminPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="admin/devices" element={<DeviceManagementPage />} />
            <Route path="audit" element={<AuditLogsPage />} />
            <Route path="admin/notifications" element={<NotificationLogsPage />} />
          </Route>
          <Route element={<SupportOnlyRoute />}>
            <Route path="support/schools" element={<SupportSchoolsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={status === 'authenticated' ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
};

export default App;
