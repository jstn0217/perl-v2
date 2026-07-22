import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';

export const DashboardHome = () => {
  const { user } = useAuth();
  const { school } = useSchoolTheme();

  return (
    <section className="dashboard-grid">
      <article className="preview-panel preview-panel--primary">
        <p className="panel-label">Session contract</p>
        <h2>Protected routes now depend on auth state instead of page-local checks.</h2>
        <p className="identity-copy">
          Signed in as {user?.firstName} {user?.lastName} for {school.name}.
        </p>
      </article>

      <article className="preview-panel">
        <p className="panel-label">Current guarantees</p>
        <ul className="promise-list">
          <li>`GET /api/auth/session` restores the user from an HttpOnly cookie.</li>
          <li>`POST /api/auth/login` issues the session cookie without client-side token storage.</li>
          <li>School branding stays consistent across public and protected screens.</li>
        </ul>
      </article>
    </section>
  );
};
