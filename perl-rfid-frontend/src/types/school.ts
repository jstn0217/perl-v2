import type { AddressFields } from './address';

export interface SchoolTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export type FeatureKey = 'sms' | 'enrollment' | 'inquiry';

export const SCHOOL_FEATURE_KEYS: FeatureKey[] = ['sms', 'enrollment', 'inquiry'];

export const SCHOOL_FEATURE_LABELS: Record<FeatureKey, { name: string; description: string }> = {
  sms: {
    name: 'SMS delivery',
    description: 'Send SMS alerts for student attendance events.'
  },
  enrollment: {
    name: 'Enrollment applications',
    description: 'Accept public enrollment applications on the school intake page.'
  },
  inquiry: {
    name: 'Inquiry form',
    description: 'Accept public inquiries on the school intake page.'
  }
};

export interface SchoolProfile extends AddressFields {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  theme: SchoolTheme;
  contactEmail: string;
  /** @deprecated use features.sms instead */
  smsEnabled: boolean;
  features: Record<FeatureKey, boolean>;
  smsSenderName: string | null;
  phone: string | null;
  timezone: string;
  academicYearLabel: string | null;
  depedSchoolId: string | null;
}
