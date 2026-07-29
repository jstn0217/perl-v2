import { env } from '../config/env.js';
import type { ISmsGateway } from './ISmsGateway.js';
import { MockSmsGateway } from './MockSmsGateway.js';
import { SemaphoreSmsGateway } from './SemaphoreSmsGateway.js';

class DisabledSmsGateway implements ISmsGateway {
  readonly enabled = false;
  readonly provider = 'SEMAPHORE' as const;

  async send(): Promise<never> {
    throw new Error('SMS delivery is disabled.');
  }
}

export const createSmsGateway = (): ISmsGateway => {
  if (!env.sms.enabled) return new DisabledSmsGateway();
  if (env.sms.provider === 'semaphore') {
    return new SemaphoreSmsGateway(env.sms.apiKey, env.sms.endpoint);
  }
  return new MockSmsGateway();
};

export type { ISmsGateway } from './ISmsGateway.js';
