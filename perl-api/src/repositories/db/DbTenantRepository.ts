import type { ITenantRepository } from '../interfaces/ITenantRepository.js';
import type { SchoolProfile } from '../../types/SchoolProfile.js';
import { mapSchoolRow, type SchoolRow } from './mappers.js';
import { getDbPool } from './pool.js';

export class DbTenantRepository implements ITenantRepository {
  async createSchool(school: SchoolProfile): Promise<SchoolProfile> {
    await getDbPool().query(
      `INSERT INTO schools (
        id, slug, name, logo_url, primary_color, secondary_color, accent_color,
        contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
        academic_year_label, deped_school_id, features, sort_order
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE(MAX(sort_order), 0) + 1
      FROM schools`,
      [
        school.id,
        school.slug,
        school.name,
        school.logoUrl,
        school.theme.primaryColor,
        school.theme.secondaryColor,
        school.theme.accentColor,
        school.contactEmail,
        school.smsEnabled,
        school.smsSenderName,
        school.address,
        school.phone,
        school.timezone,
        school.academicYearLabel,
        school.depedSchoolId,
        JSON.stringify(school.features)
      ]
    );

    return school;
  }

  async findSchoolById(schoolId: string): Promise<SchoolProfile | null> {
    const { rows } = await getDbPool().query<SchoolRow>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
              academic_year_label, deped_school_id, features
       FROM schools
       WHERE id = $1
       LIMIT 1`,
      [schoolId]
    );

    return rows[0] ? mapSchoolRow(rows[0]) : null;
  }

  async findSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
    const { rows } = await getDbPool().query<SchoolRow>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
              academic_year_label, deped_school_id, features
       FROM schools
       WHERE slug = $1
       LIMIT 1`,
      [slug]
    );

    return rows[0] ? mapSchoolRow(rows[0]) : null;
  }

  async getDefaultSchool(): Promise<SchoolProfile> {
    const { rows } = await getDbPool().query<SchoolRow>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
              academic_year_label, deped_school_id, features
       FROM schools
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 1`
    );

    if (!rows[0]) {
      throw new Error('No schools are configured.');
    }

    return mapSchoolRow(rows[0]);
  }

  async listSchools(): Promise<SchoolProfile[]> {
    const { rows } = await getDbPool().query<SchoolRow>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name, address, phone, timezone,
              academic_year_label, deped_school_id, features
       FROM schools
       ORDER BY sort_order ASC, created_at ASC`
    );

    return rows.map(mapSchoolRow);
  }

  async updateSchoolProfile(schoolId: string, changes: Partial<SchoolProfile>): Promise<SchoolProfile | null> {
    const school = await this.findSchoolById(schoolId);

    if (!school) {
      return null;
    }

    if (changes.slug && changes.slug !== school.slug) {
      return null;
    }

    const next = {
      name: changes.name ?? school.name,
      logoUrl: changes.logoUrl !== undefined ? changes.logoUrl : school.logoUrl,
      contactEmail: changes.contactEmail ?? school.contactEmail,
      primaryColor: changes.theme?.primaryColor ?? school.theme.primaryColor,
      secondaryColor: changes.theme?.secondaryColor ?? school.theme.secondaryColor,
      accentColor: changes.theme?.accentColor ?? school.theme.accentColor,
      smsEnabled: changes.smsEnabled ?? school.smsEnabled,
      smsSenderName:
        changes.smsSenderName !== undefined ? changes.smsSenderName : school.smsSenderName,
      address: changes.address !== undefined ? changes.address : school.address,
      phone: changes.phone !== undefined ? changes.phone : school.phone,
      timezone: changes.timezone ?? school.timezone,
      academicYearLabel:
        changes.academicYearLabel !== undefined ? changes.academicYearLabel : school.academicYearLabel,
      depedSchoolId:
        changes.depedSchoolId !== undefined ? changes.depedSchoolId : school.depedSchoolId,
      features: changes.features ? { ...school.features, ...changes.features } : school.features
    };

    await getDbPool().query(
      `UPDATE schools
       SET name = $1, logo_url = $2, contact_email = $3, primary_color = $4, secondary_color = $5,
           accent_color = $6, sms_enabled = $7, sms_sender_name = $8, address = $9, phone = $10,
           timezone = $11, academic_year_label = $12, deped_school_id = $13, features = $14
       WHERE id = $15`,
      [
        next.name,
        next.logoUrl,
        next.contactEmail,
        next.primaryColor,
        next.secondaryColor,
        next.accentColor,
        next.smsEnabled,
        next.smsSenderName,
        next.address,
        next.phone,
        next.timezone,
        next.academicYearLabel,
        next.depedSchoolId,
        JSON.stringify(next.features),
        schoolId
      ]
    );

    return this.findSchoolById(schoolId);
  }
}
