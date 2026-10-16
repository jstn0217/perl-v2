export interface SchoolTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

import type { FeatureKey } from './SchoolFeature.js';
import type { AddressFields } from './Address.js';

export interface SchoolProfile extends AddressFields {
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
  phone: string | null;
  timezone: string;
  academicYearLabel: string | null;
  depedSchoolId: string | null;
}
