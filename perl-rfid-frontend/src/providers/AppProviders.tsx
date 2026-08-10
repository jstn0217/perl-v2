import type { PropsWithChildren } from 'react';
import { useCallback, useState } from 'react';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import type { SchoolProfile } from '../types/school';
import { TenantContext } from './TenantContext';

const genericSchool: SchoolProfile = {
  id: 'perl-platform',
  slug: 'perl',
  name: 'PERL School Management',
  logoUrl: null,
  theme: {
    primaryColor: '#164E63',
    secondaryColor: '#ECF4F6',
    accentColor: '#F59E0B'
  },
  contactEmail: 'support@perl.system',
  smsEnabled: false,
  features: { sms: false },
  smsSenderName: null,
  address: null,
  phone: null,
  timezone: 'Asia/Manila',
  academicYearLabel: null,
  depedSchoolId: null
};

export const AppProviders = ({ children }: PropsWithChildren) => {
  const [activeSchool, setActiveSchool] = useState<SchoolProfile>(genericSchool);
  const [schools, setSchools] = useState<SchoolProfile[]>([]);

  const setActiveSchoolSlug = useCallback((schoolSlug: string) => {
    const school = schools.find((entry) => entry.slug === schoolSlug);
    if (school) setActiveSchool(school);
  }, [schools]);

  const setAuthenticatedSchool = useCallback((
    school: SchoolProfile,
    availableSchools: SchoolProfile[] = [school]
  ) => {
    setActiveSchool(school);
    setSchools(availableSchools);
  }, []);
  const resetPublicSchool = useCallback(() => {
    setActiveSchool(genericSchool);
    setSchools([]);
  }, []);

  return (
    <TenantContext.Provider
      value={{
        activeSchool,
        schools,
        setActiveSchoolSlug,
        setAuthenticatedSchool,
        resetPublicSchool
      }}
    >
      <ThemeProvider school={activeSchool}>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </TenantContext.Provider>
  );
};
