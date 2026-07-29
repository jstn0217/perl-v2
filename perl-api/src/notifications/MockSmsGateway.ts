import { randomUUID } from 'node:crypto';
import type { ISmsGateway, SmsDeliveryInput, SmsDeliveryResult } from './ISmsGateway.js';

export class MockSmsGateway implements ISmsGateway {
  readonly enabled = true;
  readonly provider = 'MOCK' as const;

  async send(input: SmsDeliveryInput): Promise<SmsDeliveryResult> {
    return {
      messageId: `mock-sms-${randomUUID()}`,
      status: 'Sent',
      network: 'MOCK',
      recipient: input.recipient
    };
  }
}
