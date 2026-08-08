import type { ManagedUser, SchoolUserRole } from '../../types/admin';

export type UserFormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string;
  gradeLevel: string;
  section: string;
  imageUrl: string;
  phoneNumber: string;
  linkedStudentIds: string[];
};

export const createEmptyUserForm = (): UserFormState => ({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'STAFF',
  cardUid: '',
  gradeLevel: '',
  section: '',
  imageUrl: '',
  phoneNumber: '',
  linkedStudentIds: []
});

export const toUserFormState = (user: ManagedUser): UserFormState => ({
  email: user.email,
  password: '',
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  cardUid: user.cardUid ?? '',
  gradeLevel: user.gradeLevel ?? '',
  section: user.section ?? '',
  imageUrl: user.imageUrl ?? '',
  phoneNumber: user.phoneNumber ?? '',
  linkedStudentIds: user.linkedStudentIds
});
