export const SCHOOL_FEATURE_KEYS = ['sms'] as const;

export type FeatureKey = typeof SCHOOL_FEATURE_KEYS[number];

export const SCHOOL_FEATURE_LABELS: Record<FeatureKey, { name: string; description: string }> = {
  sms: { name: 'SMS delivery', description: 'Send SMS alerts for student attendance events.' }
};
