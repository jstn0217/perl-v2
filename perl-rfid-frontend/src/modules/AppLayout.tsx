import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { OfflineBanner } from '../components/OfflineBanner';
import { SchoolMark } from '../components/SchoolMark';
import { AppNavigationDrawer } from './AppNavigationDrawer';
import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import { useTenantContext } from '../providers/TenantContext';
import { enterSupportSchool } from '../lib/api';
import { isPlatformUser } from '../lib/permissions';

export const AppLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportContextError, setSupportContextError] = useState<string | null>(null);
  const { school } = useSchoolTheme();
  const { user, logout } = useAuth();
  const { activeSchool, schools, setActiveSchoolSlug } = useTenantContext();

  useEffect(() => {
    if (!user || isPlatformUser(user.role) || activeSchool.id === user.schoolId) {
      return;
    }

    const matchingSchool = schools.find((availableSchool) => availableSchool.id === user.schoolId);

    if (matchingSchool) {
      setActiveSchoolSlug(matchingSchool.slug);
    }
  }, [activeSchool.id, schools, setActiveSchoolSlug, user]);

  const roleLabel = user?.role
    ? user.role
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';

  return (
    <main className="dashboard-shell">
      <OfflineBanner />
      <section className="dashboard-frame">
        <header className="dashboard-header">
          <div className="brand-lockup">
            <SchoolMark name={school.name} logoUrl={school.logoUrl} compact />
            <div>
              <p className="eyebrow">PERL attendance</p>
              <h1>{school.name}</h1>
            </div>
          </div>

          <div className="dashboard-actions">
            {isPlatformUser(user?.role) ? (
              <label className="support-school-switcher">
                <span>Support context</span>
                <select
                  value={activeSchool.slug}
                  onChange={(event) => {
                    const selected = schools.find(
                      (availableSchool) => availableSchool.slug === event.target.value
                    );
                    if (!selected) return;
                    setSupportContextError(null);
                    void enterSupportSchool(selected.id)
                      .then(() => setActiveSchoolSlug(selected.slug))
                      .catch((error) =>
                        setSupportContextError(
                          error instanceof Error ? error.message : 'Unable to change support context.'
                        )
                      );
                  }}
                  aria-label="Select school support context"
                >
                  {schools.map((availableSchool) => (
                    <option key={availableSchool.id} value={availableSchool.slug}>
                      {availableSchool.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {supportContextError ? (
              <span className="support-context-error" role="alert">{supportContextError}</span>
            ) : null}
            <div className="user-chip">
              <span className="user-chip__avatar" aria-hidden="true">
                {user?.firstName.slice(0, 1)}{user?.lastName.slice(0, 1)}
              </span>
              <span className="user-chip__identity">
                <strong>{user?.firstName} {user?.lastName}</strong>
                <small>{roleLabel}</small>
              </span>
            </div>
            <button
              className="menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <span className="menu-button__icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Menu
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <Outlet />
        </div>
      </section>

      <AppNavigationDrawer
        open={menuOpen}
        role={user?.role ?? 'STUDENT'}
        onClose={() => setMenuOpen(false)}
        onSignOut={() => {
          setMenuOpen(false);
          void logout();
        }}
      />
    </main>
  );
};
