/**
 * Fixed registry of school-scoped permission keys that a custom RoleDefinition
 * can grant to an ADMIN- or STAFF-based user. Every key here corresponds 1:1
 * to a real enforcement point that already exists in the codebase (see the
 * route wiring in adminRoutes.ts and the monitor.live check in
 * attendanceController.ts) — this list is not aspirational.
 *
 * Platform-only capabilities (support workspace, school provisioning, role
 * management itself) are intentionally NOT catalog entries. Those stay
 * hardcoded to SYSTEM_ADMIN/SUPPORT via requireUserRole, unchanged.
 */
export const PERMISSION_CATALOG = [
  {
    key: 'school.records.read',
    label: 'View school records',
    group: 'School Management'
  },
  {
    key: 'school.profile.manage',
    label: 'Manage school profile and branding',
    group: 'School Management'
  },
  {
    key: 'school.users.manage',
    label: 'Manage school users',
    group: 'School Management'
  },
  {
    key: 'school.devices.manage',
    label: 'Manage devices',
    group: 'School Management'
  },
  {
    key: 'school.data.manage',
    label: 'Manage school data (backup, restore, export, erase)',
    group: 'School Management'
  },
  {
    key: 'school.submissions.manage',
    label: 'Manage enrollment and inquiry submissions',
    group: 'School Management'
  },
  {
    key: 'monitor.live',
    label: 'View the live attendance monitor',
    group: 'Attendance Monitoring'
  }
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATALOG.map(
  (entry) => entry.key
);

const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);

export const isPermissionKey = (value: unknown): value is PermissionKey =>
  typeof value === 'string' && PERMISSION_KEY_SET.has(value);
