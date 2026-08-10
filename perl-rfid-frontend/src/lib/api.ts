import type { SchoolProfile } from '../types/school';
import type {
  ManagedDevice,
  ManagedDeviceCreatePayload,
  ManagedUser,
  ManagedUserCreatePayload,
  ManagedUserImportPayload,
  ManagedUserImportResult,
  ManagedUserUpdatePayload,
  RegisteredDeviceResponse,
  SchoolProfileUpdatePayload,
  AuditPage,
  AuditFilters,
  NotificationFilters,
  NotificationPage,
  UserRole
} from '../types/admin';
import type { AttendanceFilters, AttendancePage, AttendanceScanResult } from '../types/attendance';
import { downloadResponse } from './csv';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface AuthPayload {
  user: SessionUser;
  school: SchoolProfile | null;
}

export interface SessionUser {
  id: string;
  schoolId: string | null;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ScanCardPayload {
  cardUid: string;
  schoolSlug: string;
}

export interface AttendanceLogsParams {
  schoolSlug: string;
  page: number;
  pageSize: number;
  filters?: AttendanceFilters;
}

export interface AuditLogParams {
  page: number;
  pageSize: number;
  schoolId?: string;
  filters?: AuditFilters;
}

const parseErrorMessage = async (response: Response, fallbackPrefix: string) => {
  const fallbackMessage = `${fallbackPrefix} (${response.status})`;

  try {
    const payload = (await response.json()) as { message?: string };

    return payload.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

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

const appendFilters = (
  url: URL,
  filters: object | undefined
) => {
  if (!filters) return;
  Object.entries(filters).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
};

const downloadApiCsv = async (response: Response, fallbackFilename: string) => {
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to export records'));
  }
  await downloadResponse(response, fallbackFilename);
};

export const fetchSession = async (): Promise<AuthPayload | null> => {
  const url = new URL('/api/auth/session', apiBaseUrl);
  const payload = await fetchJson<{
    authenticated: boolean;
    user: SessionUser | null;
    school?: SchoolProfile | null;
  }>(url);

  return payload.user
    ? { user: payload.user, school: payload.school ?? null }
    : null;
};

export const login = async (payload: LoginPayload): Promise<AuthPayload> => {
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
    throw new Error(await parseErrorMessage(response, 'Unable to sign in'));
  }

  return (await response.json()) as AuthPayload;
};

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export const updateProfile = async (payload: UpdateProfilePayload): Promise<SessionUser> => {
  const url = new URL('/api/auth/profile', apiBaseUrl);
  const response = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to update your profile'));
  }

  const result = (await response.json()) as { user: SessionUser };

