import type { SchoolProfile } from '../../types/SchoolProfile.js';
import type { ITenantRepository } from '../interfaces/ITenantRepository.js';

const createLogoDataUrl = (slug: string, label: string, primaryColor: string, accentColor: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${label}">
      <rect width="96" height="96" rx="28" fill="${primaryColor}" />
      <circle cx="72" cy="24" r="10" fill="${accentColor}" opacity="0.9" />
      <path d="M20 67c9-18 21-30 37-39" stroke="rgba(255,255,255,0.22)" stroke-width="8" stroke-linecap="round" />
      <text x="18" y="60" fill="white" font-family="Arial, sans-serif" font-size="34" font-weight="700">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}#${slug}`;
};

const mockSchools: SchoolProfile[] = [
  {
    id: 'school-st-marys',
    slug: 'st-marys',
    name: "St. Mary's Academy",
    logoUrl: createLogoDataUrl('st-marys', 'SM', '#0F4C81', '#F4B942'),
    theme: {
      primaryColor: '#0F4C81',
      secondaryColor: '#E9F0F8',
      accentColor: '#F4B942'
    },
    contactEmail: 'frontdesk@stmarys.edu'
  },
  {
    id: 'school-riverside',
    slug: 'riverside-tech',
    name: 'Riverside Technical Institute',
    logoUrl: createLogoDataUrl('riverside-tech', 'RT', '#134E4A', '#6EE7B7'),
    theme: {
      primaryColor: '#134E4A',
      secondaryColor: '#E6FFFA',
      accentColor: '#6EE7B7'
    },
    contactEmail: 'admin@riversidetech.edu'
  },
  {
    id: 'school-golden',
    slug: 'golden-harvest',
    name: 'Golden Harvest Learning Center',
    logoUrl: createLogoDataUrl('golden-harvest', 'GH', '#7C2D12', '#F97316'),
    theme: {
      primaryColor: '#7C2D12',
      secondaryColor: '#FFF3E8',
      accentColor: '#F97316'
    },
    contactEmail: 'office@goldenharvest.edu'
  }
];

export class MockTenantRepository implements ITenantRepository {
  async findSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
    return mockSchools.find((school) => school.slug === slug) ?? null;
  }

  async getDefaultSchool(): Promise<SchoolProfile> {
    return mockSchools[0];
  }

  async listSchools(): Promise<SchoolProfile[]> {
    return mockSchools;
  }
}
