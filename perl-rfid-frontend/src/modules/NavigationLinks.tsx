import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { appRoutes } from '../routes';
import type { UserRole } from '../types/admin';

interface NavigationLinksProps {
  role: UserRole;
  onNavigate?: () => void;
}

export const NavigationLinks = ({ role, onNavigate }: NavigationLinksProps) => {
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
    <nav className="app-drawer-nav" aria-label="Primary">
      {groups.map((group) => (
        <Fragment key={group.label}>
          <p className="app-drawer-nav__label">{group.label}</p>
          {group.routes.map((route) => {
            const Icon = route.nav!.icon;
            return (
              <NavLink key={route.path} to={`/${route.path}`} onClick={onNavigate}>
                <Icon className="app-drawer-nav__icon" size={18} aria-hidden="true" />
                {typeof route.nav!.label === 'function' ? route.nav!.label(role) : route.nav!.label}
              </NavLink>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
};
