import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';

const SchoolMark = ({ name, logoUrl }: { name: string; logoUrl: string | null }) => {
  if (logoUrl) {
    return <img className="school-mark school-mark--compact" src={logoUrl} alt={`${name} logo`} />;
  }

  return (
    <div className="school-mark school-mark--fallback school-mark--compact">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
};

export const AppLayout = () => {
  const { school } = useSchoolTheme();
  const { user, logout } = useAuth();

  return (
    <main className="dashboard-shell">
      <section className="dashboard-frame">
        <header className="dashboard-header">
          <div className="brand-lockup">
            <SchoolMark name={school.name} logoUrl={school.logoUrl} />
            <div>
              <p className="eyebrow">Attendance console</p>
              <h1>{school.name}</h1>
            </div>
          </div>

          <div className="dashboard-actions">
            <div className="user-chip">
              <span>{user?.firstName} {user?.lastName}</span>
              <strong>{user?.role}</strong>
            </div>
            <button className="secondary-button" type="button" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </header>

        <nav className="dashboard-nav" aria-label="Primary">
          <Link to="/">Overview</Link>
        </nav>

        <Outlet />
      </section>
    </main>
  );
};
