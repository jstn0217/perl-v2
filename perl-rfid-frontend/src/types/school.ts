export interface SchoolTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface SchoolProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  theme: SchoolTheme;
  contactEmail: string;
  smsEnabled: boolean;
  smsSenderName: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  academicYearLabel: string | null;
  depedSchoolId: string | null;
}
