import type { SchoolProfile } from '../types/school';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface TenantPayload {
  school: SchoolProfile;
  schools: SchoolProfile[];
}

export interface SessionUser {
  id: string;
  schoolId: string;
  role: 'ADMIN' | 'STAFF' | 'STUDENT' | 'GUARDIAN';
  firstName: string;
  lastName: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  schoolSlug: string;
}

const fetchJson = async <T>(input: URL | string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return (await response.json()) as T;
};

export const fetchTenantContext = async (schoolSlug?: string): Promise<TenantPayload> => {
  const url = new URL('/api/school/current', apiBaseUrl);

  if (schoolSlug) {
    url.searchParams.set('school', schoolSlug);
  }

  try {
    return await fetchJson<TenantPayload>(url);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Request failed')) {
      throw new Error(error.message.replace('Request failed', 'Failed to load current school'), {
        cause: error
      });
    }

    throw error;
  }
};

export const fetchSession = async (): Promise<SessionUser | null> => {
  const url = new URL('/api/auth/session', apiBaseUrl);
  const payload = await fetchJson<{ authenticated: boolean; user: SessionUser | null }>(url);

  return payload.user;
};

export const login = async (payload: LoginPayload): Promise<void> => {
  const url = new URL('/api/auth/login', apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const fallbackMessage = `Unable to sign in (${response.status})`;

    try {
      const errorPayload = (await response.json()) as { message?: string };

      throw new Error(errorPayload.message ?? fallbackMessage);
    } catch {
      throw new Error(fallbackMessage);
    }
  }
};

export const logout = async (): Promise<void> => {
  const url = new URL('/api/auth/logout', apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include'
  });

  if ([404, 405, 501].includes(response.status)) {
    return;
  }

  if (!response.ok) {
    throw new Error(`Unable to sign out (${response.status})`);
  }
};