  return result.user;
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

export const fetchAttendanceLogs = async ({
  schoolSlug,
  page,
  pageSize,
  filters
}: AttendanceLogsParams): Promise<AttendancePage> => {
  const url = new URL('/api/attendance/logs', apiBaseUrl);

  url.searchParams.set('school', schoolSlug);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  appendFilters(url, filters);

  return fetchJson<AttendancePage>(url);
};

export const exportAttendanceLogs = async (
  schoolSlug: string,
  filters: AttendanceFilters,
  columns: string[]
) => {
  const url = new URL('/api/attendance/export', apiBaseUrl);
  url.searchParams.set('school', schoolSlug);
  appendFilters(url, filters);
  url.searchParams.set('columns', columns.join(','));
  const response = await fetch(url, { credentials: 'include' });
  await downloadApiCsv(response, 'attendance-records.csv');
};

export const scanCard = async (payload: ScanCardPayload): Promise<AttendanceScanResult> => {
  const url = new URL('/api/device/scan', apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const maybeResult = (await response.json()) as AttendanceScanResult | { message?: string };

  if (!response.ok) {
    if ('verdict' in maybeResult && 'log' in maybeResult) {
      return maybeResult;
    }

    throw new Error(maybeResult.message ?? `Unable to send scan (${response.status})`);
  }

  return maybeResult as AttendanceScanResult;
};

/**
 * Live attendance stream. Reconnect: relies on the browser's native EventSource
 * retry (automatic reconnect with the server's `retry:` hint, ~3s default) rather
 * than app-level backoff logic; `onError` flips the UI to an "offline" indicator
 * until the browser reconnects and `onOpen` fires again (see AttendanceMonitorPage).
 * Ordering/bounded history: the consumer (AttendanceMonitorPage.mergeEvents) dedupes
 * by log id and caps the in-memory event list at 12 entries, and the recent-records
 * preview at 5, so a long-running monitor tab cannot leak memory. There is no
 * server-side sequence number, so out-of-order delivery during a reconnect could
 * theoretically reorder events; this hasn't been a problem at current scan volume
 * and isn't addressed here (see SCALABLE-FRONTEND-TODO.md P1 for the tracked item).
 */
export const createAttendanceStream = (
  schoolSlug: string,
  handlers: {
    onEvent: (payload: AttendanceScanResult) => void;
    onOpen?: () => void;
    onError?: () => void;
  }
) => {
  const url = new URL('/api/attendance/stream', apiBaseUrl);
  url.searchParams.set('school', schoolSlug);

  const stream = new EventSource(url, { withCredentials: true });

  stream.onopen = () => {
    handlers.onOpen?.();
  };

  stream.onerror = () => {
    handlers.onError?.();
  };

  stream.onmessage = (event) => {
    const payload = JSON.parse(event.data) as AttendanceScanResult;
    handlers.onEvent(payload);
  };

  return () => {
    stream.close();
  };
};

export const fetchAdminSchoolProfile = async (schoolId: string): Promise<SchoolProfile> => {
  const url = new URL(`/api/admin/schools/${schoolId}/profile`, apiBaseUrl);
  const payload = await fetchJson<{ school: SchoolProfile }>(url);

  return payload.school;
};

export const updateAdminSchoolProfile = async (
  schoolId: string,
  payload: SchoolProfileUpdatePayload
): Promise<SchoolProfile> => {
  const url = new URL(`/api/admin/schools/${schoolId}/profile`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to update school profile'));
  }

  const result = (await response.json()) as { school: SchoolProfile };

  return result.school;
};

export const uploadAdminSchoolLogo = async (schoolId: string, image: File): Promise<SchoolProfile> => {
  const url = new URL(`/api/admin/schools/${schoolId}/logo`, apiBaseUrl);
  const body = new FormData();
  body.append('image', image);
  const response = await fetch(url, { method: 'POST', credentials: 'include', body });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to upload school logo'));
  }

  const result = (await response.json()) as { school: SchoolProfile };
  return result.school;
};

export interface ManagedUsersQuery {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  role?: UserRole;
  status?: 'active' | 'inactive';
  /** Bypass server-side pagination and return every matching record (picker/export use only). */
  all?: boolean;
}

export interface ManagedUsersPage {
  users: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
}

const setQueryParam = (url: URL, key: string, value: string | undefined) => {
  if (value) url.searchParams.set(key, value);
};

export const fetchAdminUsers = async (
  schoolId: string,
  query: ManagedUsersQuery
): Promise<ManagedUsersPage> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users`, apiBaseUrl);
  url.searchParams.set('page', String(query.page));
  url.searchParams.set('pageSize', String(query.pageSize));
  setQueryParam(url, 'search', query.search);
  setQueryParam(url, 'sort', query.sort);
  setQueryParam(url, 'dir', query.dir);
  setQueryParam(url, 'role', query.role);
  setQueryParam(url, 'status', query.status);
  if (query.all) url.searchParams.set('all', 'true');

  return fetchJson<ManagedUsersPage>(url);
};

export const createAdminUser = async (
  schoolId: string,
  payload: ManagedUserCreatePayload
): Promise<ManagedUser> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to create user'));
  }

  const result = (await response.json()) as { user: ManagedUser };

  return result.user;
};

export const importAdminUsers = async (
  schoolId: string,
  rows: ManagedUserImportPayload[]
): Promise<ManagedUserImportResult> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users/import`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows })
  });
  if (!response.ok && response.status !== 207) {
    throw new Error(await parseErrorMessage(response, 'Unable to import users'));
  }
  return (await response.json()) as ManagedUserImportResult;
};

export interface ManagedDevicesQuery {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  status?: 'active' | 'inactive';
  /** Bypass server-side pagination and return every matching record (export use only). */
  all?: boolean;
}

export interface ManagedDevicesPage {
  devices: ManagedDevice[];
  total: number;
  page: number;
  pageSize: number;
}

export const fetchAdminDevices = async (
  schoolId: string,
  query: ManagedDevicesQuery
): Promise<ManagedDevicesPage> => {
  const url = new URL(`/api/admin/schools/${schoolId}/devices`, apiBaseUrl);
  url.searchParams.set('page', String(query.page));
  url.searchParams.set('pageSize', String(query.pageSize));
  setQueryParam(url, 'search', query.search);
  setQueryParam(url, 'sort', query.sort);
  setQueryParam(url, 'dir', query.dir);
  setQueryParam(url, 'status', query.status);
  if (query.all) url.searchParams.set('all', 'true');

  return fetchJson<ManagedDevicesPage>(url);
};

export const createAdminDevice = async (
  schoolId: string,
  payload: ManagedDeviceCreatePayload
): Promise<RegisteredDeviceResponse> => {
  const url = new URL(`/api/admin/schools/${schoolId}/devices`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to register device'));
  }

  return (await response.json()) as RegisteredDeviceResponse;
};

export const rotateAdminDeviceKey = async (
  schoolId: string,
  deviceId: string
): Promise<RegisteredDeviceResponse> => {
  const url = new URL(`/api/admin/schools/${schoolId}/devices/${deviceId}/rotate-key`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to rotate device key'));
  }

  return (await response.json()) as RegisteredDeviceResponse;
};

export const deactivateAdminDevice = async (
  schoolId: string,
  deviceId: string
): Promise<ManagedDevice> => {
  const url = new URL(`/api/admin/schools/${schoolId}/devices/${deviceId}/deactivate`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to deactivate device'));
  }

  const result = (await response.json()) as { device: ManagedDevice };
  return result.device;
};

