import { useTenantContext } from '../providers/TenantContext';
import { useSchoolTheme } from '../providers/SchoolThemeContext';

const SchoolMark = ({ name, logoUrl }: { name: string; logoUrl: string | null }) => {
  if (logoUrl) {
    return <img className="school-mark" src={logoUrl} alt={`${name} logo`} />;
  }

  return <div className="school-mark school-mark--fallback">{name.slice(0, 2).toUpperCase()}</div>;
};

export const AppShell = () => {
  const { schools, setActiveSchoolSlug } = useTenantContext();
  const { school } = useSchoolTheme();

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <div className="brand-lockup">
            <SchoolMark name={school.name} logoUrl={school.logoUrl} />
            <div>
              <p className="eyebrow">Phase 1</p>
              <h1>{school.name}</h1>
            </div>
          </div>
          <label className="school-switcher">
            <span>Demo school</span>
            <select
              value={school.slug}
              onChange={(event) => setActiveSchoolSlug(event.target.value)}
              aria-label="Switch school branding preview"
            >
              {schools.map((availableSchool) => (
                <option key={availableSchool.id} value={availableSchool.slug}>
                  {availableSchool.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="description">
          The app shell resolves tenant context before rendering and applies each school&apos;s
          identity through theme variables, logo treatment, and copy.
        </p>

        <div className="preview-grid">
          <article className="preview-panel preview-panel--primary">
            <p className="panel-label">Current identity</p>
            <div className="identity-swatch">
              <span className="swatch swatch--primary" />
              <span className="swatch swatch--secondary" />
              <span className="swatch swatch--accent" />
            </div>
            <p className="identity-copy">{school.contactEmail}</p>
          </article>

          <article className="preview-panel">
            <p className="panel-label">Branding contract</p>
            <ul className="promise-list">
              <li>School context loads before the app shell appears.</li>
              <li>The selected demo school is stored in the URL query string.</li>
              <li>Switching schools re-skins the interface without hardcoded branding.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
};
