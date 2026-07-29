import { createContext, useContext } from 'react';
import type { SchoolProfile } from '../types/school';

export interface TenantContextValue {
  activeSchool: SchoolProfile;
  schools: SchoolProfile[];
  setActiveSchoolSlug: (schoolSlug: string) => void;
  setAuthenticatedSchool: (school: SchoolProfile, schools?: SchoolProfile[]) => void;
  resetPublicSchool: () => void;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export const useTenantContext = () => {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenantContext must be used within AppProviders.');
  }

  return context;
};
