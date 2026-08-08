import { Link } from 'react-router-dom';
import { useAuth } from '../providers/auth-context';
import { useSchoolTheme } from '../providers/SchoolThemeContext';
import {
  canManageSchool,
  canViewSchoolWorkspace,
  canViewLiveMonitor,
  isPlatformUser,
  isSupportAgent
} from '../lib/permissions';

export const DashboardHomePage = () => {
  const { user } = useAuth();
  const { school } = useSchoolTheme();
  const firstName = user?.firstName ?? 'there';
  const canMonitor = user ? canViewLiveMonitor(user.role) : false;
  const canEdit = user ? canManageSchool(user.role) : false;
  const canViewWorkspace = user ? canViewSchoolWorkspace(user.role) : false;
  const isPlatform = isPlatformUser(user?.role);
  const readOnlySupport = isSupportAgent(user?.role);

  return (
    <section className="overview-shell">
      <header className="overview-hero">
        <div>
          <p className="panel-label">School operations</p>
          <h2>Good day, {firstName}.</h2>
          <p>
            {isPlatform
              ? `You are working in ${school.name}'s audited support context.`
              : user?.role === 'STUDENT'
                ? `Review your recorded arrivals and departures for ${school.name}.`
                : user?.role === 'GUARDIAN'
                  ? `Review attendance for the students linked to your ${school.name} account.`
                  : `Keep arrivals moving and attendance records clear for ${school.name}.`}
          </p>
          {canViewWorkspace && (school.academicYearLabel || school.address) ? (
            <div className="overview-hero__meta">
              {school.academicYearLabel ? <span>{school.academicYearLabel}</span> : null}
              {school.address ? <span>{school.address}</span> : null}
            </div>
          ) : null}
        </div>
        <Link className="primary-button primary-button--link" to={canMonitor ? '/monitor' : '/logs'}>
          {canMonitor ? 'Open live monitor' : 'View attendance'} <span aria-hidden="true">→</span>
        </Link>
      </header>

      <div className="overview-actions" aria-label="Attendance shortcuts">
        {canMonitor ? (
          <Link className="overview-action overview-action--primary" to="/monitor">
            <span className="overview-action__label">Live</span>
            <span>
              <strong>Monitor the gate</strong>
              <small>Watch scans arrive and confirm each admission in real time.</small>
            </span>
            <span className="overview-action__arrow" aria-hidden="true">→</span>
          </Link>
        ) : null}
        <Link className="overview-action" to="/logs">
          <span className="overview-action__label">History</span>
          <span>
            <strong>Review attendance</strong>
            <small>
              {user?.role === 'STUDENT'
                ? 'See your attendance time, direction, device, and result.'
                : user?.role === 'GUARDIAN'
                  ? 'See attendance for students linked to your account.'
                  : 'Find the student, device, direction, and time behind every scan.'}
            </small>
          </span>
          <span className="overview-action__arrow" aria-hidden="true">→</span>
        </Link>
      </div>

      {canViewWorkspace ? (
        <section className="management-section" aria-labelledby="management-heading">
          <div className="section-heading">
            <div>
              <p className="panel-label">{readOnlySupport ? 'Support workspace' : 'Administration'}</p>
              <h3 id="management-heading">
                {readOnlySupport ? 'Inspect school records' : 'Manage your school'}
              </h3>
              <p className="section-copy">
                {readOnlySupport
                  ? `People, scanners, and profile settings for ${school.name} are available without edit controls.`
                  : `People, scanners, and school identity stay scoped to ${school.name}.`}
              </p>
            </div>
          </div>
          <div className="admin-link-grid">
            <Link className="admin-link-card" to="/admin/users">
              <span>
                <strong>People</strong>
                <small>
                  {canEdit
                    ? 'Add accounts, update student details, or deactivate access.'
                    : 'Review school accounts, roles, cards, and linked students.'}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="admin-link-card" to="/admin/devices">
              <span>
                <strong>Devices</strong>
                <small>
                  {canEdit
                    ? 'Register scanners and manage their access keys.'
                    : 'Review registered scanners, status, and saved key suffixes.'}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="admin-link-card" to="/admin/profile">
              <span>
                <strong>School profile</strong>
                <small>
                  {canEdit
                    ? 'Update the logo, contact details, and brand colors.'
                    : 'Review branding, contact details, and school colors.'}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
            {isPlatform ? (
              <Link className="admin-link-card" to="/audit">
                <span>
                  <strong>System action log</strong>
                  <small>Trace support and school-admin changes across every account.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <aside className="scope-note">
          <span className="scope-note__mark" aria-hidden="true">✓</span>
          <p><strong>School-scoped session</strong><br />You’re viewing attendance for {school.name} only.</p>
        </aside>
      )}
    </section>
  );
};
