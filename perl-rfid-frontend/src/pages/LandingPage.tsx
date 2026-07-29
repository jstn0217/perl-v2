import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';

export const LandingPage = () => {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="public-landing">
      <header className="public-header">
        <Link className="public-wordmark" to="/" aria-label="PERL home">
          <span aria-hidden="true">P</span>
          PERL
        </Link>
        <Link className="secondary-button secondary-button--link" to="/login">Sign in</Link>
      </header>

      <section className="public-hero">
        <div>
          <p className="panel-label">School operations, clearly managed</p>
          <h1>Attendance and school accounts in one secure workspace.</h1>
          <p>
            PERL helps schools monitor arrivals, review attendance, manage people, and keep
            operational changes accountable—without exposing one school’s data to another.
          </p>
          <Link className="primary-button primary-button--link" to="/login">
            Access your school
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <dl className="public-capabilities" aria-label="Platform capabilities">
          <div>
            <dt>Live attendance</dt>
            <dd>See gate scans and admission results as they happen.</dd>
          </div>
          <div>
            <dt>Role-aware access</dt>
            <dd>Give staff, students, and guardians only the records they need.</dd>
          </div>
          <div>
            <dt>Accountability</dt>
            <dd>Trace administrative and support changes through a durable action log.</dd>
          </div>
        </dl>
      </section>
    </main>
  );
};
