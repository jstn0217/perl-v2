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
  address: string;
  linkedStudentIds: string[];
  linkedGuardianIds: string[];
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
  address: '',
  linkedStudentIds: [],
  linkedGuardianIds: []
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
  address: user.address ?? '',
  linkedStudentIds: user.linkedStudentIds,
  linkedGuardianIds: []
});
