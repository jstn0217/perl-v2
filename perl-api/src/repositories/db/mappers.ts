import type { AttendanceLogRecord } from '../../types/Attendance.js';
import type { DeviceRecord } from '../../types/Device.js';
import type { SchoolProfile } from '../../types/SchoolProfile.js';
import type { FeatureKey } from '../../types/SchoolFeature.js';
import type { SchoolUserRole, UserRecord } from '../../types/User.js';

interface SchoolRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  contact_email: string;
  sms_enabled: boolean;
  sms_sender_name: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  academic_year_label: string | null;
  deped_school_id: string | null;
  features: Partial<Record<FeatureKey, boolean>>;
}

interface UserRow {
  id: string;
  school_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: SchoolUserRole;
  card_uid: string | null;
  grade_level: string | null;
  school_id_number: string | null;
  section: string | null;
  image_url: string | null;
  phone_number: string | null;
  linked_student_ids: string | null;
  address: string | null;
  is_active: boolean;
}

interface DeviceRow {
  id: string;
  school_id: string;
  name: string;
  location: string;
  key_hash: string;
  key_last_four: string;
  is_active: boolean;
  last_seen_at: Date | null;
}

interface AttendanceLogRow {
  id: string;
  school_id: string;
  user_id: string;
  device_id: string;
  direction: AttendanceLogRecord['direction'];
  verdict: AttendanceLogRecord['verdict'];
  denial_reason: AttendanceLogRecord['denialReason'];
  message: string;
  scanned_at: Date;
}

export const mapSchoolRow = (row: SchoolRow): SchoolProfile => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  logoUrl: row.logo_url,
  theme: {
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color
  },
  contactEmail: row.contact_email,
  smsEnabled: row.sms_enabled,
  smsSenderName: row.sms_sender_name,
  address: row.address,
  phone: row.phone,
  timezone: row.timezone,
  academicYearLabel: row.academic_year_label,
  depedSchoolId: row.deped_school_id,
  features: { sms: false, ...row.features }
});

export const mapUserRow = (row: UserRow): UserRecord => ({
  id: row.id,
  schoolId: row.school_id,
  email: row.email,
  passwordHash: row.password_hash,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  cardUid: row.card_uid,
  gradeLevel: row.grade_level,
  schoolIdNumber: row.school_id_number,
  section: row.section,
  imageUrl: row.image_url,
  phoneNumber: row.phone_number,
  linkedStudentIds: (() => {
    try {
      const parsed = JSON.parse(row.linked_student_ids ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  })(),
  address: row.address,
  isActive: row.is_active
});

export const mapDeviceRow = (row: DeviceRow): DeviceRecord => ({
  id: row.id,
  schoolId: row.school_id,
  name: row.name,
  location: row.location,
  keyHash: row.key_hash,
  keyLastFour: row.key_last_four,
  isActive: row.is_active,
  lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null
});

export const mapAttendanceRow = (row: AttendanceLogRow): AttendanceLogRecord => ({
  id: row.id,
  schoolId: row.school_id,
  userId: row.user_id,
  deviceId: row.device_id,
  direction: row.direction,
  verdict: row.verdict,
  denialReason: row.denial_reason,
  message: row.message,
  scannedAt: row.scanned_at.toISOString()
});

export type { AttendanceLogRow, DeviceRow, SchoolRow, UserRow };
