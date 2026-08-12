import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import type { DeviceRecord } from '../../types/Device.js';
import type { SchoolProfile } from '../../types/SchoolProfile.js';
import type { PlatformUserRecord, UserRecord } from '../../types/User.js';

const hashPassword = (password: string) => bcrypt.hashSync(password, 12);
const hashDeviceKey = (deviceKey: string) => createHash('sha256').update(deviceKey).digest('hex');

const createLogoDataUrl = (slug: string, label: string, primaryColor: string, accentColor: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${label}">
      <rect width="96" height="96" rx="28" fill="${primaryColor}" />
      <circle cx="72" cy="24" r="10" fill="${accentColor}" opacity="0.9" />
      <path d="M20 67c9-18 21-30 37-39" stroke="rgba(255,255,255,0.22)" stroke-width="8" stroke-linecap="round" />
      <text x="18" y="60" fill="white" font-family="Arial, sans-serif" font-size="34" font-weight="700">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}#${slug}`;
};

export const createMockSchools = (): SchoolProfile[] => [
  {
    id: 'school-st-marys',
    slug: 'st-marys',
    name: "St. Mary's Academy",
    logoUrl: createLogoDataUrl('st-marys', 'SM', '#0F4C81', '#F4B942'),
    theme: {
      primaryColor: '#0F4C81',
      secondaryColor: '#E9F0F8',
      accentColor: '#F4B942'
    },
    contactEmail: 'frontdesk@stmarys.edu',
    smsEnabled: true,
    smsSenderName: 'STMARYS',
    features: { sms: true },
    address: '145 P. Burgos Street, Barangay Poblacion, Makati City, Metro Manila',
    phone: '(02) 8888-0145',
    timezone: 'Asia/Manila',
    academicYearLabel: 'SY 2025-2026',
    depedSchoolId: 'DEPED-NCR-105234'
  },
  {
    id: 'school-riverside',
    slug: 'riverside-tech',
    name: 'Riverside Technical Institute',
    logoUrl: createLogoDataUrl('riverside-tech', 'RT', '#134E4A', '#6EE7B7'),
    theme: {
      primaryColor: '#134E4A',
      secondaryColor: '#E6FFFA',
      accentColor: '#6EE7B7'
    },
    contactEmail: 'admin@riversidetech.edu',
    smsEnabled: true,
    smsSenderName: 'RIVERSIDE',
    features: { sms: true },
    address: '88 Marcos Highway, Barangay San Roque, Antipolo City, Rizal',
    phone: '(02) 8722-9981',
    timezone: 'Asia/Manila',
    academicYearLabel: 'AY 2025-2026, Term 2',
    depedSchoolId: 'DEPED-CALABARZON-402117'
  },
  {
    id: 'school-golden',
    slug: 'golden-harvest',
    name: 'Golden Harvest Learning Center',
    logoUrl: createLogoDataUrl('golden-harvest', 'GH', '#7C2D12', '#F97316'),
    theme: {
      primaryColor: '#7C2D12',
      secondaryColor: '#FFF3E8',
      accentColor: '#F97316'
    },
    contactEmail: 'office@goldenharvest.edu',
    smsEnabled: false,
    smsSenderName: 'GOLDEN',
    features: { sms: false },
    address: '22 Osmena Boulevard, Barangay Lahug, Cebu City, Cebu',
    phone: '(032) 254-3367',
    timezone: 'Asia/Manila',
    academicYearLabel: 'SY 2025-2026 (Trimester)',
    depedSchoolId: 'DEPED-CENTRALVISAYAS-701845'
  }
];

