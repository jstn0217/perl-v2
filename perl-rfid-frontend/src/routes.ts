import type { ComponentType } from 'react';
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
    nav: { label: 'Overview', group: 'Attendance' }
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
    nav: { label: 'Live monitor', group: 'Attendance' }
  },
  {
    path: 'logs',
    Component: AttendanceLogsPage,
    redirectTo: '/dashboard',
    nav: { label: 'Attendance records', group: 'Attendance' }
  },
  {
    path: 'admin/profile',
    Component: SchoolProfileAdminPage,
    guard: canViewSchoolWorkspace,
    redirectTo: '/dashboard',
    nav: {
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
      label: (role) => (isPlatformUser(role) ? 'System action log' : 'School action log'),
      group: (role) => (isSupportAgent(role) ? 'School records' : 'School management')
    }
  },
  {
    path: 'support/schools',
    Component: SupportSchoolsPage,
    guard: isPlatformSupport,
    redirectTo: '/dashboard',
    nav: { label: 'School accounts', group: 'Platform support' }
  }
];