export const updateAdminUser = async (
  schoolId: string,
  userId: string,
  payload: ManagedUserUpdatePayload
): Promise<ManagedUser> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users/${userId}`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to update user'));
  }

  const result = (await response.json()) as { user: ManagedUser };

  return result.user;
};

export const uploadAdminUserImage = async (
  schoolId: string,
  userId: string,
  image: File
): Promise<ManagedUser> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users/${userId}/image`, apiBaseUrl);
  const body = new FormData();
  body.append('image', image);
  const response = await fetch(url, { method: 'POST', credentials: 'include', body });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to upload user image'));
  }

  const result = (await response.json()) as { user: ManagedUser };
  return result.user;
};

export const deactivateAdminUser = async (schoolId: string, userId: string): Promise<ManagedUser> => {
  const url = new URL(`/api/admin/schools/${schoolId}/users/${userId}/deactivate`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to deactivate user'));
  }

  const result = (await response.json()) as { user: ManagedUser };

  return result.user;
};

export const fetchSupportAuditLogs = async ({
  page,
  pageSize,
  schoolId,
  filters
}: AuditLogParams): Promise<AuditPage> => {
  const url = new URL('/api/support/audit-logs', apiBaseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  if (schoolId) url.searchParams.set('schoolId', schoolId);
  appendFilters(url, filters);
  return fetchJson<AuditPage>(url);
};

export const exportSupportAuditLogs = async (
  schoolId: string | undefined,
  filters: AuditFilters,
  columns: string[]
) => {
  const url = new URL('/api/support/audit-logs/export', apiBaseUrl);
  if (schoolId) url.searchParams.set('schoolId', schoolId);
  appendFilters(url, filters);
  url.searchParams.set('columns', columns.join(','));
  const response = await fetch(url, { credentials: 'include' });
  await downloadApiCsv(response, 'system-action-log.csv');
};

export const fetchSupportSchools = async (): Promise<SchoolProfile[]> => {
  const url = new URL('/api/support/schools', apiBaseUrl);
  const payload = await fetchJson<{ schools: SchoolProfile[] }>(url);
  return payload.schools;
};

export interface CreateSchoolPayload {
  name: string;
  slug: string;
  contactEmail: string;
  theme: SchoolProfile['theme'];
}

export const createSupportSchool = async (
  input: CreateSchoolPayload
): Promise<SchoolProfile> => {
  const url = new URL('/api/support/schools', apiBaseUrl);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to create school'));
  }
  const payload = (await response.json()) as { school: SchoolProfile };
  return payload.school;
};

export const updateSupportSchoolSmsSettings = async (
  schoolId: string,
  input: { smsEnabled: boolean; smsSenderName: string | null }
): Promise<SchoolProfile> => {
  const url = new URL(`/api/support/schools/${schoolId}/sms-settings`, apiBaseUrl);
  const response = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to update SMS subscription'));
  }
  const payload = (await response.json()) as { school: SchoolProfile };
  return payload.school;
};

export const enterSupportSchool = async (schoolId: string): Promise<SchoolProfile> => {
  const url = new URL(`/api/support/schools/${schoolId}/access`, apiBaseUrl);
  const response = await fetch(url, { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Unable to open school support context'));
  }
  const payload = (await response.json()) as { school: SchoolProfile };
  return payload.school;
};

export const fetchSchoolAuditLogs = async (
  schoolId: string,
  page: number,
  pageSize: number,
  filters?: AuditFilters
): Promise<AuditPage> => {
  const url = new URL(`/api/admin/schools/${schoolId}/audit-logs`, apiBaseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  appendFilters(url, filters);
  return fetchJson<AuditPage>(url);
};

export const exportSchoolAuditLogs = async (
  schoolId: string,
  filters: AuditFilters,
  columns: string[]
) => {
  const url = new URL(`/api/admin/schools/${schoolId}/audit-logs/export`, apiBaseUrl);
  appendFilters(url, filters);
  url.searchParams.set('columns', columns.join(','));
  const response = await fetch(url, { credentials: 'include' });
  await downloadApiCsv(response, 'school-action-log.csv');
};

export const fetchNotificationLogs = async (
  schoolId: string,
  page: number,
  pageSize: number,
  filters: NotificationFilters
): Promise<NotificationPage> => {
  const url = new URL(`/api/admin/schools/${schoolId}/notifications`, apiBaseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  appendFilters(url, filters);
  return fetchJson<NotificationPage>(url);
};

export const exportNotificationLogs = async (
  schoolId: string,
  filters: NotificationFilters,
  columns: string[]
) => {
  const url = new URL(`/api/admin/schools/${schoolId}/notifications/export`, apiBaseUrl);
  appendFilters(url, filters);
  url.searchParams.set('columns', columns.join(','));
  const response = await fetch(url, { credentials: 'include' });
  await downloadApiCsv(response, 'sms-delivery.csv');
};
