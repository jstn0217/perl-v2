import { AuthService } from '../src/services/AuthService.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('AuthService.login', (dataLayer) => {
  it('authenticates a school-scoped user with valid credentials', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AuthService(
      repositories.userRepository,
      repositories.platformUserRepository
    );

    await expect(service.login('admin@stmarys.edu', 'Password123!')).resolves.toMatchObject({
      user: {
        schoolId: 'school-st-marys',
        role: 'ADMIN'
      }
    });
  });

  it('derives the school from the account instead of client-provided tenant context', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AuthService(
      repositories.userRepository,
      repositories.platformUserRepository
    );

    await expect(service.login('admin@stmarys.edu', 'Password123!')).resolves.toMatchObject({
      user: { schoolId: 'school-st-marys' }
    });
  });

  it('rejects invalid passwords', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new AuthService(
      repositories.userRepository,
      repositories.platformUserRepository
    );

    await expect(service.login('admin@stmarys.edu', 'WrongPassword!')).rejects.toThrow(
      'Invalid credentials.'
    );
  });
});
