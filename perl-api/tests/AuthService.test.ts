import { MockUserRepository } from '../src/repositories/mock/MockUserRepository.js';
import { AuthService } from '../src/services/AuthService.js';

describe('AuthService.login', () => {
  it('authenticates a school-scoped user with valid credentials', async () => {
    const service = new AuthService(new MockUserRepository());

    await expect(service.login('admin@demo.edu', 'Password123!', 'school-st-marys')).resolves.toMatchObject({
      user: {
        schoolId: 'school-st-marys',
        role: 'ADMIN'
      }
    });
  });

  it('rejects the same email when the login is scoped to the wrong school', async () => {
    const service = new AuthService(new MockUserRepository());

    await expect(service.login('admin@demo.edu', 'Password123!', 'school-golden')).rejects.toThrow(
      'Invalid credentials.'
    );
  });

  it('rejects invalid passwords', async () => {
    const service = new AuthService(new MockUserRepository());

    await expect(service.login('admin@demo.edu', 'WrongPassword!', 'school-st-marys')).rejects.toThrow(
      'Invalid credentials.'
    );
  });
});
