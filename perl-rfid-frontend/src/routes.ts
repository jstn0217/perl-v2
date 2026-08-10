import type { ComponentType } from 'react';
import {
  Building2,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  MessageSquare,
  ScanLine,
  ScrollText,
  Users,
  type LucideIcon
} from 'lucide-react';
import { AttendanceLogsPage } from './pages/AttendanceLogsPage';
import { AttendanceMonitorPage } from './pages/AttendanceMonitorPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { NotificationLogsPage } from './pages/NotificationLogsPage';
import { SchoolProfileAdminPage } from './pages/SchoolProfileAdminPage';
import { SupportSchoolsPage } from './pages/SupportSchoolsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import {
  canViewLiveMonitor,
  canViewSchoolWorkspace,
  isPlatformSupport,
  isPlatformUser,
  isSupportAgent
} from './lib/permissions';
import type { UserRole } from './types/admin';

export type RouteGuard = (role: UserRole | undefined) => boolean;

export interface AppRouteNav {
  icon: LucideIcon;
  label: string | ((role: UserRole) => string);
  group: string | ((role: UserRole) => string);
}

export interface AppRouteDef {
  Component: ComponentType;
  /** Where an unauthorized visitor is redirected. Ignored when `guard` is absent. */
  guard?: RouteGuard;
  nav?: AppRouteNav;
  path: string;
  redirectTo: string;
}

/**
 * Single source of truth for every authenticated route: its guard and its nav-drawer
 * presence. App.tsx's route tree and AppNavigationDrawer's visible-link list both read
 * this array, so a route's access rule can't drift between the two.
 */
export const appRoutes: AppRouteDef[] = [
  {
    path: 'dashboard',
    Component: DashboardHomePage,
    redirectTo: '/dashboard',
    nav: { icon: LayoutDashboard, label: 'Overview', group: 'Attendance' }
  },
  {
    path: 'account',
    Component: EditProfilePage,
    redirectTo: '/dashboard'
  },
  {
    path: 'monitor',
    Component: AttendanceMonitorPage,
    guard: canViewLiveMonitor,
    redirectTo: '/logs',
    nav: { icon: ScanLine, label: 'Live monitor', group: 'Attendance' }
  },
  {
    path: 'logs',
    Component: AttendanceLogsPage,
    redirectTo: '/dashboard',
    nav: { icon: ClipboardList, label: 'Attendance records', group: 'Reports' }
  },
  {
    path: 'admin/profile',
    Component: SchoolProfileAdminPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
      icon: Building2,
      label: 'School profile',
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'admin/users',
    Component: UserManagementPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
      icon: Users,
      label: 'People',
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'admin/devices',
    Component: DeviceManagementPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
      icon: Cpu,
      label: 'Devices',
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'admin/notifications',
    Component: NotificationLogsPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
      icon: MessageSquare,
      label: 'SMS delivery',
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'audit',
    Component: AuditLogsPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
      icon: ScrollText,
      label: (role) => (isPlatformUser(role) ? 'System action log' : 'School action log'),
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'support/schools',
    Component: SupportSchoolsPage,
    guard: isPlatformSupport,
    redirectTo: '/dashboard',
    nav: { icon: Building2, label: 'School accounts', group: 'Platform support' }
  }
];
