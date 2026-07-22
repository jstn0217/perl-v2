export const AppShell = () => {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Phase 0</p>
        <h1>PERL rebuild shell is active.</h1>
        <p className="description">
          This frontend is intentionally minimal while the mock-first ports-and-adapters
          architecture is being established.
        </p>
        <dl className="status-grid">
          <div>
            <dt>Frontend</dt>
            <dd>React + Vite + TypeScript</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>Express + TypeScript</dd>
          </div>
          <div>
            <dt>Data Layer</dt>
            <dd>Mock by default</dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>0 - Project Scaffolding</dd>
          </div>
        </dl>
      </section>
    </main>
  );
};
