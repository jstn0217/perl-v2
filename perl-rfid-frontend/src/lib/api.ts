import type { SchoolProfile } from '../types/school';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface TenantPayload {
  school: SchoolProfile;
  schools: SchoolProfile[];
}

export const fetchTenantContext = async (schoolSlug?: string): Promise<TenantPayload> => {
  const url = new URL('/api/school/current', apiBaseUrl);

  if (schoolSlug) {
    url.searchParams.set('school', schoolSlug);
  }

  const response = await fetch(url, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to load current school (${response.status})`);
  }

  return (await response.json()) as TenantPayload;
};
