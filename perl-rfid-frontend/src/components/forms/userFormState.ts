import type { ManagedUser, SchoolUserRole } from '../../types/admin';

export type UserFormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string;
  gradeLevel: string;
  schoolIdNumber: string;
  section: string;
  imageUrl: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  linkedStudentIds: string[];
  linkedGuardianIds: string[];
  roleDefinitionId: string | null;
};

export const createEmptyUserForm = (): UserFormState => ({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'STAFF',
  cardUid: '',
  gradeLevel: '',
  schoolIdNumber: '',
  section: '',
  imageUrl: '',
  phoneNumber: '',
  addressLine1: '',
  addressLine2: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  linkedStudentIds: [],
  linkedGuardianIds: [],
  roleDefinitionId: null
});

export const toUserFormState = (user: ManagedUser): UserFormState => ({
  email: user.email,
  password: '',
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  cardUid: user.cardUid ?? '',
  gradeLevel: user.gradeLevel ?? '',
  schoolIdNumber: user.schoolIdNumber ?? '',
  section: user.section ?? '',
  imageUrl: user.imageUrl ?? '',
  phoneNumber: user.phoneNumber ?? '',
  addressLine1: user.addressLine1 ?? '',
  addressLine2: user.addressLine2 ?? '',
  barangay: user.barangay ?? '',
  city: user.city ?? '',
  province: user.province ?? '',
  zipCode: user.zipCode ?? '',
  linkedStudentIds: user.linkedStudentIds,
  linkedGuardianIds: [],
  roleDefinitionId: user.roleDefinitionId ?? null
});
