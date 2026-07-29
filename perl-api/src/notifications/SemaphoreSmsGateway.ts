import type { ISmsGateway, SmsDeliveryInput, SmsDeliveryResult } from './ISmsGateway.js';

interface SemaphoreResponse {
  message_id?: string | number;
  status?: string;
  network?: string;
  recipient?: string;
}

export class SemaphoreSmsGateway implements ISmsGateway {
  readonly enabled = true;
  readonly provider = 'SEMAPHORE' as const;

  constructor(
    private readonly apiKey: string,
    private readonly endpoint: string
  ) {}

  async send(input: SmsDeliveryInput): Promise<SmsDeliveryResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: this.apiKey,
        number: input.recipient,
        message: input.message,
        sendername: input.senderName
      }),
      signal: AbortSignal.timeout(8_000)
    });

    const rawPayload = (await response.json().catch(() => null)) as
      | SemaphoreResponse[]
      | { message?: string }
      | null;
    if (!response.ok) {
      const providerMessage =
        rawPayload && !Array.isArray(rawPayload) && typeof rawPayload.message === 'string'
          ? rawPayload.message
          : `Semaphore request failed (${response.status}).`;
      throw new Error(providerMessage);
    }

    const payload = Array.isArray(rawPayload) ? rawPayload[0] : null;
    if (!payload) throw new Error('Semaphore returned an empty delivery response.');

    return {
      messageId:
        payload.message_id === undefined || payload.message_id === null
          ? null
          : String(payload.message_id),
      status: payload.status ?? 'Unknown',
      network: payload.network ?? null,
      recipient: payload.recipient ?? input.recipient
    };
  }
}
