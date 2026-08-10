export interface SchoolTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export type FeatureKey = 'sms';

export const SCHOOL_FEATURE_KEYS: FeatureKey[] = ['sms'];

export const SCHOOL_FEATURE_LABELS: Record<FeatureKey, { name: string; description: string }> = {
  sms: {
    name: 'SMS delivery',
    description: 'Send SMS alerts for student attendance events.'
  }
};

export interface SchoolProfile {
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
  address: string | null;
  phone: string | null;
  timezone: string;
  academicYearLabel: string | null;
  depedSchoolId: string | null;
}