export const createMockUsers = (): UserRecord[] => [
  {
    id: 'user-stmarys-admin',
    schoolId: 'school-st-marys',
    email: 'admin@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Mara',
    lastName: 'Santos',
    role: 'ADMIN',
    cardUid: 'RFID-STMARYS-ADMIN',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-stmarys-staff',
    schoolId: 'school-st-marys',
    email: 'staff@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Paolo',
    lastName: 'Reyes',
    role: 'STAFF',
    cardUid: 'RFID-STMARYS-STAFF',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-stmarys-student',
    schoolId: 'school-st-marys',
    email: 'student@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Lia',
    lastName: 'Garcia',
    role: 'STUDENT',
    cardUid: 'RFID-STMARYS-001',
    gradeLevel: 'Grade 10',
    schoolIdNumber: null,
    address: null,
    section: 'Emerald',
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-stmarys-guardian',
    schoolId: 'school-st-marys',
    email: 'guardian@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ana',
    lastName: 'Garcia',
    role: 'GUARDIAN',
    cardUid: null,
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    phoneNumber: '09171234567',
    linkedStudentIds: ['user-stmarys-student'],
    isActive: true
  },
  {
    id: 'user-riverside-admin',
    schoolId: 'school-riverside',
    email: 'admin@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Rico',
    lastName: 'Domingo',
    role: 'ADMIN',
    cardUid: 'RFID-RIVERSIDE-ADMIN',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-riverside-staff',
    schoolId: 'school-riverside',
    email: 'staff@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Tina',
    lastName: 'Dela Cruz',
    role: 'STAFF',
    cardUid: 'RFID-RIVERSIDE-STAFF',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-riverside-student',
    schoolId: 'school-riverside',
    email: 'student@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Noel',
    lastName: 'Valdez',
    role: 'STUDENT',
    cardUid: 'RFID-RIVERSIDE-001',
    gradeLevel: 'Grade 11',
    schoolIdNumber: null,
    address: null,
    section: 'Circuit',
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-riverside-guardian',
    schoolId: 'school-riverside',
    email: 'guardian@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ella',
    lastName: 'Valdez',
    role: 'GUARDIAN',
    cardUid: null,
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    phoneNumber: '09172345678',
    linkedStudentIds: ['user-riverside-student'],
    isActive: true
  },
  {
    id: 'user-golden-admin',
    schoolId: 'school-golden',
    email: 'admin@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Mico',
    lastName: 'Tan',
    role: 'ADMIN',
    cardUid: 'RFID-GOLDEN-ADMIN',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-golden-staff',
    schoolId: 'school-golden',
    email: 'staff@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Jessa',
    lastName: 'Tan',
    role: 'STAFF',
    cardUid: 'RFID-GOLDEN-STAFF',
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-golden-student',
    schoolId: 'school-golden',
    email: 'student@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Kian',
    lastName: 'Flores',
    role: 'STUDENT',
    cardUid: 'RFID-GOLDEN-001',
    gradeLevel: 'Grade 9',
    schoolIdNumber: null,
    address: null,
    section: 'Sunrise',
    imageUrl: null,
    isActive: true
  },
  {
    id: 'user-golden-guardian',
    schoolId: 'school-golden',
    email: 'guardian@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ruby',
    lastName: 'Flores',
    role: 'GUARDIAN',
    cardUid: null,
    gradeLevel: null,
    schoolIdNumber: null,
    address: null,
    section: null,
    imageUrl: null,
    phoneNumber: '09173456789',
    linkedStudentIds: ['user-golden-student'],
    isActive: true
  }
];

export const createMockPlatformUsers = (
  systemAdminCredentials = {
    email: 'system@perl.system',
    password: 'SystemAdmin123!'
  },
  supportCredentials = {
    email: 'support@perl.system',
    password: 'Support123!'
  }
): PlatformUserRecord[] => [
  {
    id: 'platform-user-system-admin',
    email: systemAdminCredentials.email.trim().toLowerCase(),
    passwordHash: hashPassword(systemAdminCredentials.password),
    firstName: 'PERL',
    lastName: 'System Admin',
    role: 'SYSTEM_ADMIN',
    isActive: true
  },
  {
    id: 'platform-user-support',
    email: supportCredentials.email.trim().toLowerCase(),
    passwordHash: hashPassword(supportCredentials.password),
    firstName: 'PERL',
    lastName: 'Support',
    role: 'SUPPORT',
    isActive: true
  }
];

export const createMockDevices = (): DeviceRecord[] => {
  const stMarysKey = 'seeded-device-key-stmarys';
  const riversideKey = 'seeded-device-key-riverside';
  const goldenKey = 'seeded-device-key-golden';

  return [
    {
      id: 'device-stmarys-gate',
      schoolId: 'school-st-marys',
      name: "St. Mary's Front Gate",
      location: 'Main gate',
      keyHash: hashDeviceKey(stMarysKey),
      keyLastFour: stMarysKey.slice(-4),
      isActive: true,
      lastSeenAt: null
    },
    {
      id: 'device-riverside-lobby',
      schoolId: 'school-riverside',
      name: 'Riverside Lobby Scanner',
      location: 'Lobby',
      keyHash: hashDeviceKey(riversideKey),
      keyLastFour: riversideKey.slice(-4),
      isActive: true,
      lastSeenAt: null
    },
    {
      id: 'device-golden-gate',
      schoolId: 'school-golden',
      name: 'Golden Harvest Entry Scanner',
      location: 'Front gate',
      keyHash: hashDeviceKey(goldenKey),
      keyLastFour: goldenKey.slice(-4),
      isActive: true,
      lastSeenAt: null
    }
  ];
};
