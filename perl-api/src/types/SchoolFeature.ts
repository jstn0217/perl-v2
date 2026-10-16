export const SCHOOL_FEATURE_KEYS = ['sms', 'enrollment', 'inquiry'] as const;

export type FeatureKey = typeof SCHOOL_FEATURE_KEYS[number];

export const SCHOOL_FEATURE_LABELS: Record<FeatureKey, { name: string; description: string }> = {
  sms: { name: 'SMS delivery', description: 'Send SMS alerts for student attendance events.' },
  enrollment: {
    name: 'Enrollment applications',
    description: 'Accept public enrollment applications on the school intake page.'
  },
  inquiry: {
    name: 'Inquiry form',
    description: 'Accept public inquiries on the school intake page.'
  }
};
