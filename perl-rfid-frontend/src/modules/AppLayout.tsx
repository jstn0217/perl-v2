import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { AccountMenu } from '../components/AccountMenu';
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
      <div className="app-body">
        <section className="dashboard-frame">
          <header className="dashboard-header">
            <div className="dashboard-header__start">
              <button
                className="menu-button app-drawer-toggle"
                type="button"
                aria-expanded={menuOpen}
                aria-label="Open navigation"
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="menu-button__icon" size={20} aria-hidden="true" />
                <span className="menu-button__label">Menu</span>
              </button>

              <div className="brand-lockup">
                <SchoolMark name={school.name} logoUrl={school.logoUrl} compact />
                <h1>{school.name}</h1>
              </div>
            </div>

            <div className="dashboard-actions">
              {isPlatformUser(user?.role) ? (
                <div className="support-context">
                  <label className="support-context__field">
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
                  {supportContextError ? (
                    <span className="support-context-error" role="alert">{supportContextError}</span>
                  ) : null}
                </div>
              ) : null}
              {user ? <AccountMenu user={user} roleLabel={roleLabel} onSignOut={() => void logout()} /> : null}
            </div>
          </header>

          <div className="dashboard-content">
            <Outlet />
          </div>

          <footer className="app-footer">
            <img src="/brand/perl-mark-96.png" alt="" width="20" height="17" aria-hidden="true" />
            <span>Powered by AMoS</span>
          </footer>
        </section>
      </div>

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
