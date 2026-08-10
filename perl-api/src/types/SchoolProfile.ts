export interface SchoolTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

import type { FeatureKey } from './SchoolFeature.js';

export interface SchoolProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  theme: SchoolTheme;
  contactEmail: string;
  /** @deprecated use features.sms instead */
  smsEnabled: boolean;
  smsSenderName: string | null;
  features: Record<FeatureKey, boolean>;
  address: string | null;
  phone: string | null;
  timezone: string;
  academicYearLabel: string | null;
  depedSchoolId: string | null;
}
