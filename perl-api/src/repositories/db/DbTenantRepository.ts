import type { RowDataPacket } from 'mysql2';
import type { ITenantRepository } from '../interfaces/ITenantRepository.js';
import type { SchoolProfile } from '../../types/SchoolProfile.js';
import { mapSchoolRow, type SchoolRow } from './mappers.js';
import { getDbPool } from './pool.js';

export class DbTenantRepository implements ITenantRepository {
  async createSchool(school: SchoolProfile): Promise<SchoolProfile> {
    await getDbPool().query(
      `INSERT INTO schools (
        id, slug, name, logo_url, primary_color, secondary_color, accent_color,
        contact_email, sms_enabled, sms_sender_name, sort_order
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1
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
        school.smsEnabled ? 1 : 0,
        school.smsSenderName
      ]
    );

    return school;
  }

  async findSchoolById(schoolId: string): Promise<SchoolProfile | null> {
    const [rows] = await getDbPool().query<(SchoolRow & RowDataPacket)[]>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name
       FROM schools
       WHERE id = ?
       LIMIT 1`,
      [schoolId]
    );

    return rows[0] ? mapSchoolRow(rows[0]) : null;
  }

  async findSchoolBySlug(slug: string): Promise<SchoolProfile | null> {
    const [rows] = await getDbPool().query<(SchoolRow & RowDataPacket)[]>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name
       FROM schools
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );

    return rows[0] ? mapSchoolRow(rows[0]) : null;
  }

  async getDefaultSchool(): Promise<SchoolProfile> {
    const [rows] = await getDbPool().query<(SchoolRow & RowDataPacket)[]>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name
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
    const [rows] = await getDbPool().query<(SchoolRow & RowDataPacket)[]>(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color, accent_color,
              contact_email, sms_enabled, sms_sender_name
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
        changes.smsSenderName !== undefined ? changes.smsSenderName : school.smsSenderName
    };

    await getDbPool().query(
      `UPDATE schools
       SET name = ?, logo_url = ?, contact_email = ?, primary_color = ?, secondary_color = ?,
           accent_color = ?, sms_enabled = ?, sms_sender_name = ?
       WHERE id = ?`,
      [
        next.name,
        next.logoUrl,
        next.contactEmail,
        next.primaryColor,
        next.secondaryColor,
        next.accentColor,
        next.smsEnabled ? 1 : 0,
        next.smsSenderName,
        schoolId
      ]
    );

    return this.findSchoolById(schoolId);
  }
}
