import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { appRoutes } from '../routes';
import type { UserRole } from '../types/admin';

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
}: AppNavigationDrawerProps) => {
  const navRoutes = appRoutes.filter((route) => route.nav && (!route.guard || route.guard(role)));
  const groups: { label: string; routes: typeof navRoutes }[] = [];

  navRoutes.forEach((route) => {
    const groupLabel = typeof route.nav!.group === 'function' ? route.nav!.group(role) : route.nav!.group;
    const existingGroup = groups.find((group) => group.label === groupLabel);

    if (existingGroup) {
      existingGroup.routes.push(route);
    } else {
      groups.push({ label: groupLabel, routes: [route] });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Navigation"
      description="Attendance operations and school administration."
      variant="drawer"
    >
      <nav className="app-drawer-nav" aria-label="Primary">
        {groups.map((group) => (
          <Fragment key={group.label}>
            <p className="app-drawer-nav__label">{group.label}</p>
            {group.routes.map((route) => (
              <NavLink key={route.path} to={`/${route.path}`} onClick={onClose}>
                {typeof route.nav!.label === 'function' ? route.nav!.label(role) : route.nav!.label}
              </NavLink>
            ))}
          </Fragment>
        ))}
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
};
