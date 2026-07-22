import { useState } from 'react';
import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import { useTenantContext } from '../providers/TenantContext';

const SchoolMark = ({ name, logoUrl }: { name: string; logoUrl: string | null }) => {
  if (logoUrl) {
    return <img className="school-mark" src={logoUrl} alt={`${name} logo`} />;
  }

  return <div className="school-mark school-mark--fallback">{name.slice(0, 2).toUpperCase()}</div>;
};

export const LoginPage = () => {
  const { activeSchool, schools, setActiveSchoolSlug } = useTenantContext();
  const { school } = useSchoolTheme();
  const { login, status, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSubmitting = status === 'loading';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login({ email, password });
    } catch {
      // Error state is held in auth context for display.
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="hero-card hero-card--auth">
          <div className="hero-topline">
            <div className="brand-lockup">
              <SchoolMark name={school.name} logoUrl={school.logoUrl} />
              <div>
                <p className="eyebrow">Phase 2</p>
                <h1>Sign in to {school.name}</h1>
              </div>
            </div>

            <label className="school-switcher">
              <span>School context</span>
              <select
                value={activeSchool.slug}
                onChange={(event) => {
                  clearError();
                  setActiveSchoolSlug(event.target.value);
                }}
                aria-label="Switch school login context"
              >
                {schools.map((availableSchool) => (
                  <option key={availableSchool.id} value={availableSchool.slug}>
                    {availableSchool.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="auth-grid">
            <div className="auth-copy">
              <p className="description">
                Login stays bound to the selected school context. Cookie-based session handling and
                protected routing now work against the mock-backed Phase 2 API.
              </p>

              <div className="preview-panel preview-panel--primary">
                <p className="panel-label">What this slice proves</p>
                <ul className="promise-list promise-list--light">
                  <li>The login page inherits school branding before it renders.</li>
                  <li>Public and protected routes are separated now, not bolted on later.</li>
                  <li>Requests already use credentialed fetch calls for HttpOnly cookie sessions.</li>
                </ul>
              </div>
            </div>

            <form className="login-card" onSubmit={handleSubmit}>
              <div className="login-card__header">
                <p className="panel-label">Staff access</p>
                <p className="login-card__hint">{school.contactEmail}</p>
              </div>

              <label className="field">
                <span>Email address</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={`you@${school.slug}.edu`}
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </label>

              {error ? (
                <div className="form-message form-message--error" role="alert">
                  {error}
                </div>
              ) : (
                <div className="form-message">
                  Demo users are seeded per school. Use the selected school context and the shared
                  password `Password123!` for the sample accounts.
                </div>
              )}

              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
};
