import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';

const features = [
  {
    number: '01',
    title: 'Live gate monitoring',
    body: 'Watch every scan resolve to an admitted or denied result the instant a student or staff member reaches the gate.'
  },
  {
    number: '02',
    title: 'Searchable attendance history',
    body: 'Find any arrival or departure in seconds, filtered by date, direction, or device, without digging through spreadsheets.'
  },
  {
    number: '03',
    title: 'People and device management',
    body: 'Add staff and students, issue RFID cards, and register new scanners yourself, without waiting on IT.'
  },
  {
    number: '04',
    title: 'A branded, accountable workspace',
    body: "Your school's name, logo, and colors appear on every screen, and every administrative change is logged and traceable."
  }
];

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
          <p className="panel-label">Attendance, without the guesswork</p>
          <h1>Know who&rsquo;s on campus, the moment they arrive.</h1>
          <p>
            PERL turns your school&rsquo;s RFID gate into a live, accountable attendance record.
            Administrators see every scan as it happens, guardians get notified, and nobody has to
            call the front office to find out if a student made it in.
          </p>
          <Link className="primary-button primary-button--link" to="/login">
            Sign in to your school
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="public-hero-visual" aria-hidden="true">
          <div className="public-scan-preview">
            <div className="public-scan-preview__header">
              <span className="stream-indicator">
                <span className="stream-indicator__dot" />
                Live at the gate
              </span>
              <time>7:42 AM</time>
            </div>
            <div className="public-scan-preview__student">
              <div className="student-avatar student-avatar--fallback" aria-hidden="true">MC</div>
              <div>
                <strong>Maria Cruz</strong>
                <small>Grade 8 &middot; Section Newton</small>
              </div>
            </div>
            <div className="public-scan-preview__verdicts">
              <span className="live-verdict live-verdict--admitted">Admitted</span>
              <span className="status-pill status-pill--direction-in">Time in</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-features" aria-labelledby="features-heading">
        <div className="section-heading">
          <div>
            <p className="panel-label">How it works</p>
            <h2 id="features-heading">Everything a school office needs to run attendance</h2>
          </div>
        </div>

        <ol className="public-feature-grid">
          {features.map((feature) => (
            <li className="public-feature-card" key={feature.number}>
              <span className="public-feature-card__number" aria-hidden="true">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="public-cta">
        <div>
          <p className="panel-label">Get started</p>
          <h2>Bring your school&rsquo;s attendance into one workspace.</h2>
        </div>
        <Link className="primary-button primary-button--link" to="/login">
          Sign in to your school
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <footer className="public-footer">
        <span className="public-wordmark public-wordmark--footer">
          <span aria-hidden="true">P</span>
          PERL
        </span>
        <p>&copy; {new Date().getFullYear()} PERL School Management. Built for Philippine schools.</p>
      </footer>
    </main>
  );
};
