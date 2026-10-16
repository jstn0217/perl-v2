import bcrypt from 'bcrypt';
import type { ITenantRepository } from './interfaces/ITenantRepository.js';
import type { IUserRepository } from './interfaces/IUserRepository.js';

export interface DemoTenantOptions {
  schoolName: string;
  schoolSlug: string;
  adminEmail: string;
  adminPassword: string;
}

const hashPassword = (password: string) => bcrypt.hashSync(password, 12);

// Shared by both DATA_LAYER=mock and DATA_LAYER=db startup/seed paths — it only talks to
// the repository interfaces, so it works identically against either implementation.
export const seedDemoTenant = async (
  tenantRepository: ITenantRepository,
  userRepository: IUserRepository,
  options: DemoTenantOptions
): Promise<void> => {
  const existing = await tenantRepository.findSchoolBySlug(options.schoolSlug);

  if (existing) {
    console.log(`[seedDemoTenant] School with slug "${options.schoolSlug}" already exists, skipping.`);
    return;
  }

  const school = await tenantRepository.createSchool({
    id: `school-demo-${options.schoolSlug}`,
    slug: options.schoolSlug,
    name: options.schoolName,
    logoUrl: null,
    theme: {
      primaryColor: '#0F4C81',
      secondaryColor: '#E9F0F8',
      accentColor: '#F4B942'
    },
    contactEmail: options.adminEmail,
    smsEnabled: false,
    smsSenderName: null,
    features: { sms: false, enrollment: false, inquiry: false },
    addressLine1: null,
    addressLine2: null,
    barangay: null,
    city: null,
    province: null,
    zipCode: null,
    phone: null,
    timezone: 'Asia/Manila',
    academicYearLabel: null,
    depedSchoolId: null
  });

  await userRepository.create({
    id: `user-demo-${options.schoolSlug}-admin`,
    schoolId: school.id,
    email: options.adminEmail,
    passwordHash: hashPassword(options.adminPassword),
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ADMIN',
    cardUid: null,
    gradeLevel: null,
    schoolIdNumber: null,
    section: null,
    addressLine1: null,
    addressLine2: null,
    barangay: null,
    city: null,
    province: null,
    zipCode: null,
    imageUrl: null,
    isActive: true
  });

  console.log(`[seedDemoTenant] Created demo school "${options.schoolName}" (${options.schoolSlug}).`);
};
