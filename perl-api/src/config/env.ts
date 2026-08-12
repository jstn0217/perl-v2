export type DataLayer = 'mock' | 'db';
export type ImageStorage = 'mock' | 's3';

const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const defaultJwtSecret = 'dev-phase-2-secret';
const defaultDbPassword = 'perl_dev_password';
const defaultSystemAdminEmail = 'system@perl.system';
const defaultSystemAdminPassword = 'SystemAdmin123!';
const defaultSupportEmail = 'support@perl.system';
const defaultSupportPassword = 'Support123!';

const resolveDataLayer = (value: string | undefined): DataLayer => {
  return value === 'db' ? 'db' : 'mock';
};

const resolveImageStorage = (value: string | undefined): ImageStorage => {
  return value === 's3' ? 's3' : 'mock';
};

const resolvePort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '4000', 10);

  return Number.isNaN(parsed) ? 4000 : parsed;
};

const resolveAllowedOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return defaultAllowedOrigins;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const resolveBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
};

const resolvePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const env = {
  nodeEnvironment: process.env.NODE_ENV ?? 'development',
  port: resolvePort(process.env.PORT),
  dataLayer: resolveDataLayer(process.env.DATA_LAYER),
  imageStorage: resolveImageStorage(process.env.IMAGE_STORAGE),
  allowedOrigins: resolveAllowedOrigins(process.env.ALLOWED_ORIGINS),
  jwtSecret: process.env.JWT_SECRET ?? defaultJwtSecret,
  jwtCookieName: process.env.JWT_COOKIE_NAME ?? 'perl_session',
  jwtExpiresInSeconds: resolvePositiveInteger(process.env.JWT_EXPIRES_IN_SECONDS, 60 * 60 * 8),
  cookieSecure: resolveBoolean(process.env.COOKIE_SECURE, false),
  initialSystemAdmin: {
    email:
      process.env.INITIAL_SYSTEM_ADMIN_EMAIL ??
      process.env.INITIAL_SUPERADMIN_EMAIL ??
      defaultSystemAdminEmail,
    password:
      process.env.INITIAL_SYSTEM_ADMIN_PASSWORD ??
      process.env.INITIAL_SUPERADMIN_PASSWORD ??
      defaultSystemAdminPassword
  },
  initialSupport: {
    email: process.env.INITIAL_SUPPORT_EMAIL ?? defaultSupportEmail,
    password: process.env.INITIAL_SUPPORT_PASSWORD ?? defaultSupportPassword
  },
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: resolvePositiveInteger(process.env.DB_PORT, 5432),
    user: process.env.DB_USER ?? 'perl',
    password: process.env.DB_PASSWORD ?? defaultDbPassword,
    name: process.env.DB_NAME ?? 'perl',
    ssl: resolveBoolean(process.env.DB_SSL, false)
  },
  aws: {
    region: process.env.AWS_REGION ?? 'ap-southeast-1',
    s3Bucket: process.env.S3_BUCKET ?? '',
    s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined
  },
  rateLimits: {
    loginWindowMs: resolvePositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 60_000),
    loginMaxAttempts: resolvePositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5),
    deviceScanWindowMs: resolvePositiveInteger(process.env.DEVICE_SCAN_RATE_LIMIT_WINDOW_MS, 60_000),
    deviceScanMaxAttempts: resolvePositiveInteger(process.env.DEVICE_SCAN_RATE_LIMIT_MAX_ATTEMPTS, 10)
  },
  sms: {
    enabled: resolveBoolean(process.env.SMS_ENABLED, true),
    provider: process.env.SMS_PROVIDER === 'semaphore' ? 'semaphore' as const : 'mock' as const,
    apiKey: process.env.SEMAPHORE_API_KEY ?? process.env.SMS_API_KEY ?? '',
    senderName: process.env.SEMAPHORE_SENDER_NAME ?? 'SEMAPHORE',
    endpoint: process.env.SEMAPHORE_API_URL ?? 'https://api.semaphore.co/api/v4/messages'
  }
};

interface ProductionEnvironment {
  nodeEnvironment: string;
  dataLayer: DataLayer;
  allowedOrigins: string[];
  jwtSecret: string;
  cookieSecure: boolean;
  initialSystemAdmin: {
    email: string;
    password: string;
  };
  initialSupport: {
    email: string;
    password: string;
  };
  db: {
    password: string;
    ssl: boolean;
  };
  sms: {
    enabled: boolean;
    provider: 'mock' | 'semaphore';
    apiKey: string;
  };
}

export const validateRuntimeEnvironment = (config: ProductionEnvironment = env) => {
  if (config.nodeEnvironment === 'development' || config.nodeEnvironment === 'test') return;

  const errors: string[] = [];
  if (config.dataLayer !== 'db') errors.push('DATA_LAYER must be db.');
  if (config.jwtSecret === defaultJwtSecret || config.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be a non-default value of at least 32 characters.');
  }
  if (!config.cookieSecure) errors.push('COOKIE_SECURE must be true.');
  if (
    config.initialSystemAdmin.email === defaultSystemAdminEmail ||
    config.initialSystemAdmin.password === defaultSystemAdminPassword ||
    config.initialSystemAdmin.password.length < 16
  ) {
    errors.push(
      'INITIAL_SYSTEM_ADMIN_EMAIL and INITIAL_SYSTEM_ADMIN_PASSWORD must be non-default production credentials, with a password of at least 16 characters.'
    );
  }
  if (
    config.initialSupport.email === defaultSupportEmail ||
    config.initialSupport.password === defaultSupportPassword ||
    config.initialSupport.password.length < 16
  ) {
    errors.push(
      'INITIAL_SUPPORT_EMAIL and INITIAL_SUPPORT_PASSWORD must be non-default production credentials, with a password of at least 16 characters.'
    );
  }
  if (
    config.initialSystemAdmin.email.trim().toLowerCase() ===
    config.initialSupport.email.trim().toLowerCase()
  ) errors.push('System admin and support bootstrap emails must be different.');
  if (
    config.allowedOrigins.length === 0 ||
    config.allowedOrigins.some((origin) => {
      try {
        return new URL(origin).protocol !== 'https:';
      } catch {
        return true;
      }
    })
  ) {
    errors.push('ALLOWED_ORIGINS must contain only valid HTTPS origins.');
  }
  if (config.db.password === defaultDbPassword || config.db.password.length < 16) {
    errors.push('DB_PASSWORD must be a non-default value of at least 16 characters.');
  }
  if (!config.db.ssl) errors.push('DB_SSL must be true.');
  if (
    config.sms.enabled &&
    (config.sms.provider !== 'semaphore' || config.sms.apiKey.trim().length < 16)
  ) {
    errors.push(
      'Enabled production SMS requires SMS_PROVIDER=semaphore and a configured SEMAPHORE_API_KEY.'
    );
  }

  if (errors.length > 0) {
    throw new Error(`Unsafe production configuration:\n- ${errors.join('\n- ')}`);
  }
};
