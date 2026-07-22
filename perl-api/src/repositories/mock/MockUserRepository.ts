import bcrypt from 'bcrypt';
import type { UserRecord } from '../../types/User.js';
import type { IUserRepository } from '../interfaces/IUserRepository.js';

const hashPassword = (password: string) => bcrypt.hashSync(password, 10);

const mockUsers: UserRecord[] = [
  {
    id: 'user-stmarys-admin',
    schoolId: 'school-st-marys',
    email: 'admin@demo.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Mara',
    lastName: 'Santos',
    role: 'ADMIN'
  },
  {
    id: 'user-stmarys-staff',
    schoolId: 'school-st-marys',
    email: 'staff@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Paolo',
    lastName: 'Reyes',
    role: 'STAFF'
  },
  {
    id: 'user-stmarys-student',
    schoolId: 'school-st-marys',
    email: 'student@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Lia',
    lastName: 'Garcia',
    role: 'STUDENT'
  },
  {
    id: 'user-stmarys-guardian',
    schoolId: 'school-st-marys',
    email: 'guardian@stmarys.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ana',
    lastName: 'Garcia',
    role: 'GUARDIAN'
  },
  {
    id: 'user-riverside-admin',
    schoolId: 'school-riverside',
    email: 'admin@demo.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Rico',
    lastName: 'Domingo',
    role: 'ADMIN'
  },
  {
    id: 'user-riverside-staff',
    schoolId: 'school-riverside',
    email: 'staff@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Tina',
    lastName: 'Dela Cruz',
    role: 'STAFF'
  },
  {
    id: 'user-riverside-student',
    schoolId: 'school-riverside',
    email: 'student@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Noel',
    lastName: 'Valdez',
    role: 'STUDENT'
  },
  {
    id: 'user-riverside-guardian',
    schoolId: 'school-riverside',
    email: 'guardian@riversidetech.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ella',
    lastName: 'Valdez',
    role: 'GUARDIAN'
  },
  {
    id: 'user-golden-admin',
    schoolId: 'school-golden',
    email: 'admin@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Mico',
    lastName: 'Tan',
    role: 'ADMIN'
  },
  {
    id: 'user-golden-staff',
    schoolId: 'school-golden',
    email: 'staff@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Jessa',
    lastName: 'Tan',
    role: 'STAFF'
  },
  {
    id: 'user-golden-student',
    schoolId: 'school-golden',
    email: 'student@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Kian',
    lastName: 'Flores',
    role: 'STUDENT'
  },
  {
    id: 'user-golden-guardian',
    schoolId: 'school-golden',
    email: 'guardian@goldenharvest.edu',
    passwordHash: hashPassword('Password123!'),
    firstName: 'Ruby',
    lastName: 'Flores',
    role: 'GUARDIAN'
  }
];

export class MockUserRepository implements IUserRepository {
  async findByEmailAndSchool(email: string, schoolId: string): Promise<UserRecord | null> {
    return (
      mockUsers.find(
        (user) => user.email.toLowerCase() === email.toLowerCase() && user.schoolId === schoolId
      ) ?? null
    );
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return mockUsers.find((user) => user.id === userId) ?? null;
  }
}
