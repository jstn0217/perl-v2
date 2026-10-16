import { validateRuntimeEnvironment } from '../src/config/env.js';

const validProductionEnvironment = {
  nodeEnvironment: 'production',
  dataLayer: 'db' as const,
  allowedOrigins: ['https://attendance.example.edu'],
  jwtSecret: 'a-production-jwt-secret-with-32-characters',
  cookieSecure: true,
  initialSystemAdmin: {
    email: 'owner@attendance.example.edu',
    password: 'a-secure-bootstrap-password'
  },
  initialSupport: {
    email: 'help@attendance.example.edu',
    password: 'a-secure-support-password'
  },
  db: {
    password: 'a-production-db-password',
    ssl: true
  },
  sms: {
    enabled: true,
    provider: 'semaphore' as const,
    apiKey: 'a-production-semaphore-key'
  },
  demoTenant: {
    seedEnabled: false,
    adminEmail: '',
    adminPassword: ''
  }
};

describe('production environment validation', () => {
  it('accepts secure production settings', () => {
    expect(() => validateRuntimeEnvironment(validProductionEnvironment)).not.toThrow();
  });

  it('reports every unsafe production setting before startup', () => {
    expect(() =>
      validateRuntimeEnvironment({
        nodeEnvironment: 'production',
        dataLayer: 'mock',
        allowedOrigins: ['http://localhost:5173', 'not-a-url'],
        jwtSecret: 'short',
        cookieSecure: false,
        initialSystemAdmin: {
          email: 'system@perl.system',
          password: 'SystemAdmin123!'
        },
        initialSupport: {
          email: 'support@perl.system',
          password: 'Support123!'
        },
        db: {
          password: 'short',
          ssl: false
        },
        sms: {
          enabled: true,
          provider: 'mock',
          apiKey: ''
        },
        demoTenant: {
          seedEnabled: false,
          adminEmail: '',
          adminPassword: ''
        }
      })
    ).toThrow(
      [
        'DATA_LAYER must be db.',
        'JWT_SECRET must be a non-default value of at least 32 characters.',
        'COOKIE_SECURE must be true.',
        'INITIAL_SYSTEM_ADMIN_EMAIL and INITIAL_SYSTEM_ADMIN_PASSWORD must be non-default production credentials, with a password of at least 16 characters.',
        'INITIAL_SUPPORT_EMAIL and INITIAL_SUPPORT_PASSWORD must be non-default production credentials, with a password of at least 16 characters.',
        'ALLOWED_ORIGINS must contain only valid HTTPS origins.',
        'DB_PASSWORD must be a non-default value of at least 16 characters.',
        'DB_SSL must be true.',
        'Enabled production SMS requires SMS_PROVIDER=semaphore and a configured SEMAPHORE_API_KEY.'
      ].join('\n- ')
    );
  });

  it('does not apply production constraints to local development', () => {
    expect(() =>
      validateRuntimeEnvironment({
        ...validProductionEnvironment,
        nodeEnvironment: 'development',
        dataLayer: 'mock',
        cookieSecure: false,
        db: { password: 'dev', ssl: false }
      })
    ).not.toThrow();
  });
});

describe('NODE_ENV must be explicitly set', () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  });

  it('throws when NODE_ENV is unset, instead of silently defaulting to development', () => {
    delete process.env.NODE_ENV;

    expect(() => validateRuntimeEnvironment()).toThrow(/NODE_ENV must be explicitly set/);
  });

  it('throws when NODE_ENV is set to an unrecognized value', () => {
    process.env.NODE_ENV = 'staging';

    expect(() => validateRuntimeEnvironment()).toThrow(/NODE_ENV must be explicitly set/);
  });

  it('does not throw this check for NODE_ENV=production with otherwise-valid config', () => {
    process.env.NODE_ENV = 'production';

    expect(() => validateRuntimeEnvironment(validProductionEnvironment)).not.toThrow();
  });

  it('still short-circuits the rest of production validation for NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      validateRuntimeEnvironment({
        ...validProductionEnvironment,
        nodeEnvironment: 'development',
        dataLayer: 'mock',
        cookieSecure: false,
        db: { password: 'dev', ssl: false }
      })
    ).not.toThrow();
  });
});
