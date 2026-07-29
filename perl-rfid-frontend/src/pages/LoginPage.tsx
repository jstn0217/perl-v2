import { useState } from 'react';
import { SchoolMark } from '../components/SchoolMark';
import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';

export const LoginPage = () => {
  const { school } = useSchoolTheme();
  const { login, status, error } = useAuth();
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
                <p className="eyebrow">PERL attendance</p>
                <h1>Sign in to your school</h1>
              </div>
            </div>
          </div>

          <div className="auth-grid">
            <div className="auth-copy">
              <p className="description">
                Your account securely identifies your school and opens the correct workspace.
              </p>

              <div className="preview-panel preview-panel--primary">
                <p className="panel-label">Built for the school day</p>
                <ul className="promise-list promise-list--light">
                  <li>See each scan as it happens at the gate.</li>
                  <li>Review attendance records without leaving your school context.</li>
                  <li>Manage people and devices from one protected workspace.</li>
                </ul>
              </div>
            </div>

            <form className="login-card" onSubmit={handleSubmit}>
              <div className="login-card__header">
                <p className="panel-label">Account sign in</p>
                <h2>Access your workspace</h2>
                <p className="login-card__hint">No school code or public directory required.</p>
              </div>

              <label className="field">
                <span>Email address</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu"
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
                  Your school is resolved from your account after your credentials are verified.
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
