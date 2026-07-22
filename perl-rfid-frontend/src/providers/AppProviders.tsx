import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { fetchTenantContext } from '../lib/api';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import type { SchoolProfile } from '../types/school';
import { TenantContext } from './TenantContext';

const readSchoolFromLocation = () => {
  const params = new URLSearchParams(window.location.search);

  return params.get('school') ?? undefined;
};

const writeSchoolToLocation = (schoolSlug: string) => {
  const url = new URL(window.location.href);

  url.searchParams.set('school', schoolSlug);
  window.history.replaceState({}, '', url);
};

export const AppProviders = ({ children }: PropsWithChildren) => {
  const [activeSchool, setActiveSchool] = useState<SchoolProfile | null>(null);
  const [schools, setSchools] = useState<SchoolProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTenantContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const requestedSchool = readSchoolFromLocation();
        const tenantContext = await fetchTenantContext(requestedSchool);

        if (cancelled) {
          return;
        }

        writeSchoolToLocation(tenantContext.school.slug);
        setActiveSchool(tenantContext.school);
        setSchools(tenantContext.schools);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load school branding.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTenantContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const setActiveSchoolSlug = (schoolSlug: string) => {
    writeSchoolToLocation(schoolSlug);
    setLoading(true);
    setError(null);

    void fetchTenantContext(schoolSlug)
      .then((tenantContext) => {
        setActiveSchool(tenantContext.school);
        setSchools(tenantContext.schools);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to switch schools.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (loading && !activeSchool) {
    return <div className="boot-screen">Loading school context...</div>;
  }

  if (error || !activeSchool) {
    return <div className="boot-screen boot-screen--error">{error ?? 'School context unavailable.'}</div>;
  }

  return (
    <TenantContext.Provider
      value={{
        activeSchool,
        schools,
        setActiveSchoolSlug
      }}
    >
      <ThemeProvider school={activeSchool}>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </TenantContext.Provider>
  );
};
