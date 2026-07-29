export interface SmsDeliveryInput {
  recipient: string;
  message: string;
  senderName: string;
}

export interface SmsDeliveryResult {
  messageId: string | null;
  status: string;
  network: string | null;
  recipient: string;
}

export interface ISmsGateway {
  readonly enabled: boolean;
  readonly provider: 'SEMAPHORE' | 'MOCK';
  send(input: SmsDeliveryInput): Promise<SmsDeliveryResult>;
}
