import { NavLink } from 'react-router-dom';
import { Modal } from '../components/Modal';
import type { UserRole } from '../types/admin';
import {
  canViewSchoolWorkspace,
  canViewLiveMonitor,
  isPlatformUser,
  isSupportAgent
} from '../lib/permissions';

interface AppNavigationDrawerProps {
  role: UserRole;
  onClose: () => void;
  onSignOut: () => void;
  open: boolean;
}

export const AppNavigationDrawer = ({
  role,
  onClose,
  onSignOut,
  open
}: AppNavigationDrawerProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Navigation"
    description="Attendance operations and school administration."
    variant="drawer"
  >
    <nav className="app-drawer-nav" aria-label="Primary">
      <p className="app-drawer-nav__label">Attendance</p>
      <NavLink to="/dashboard" onClick={onClose}>Overview</NavLink>
      {canViewLiveMonitor(role) ? (
        <NavLink to="/monitor" onClick={onClose}>Live monitor</NavLink>
      ) : null}
      <NavLink to="/logs" onClick={onClose}>Attendance records</NavLink>

      {canViewSchoolWorkspace(role) ? (
        <>
          <p className="app-drawer-nav__label">
            {isSupportAgent(role) ? 'School records' : 'School management'}
          </p>
          <NavLink to="/admin/users" onClick={onClose}>People</NavLink>
          <NavLink to="/admin/devices" onClick={onClose}>Devices</NavLink>
          <NavLink to="/admin/profile" onClick={onClose}>School profile</NavLink>
          <NavLink to="/admin/notifications" onClick={onClose}>SMS delivery</NavLink>
          <NavLink to="/audit" onClick={onClose}>
            {isPlatformUser(role) ? 'System action log' : 'School action log'}
          </NavLink>
        </>
      ) : null}

      {isPlatformUser(role) ? (
        <>
          <p className="app-drawer-nav__label">Platform support</p>
          <NavLink to="/support/schools" onClick={onClose}>School accounts</NavLink>
        </>
      ) : null}
    </nav>

    <button
      className="secondary-button secondary-button--danger app-drawer-signout"
      type="button"
      onClick={onSignOut}
    >
      Sign out
    </button>
  </Modal>
);
