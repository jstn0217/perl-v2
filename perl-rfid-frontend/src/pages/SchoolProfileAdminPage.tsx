import { useEffect, useState } from 'react';
import { SchoolMark } from '../components/SchoolMark';
import {
  fetchAdminSchoolProfile,
  updateAdminSchoolProfile,
  uploadAdminSchoolLogo
} from '../lib/api';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import type { SchoolProfile } from '../types/school';
import { canManageSchool } from '../lib/permissions';

type SchoolProfileFormState = {
  name: string;
  contactEmail: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  address: string;
  phone: string;
  timezone: string;
  academicYearLabel: string;
  depedSchoolId: string;
};

const toFormState = (school: SchoolProfile): SchoolProfileFormState => ({
  name: school.name,
  contactEmail: school.contactEmail,
  logoUrl: school.logoUrl ?? '',
  primaryColor: school.theme.primaryColor,
  secondaryColor: school.theme.secondaryColor,
  accentColor: school.theme.accentColor,
  address: school.address ?? '',
  phone: school.phone ?? '',
  timezone: school.timezone ?? '',
  academicYearLabel: school.academicYearLabel ?? '',
  depedSchoolId: school.depedSchoolId ?? ''
});

export const SchoolProfileAdminPage = () => {
  const { user } = useAuth();
  const { activeSchool, schools, setAuthenticatedSchool } = useTenantContext();
  const canEdit = canManageSchool(user?.role);
  const [formState, setFormState] = useState<SchoolProfileFormState>(() => toFormState(activeSchool));
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    void fetchAdminSchoolProfile(activeSchool.id)
      .then((school) => {
        if (cancelled) {
          return;
        }

        setFormState(toFormState(school));
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load the school profile.');
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, user]);

  if (!user) {
    return null;
  }

  const previewSchool = {
    ...activeSchool,
    name: formState.name,
    contactEmail: formState.contactEmail,
    logoUrl: logoPreview ?? (formState.logoUrl.trim() || null),
    theme: {
      primaryColor: formState.primaryColor,
      secondaryColor: formState.secondaryColor,
      accentColor: formState.accentColor
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    setStatus('saving');
    setError(null);
    setSuccess(null);

    try {
      let school = await updateAdminSchoolProfile(activeSchool.id, {
        name: formState.name,
        contactEmail: formState.contactEmail,
        logoUrl: formState.logoUrl.trim() || null,
        theme: {
          primaryColor: formState.primaryColor,
          secondaryColor: formState.secondaryColor,
          accentColor: formState.accentColor
        },
        address: formState.address.trim() || null,
        phone: formState.phone.trim() || null,
        timezone: formState.timezone.trim(),
        academicYearLabel: formState.academicYearLabel.trim() || null,
        depedSchoolId: formState.depedSchoolId.trim() || null
      });

      if (logoFile) {
        school = await uploadAdminSchoolLogo(activeSchool.id, logoFile);
      }

      setFormState(toFormState(school));
      setLogoFile(null);
      setLogoPreview(null);
      setSuccess('School profile updated. Branding changes are now reflected across the dashboard.');
      setStatus('ready');
      setAuthenticatedSchool(
        school,
        schools.map((entry) => (entry.id === school.id ? school : entry))
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the school profile.');
      setStatus('ready');
    }
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setError(null);
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <section className="admin-shell">
      <div className="section-heading">
        <div>
          <p className="panel-label">School settings</p>
          <h2>School profile</h2>
          <p className="section-copy">
            {canEdit
              ? 'Edit the school identity that drives the branded login, dashboard shell, and live attendance surfaces.'
              : 'Inspect the school identity and branding configuration. Support access is read-only.'}
          </p>
        </div>
      </div>

      <div className="admin-grid">
        <article className="preview-panel preview-panel--primary admin-preview-card">
          <p className="panel-label">Live branding preview</p>
          <div className="admin-preview-card__identity">
            <SchoolMark
              name={previewSchool.name}
              logoUrl={previewSchool.logoUrl}
              style={{ backgroundColor: previewSchool.theme.primaryColor }}
            />
            <div>
              <h3>{previewSchool.name}</h3>
              <p>{previewSchool.contactEmail}</p>
            </div>
          </div>

          <div className="identity-swatch">
            <div className="swatch" style={{ background: previewSchool.theme.primaryColor }} />
            <div className="swatch" style={{ background: previewSchool.theme.secondaryColor }} />
            <div className="swatch" style={{ background: previewSchool.theme.accentColor }} />
          </div>

          <ul className="promise-list promise-list--light">
            <li>Primary color carries main actions and active navigation.</li>
            <li>Secondary color softens panels and system surfaces.</li>
            <li>Accent color stays reserved for emphasis and focus.</li>
          </ul>
        </article>

        <form className="preview-panel admin-form" onSubmit={handleSubmit}>
          <div className="admin-form__header">
            <div>
              <p className="panel-label">{canEdit ? 'Editable fields' : 'Profile fields'}</p>
              <h3>{canEdit ? 'Update school metadata' : 'School metadata'}</h3>
            </div>
            <span className="status-pill status-pill--muted">
              {status === 'saving' ? 'Saving…' : canEdit ? 'Admin access' : 'Read-only support'}
            </span>
          </div>

          <fieldset className="admin-form__fieldset" disabled={!canEdit}>
          <div className="field-grid">
            <label className="field">
              <span>School name</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>

            <label className="field">
              <span>Contact email</span>
              <input
                type="email"
                value={formState.contactEmail}
                onChange={(event) => setFormState((current) => ({ ...current, contactEmail: event.target.value }))}
                required
              />
            </label>
          </div>

          <label className="field upload-field">
            <span>School logo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoChange}
            />
            <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
          </label>

          <div className="field-grid field-grid--triple">
            <label className="field field--color">
              <span>Primary color</span>
              <input
                type="color"
                value={formState.primaryColor}
                onChange={(event) => setFormState((current) => ({ ...current, primaryColor: event.target.value }))}
              />
              <strong>{formState.primaryColor}</strong>
            </label>

            <label className="field field--color">
              <span>Secondary color</span>
              <input
                type="color"
                value={formState.secondaryColor}
                onChange={(event) => setFormState((current) => ({ ...current, secondaryColor: event.target.value }))}
              />
              <strong>{formState.secondaryColor}</strong>
            </label>

            <label className="field field--color">
              <span>Accent color</span>
              <input
                type="color"
                value={formState.accentColor}
                onChange={(event) => setFormState((current) => ({ ...current, accentColor: event.target.value }))}
              />
              <strong>{formState.accentColor}</strong>
            </label>
          </div>

          <div className="form-section-divider">
            <p className="panel-label">Institution details</p>
            <p className="section-copy">Official information used on records and reports.</p>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Address</span>
              <input
                type="text"
                value={formState.address}
                onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))}
                placeholder="Street, city, province"
              />
            </label>

            <label className="field">
              <span>Phone</span>
              <input
                type="tel"
                value={formState.phone}
                onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
                placeholder="e.g. (02) 8123 4567"
              />
            </label>

            <label className="field">
              <span>Timezone</span>
              <input
                type="text"
                value={formState.timezone}
                onChange={(event) => setFormState((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="Asia/Manila"
                required
              />
            </label>

            <label className="field">
              <span>Academic year</span>
              <input
                type="text"
                value={formState.academicYearLabel}
                onChange={(event) => setFormState((current) => ({ ...current, academicYearLabel: event.target.value }))}
                placeholder="e.g. SY 2025-2026"
              />
            </label>

            <label className="field">
              <span>DepEd school ID</span>
              <input
                type="text"
                value={formState.depedSchoolId}
                onChange={(event) => setFormState((current) => ({ ...current, depedSchoolId: event.target.value }))}
                placeholder="e.g. 123456"
              />
            </label>
          </div>
          </fieldset>

          {error ? (
            <div className="form-message form-message--error" role="alert">
              {error}
            </div>
          ) : success ? (
            <div className="form-message" role="status">
              {success}
            </div>
          ) : (
            <div className="form-message">
              {canEdit
                ? 'Changes save directly to the current school scope and refresh the active dashboard branding.'
                : 'Support can review these settings but cannot change school branding or contact details.'}
            </div>
          )}

          {canEdit ? <div className="form-actions">
            <button className="primary-button" type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving profile…' : 'Save school profile'}
            </button>
          </div> : null}
        </form>
      </div>
    </section>
  );
};
