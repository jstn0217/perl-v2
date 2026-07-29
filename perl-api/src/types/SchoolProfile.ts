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
}
