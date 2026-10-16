import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { InlineAlert } from '../InlineAlert';
import { LinkPicker } from './LinkPicker';
import type { ManagedUser, SchoolUserRole } from '../../types/admin';
import type { AssignableRole } from '../../types/role';
import type { UserFormState } from './userFormState';

const roleOptions: SchoolUserRole[] = ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'];

export type UserImageMode = 'upload' | 'url';

interface UserFormProps {
  assignableRoles: AssignableRole[];
  error?: string | null;
  imageMode: UserImageMode;
  imagePreview: string | null;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onChange: (next: UserFormState) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImageModeChange: (mode: UserImageMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  students: ManagedUser[];
  guardians: ManagedUser[];
  value: UserFormState;
}

/**
 * Shared school-user create/edit form. Owns field controls and native validation;
 * the save mutation itself stays with the page that renders this (create vs edit
 * call different API endpoints).
 */
export const UserForm = ({
  assignableRoles,
  error,
  imageMode,
  imagePreview,
  mode,
  onCancel,
  onChange,
  onImageChange,
  onImageModeChange,
  onSubmit,
  saving,
  students,
  guardians,
  value
}: UserFormProps) => {
  const [failedUrlPreview, setFailedUrlPreview] = useState<string | null>(null);
  const setField = <Key extends keyof UserFormState>(key: Key, fieldValue: UserFormState[Key]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  const initials = `${value.firstName.slice(0, 1)}${value.lastName.slice(0, 1)}`;
  const urlPreviewSrc = value.imageUrl.trim();
  const showUrlPreview = imageMode === 'url' && urlPreviewSrc.length > 0 && urlPreviewSrc !== failedUrlPreview;
  const showUploadPreview = imageMode === 'upload' && Boolean(imagePreview);

  return (
    <form className="admin-form modal-form" onSubmit={onSubmit}>
      {error ? <InlineAlert tone="error" message={error} /> : null}

      <div className="image-upload-row">
        {showUploadPreview || showUrlPreview ? (
          <img
            src={showUrlPreview ? urlPreviewSrc : (imagePreview as string)}
            alt="Selected user preview"
            className="user-avatar user-avatar--large"
            loading="lazy"
            onError={showUrlPreview ? () => setFailedUrlPreview(urlPreviewSrc) : undefined}
          />
        ) : (
          <span className="user-avatar user-avatar--large user-avatar--fallback" aria-hidden="true">
            {initials}
          </span>
        )}
        <div className="upload-field">
          <fieldset className="image-mode-toggle">
            <legend>Photo source</legend>
            <div className="segmented-control" role="group" aria-label="Photo source">
              <button
                type="button"
                className={`segmented-control__option${imageMode === 'upload' ? ' segmented-control__option--active' : ''}`}
                aria-pressed={imageMode === 'upload'}
                onClick={() => onImageModeChange('upload')}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`segmented-control__option${imageMode === 'url' ? ' segmented-control__option--active' : ''}`}
                aria-pressed={imageMode === 'url'}
                onClick={() => onImageModeChange('url')}
              >
                Image URL
              </button>
            </div>
          </fieldset>

          {imageMode === 'upload' ? (
            <label className="field">
              <span>User photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} />
              <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
            </label>
          ) : (
            <label className="field">
              <span>Image URL</span>
              <input
                type="url"
                inputMode="url"
                value={value.imageUrl}
                onChange={(event) => setField('imageUrl', event.target.value)}
                placeholder="https://bucket.s3.amazonaws.com/students/photo.jpg"
              />
              <small>Must be an https image URL.</small>
            </label>
          )}
        </div>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>First name</span>
          <input
            type="text"
            value={value.firstName}
            onChange={(event) => setField('firstName', event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Last name</span>
          <input
            type="text"
            value={value.lastName}
            onChange={(event) => setField('lastName', event.target.value)}
            required
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Email address</span>
          <input
            type="email"
            value={value.email}
            onChange={(event) => setField('email', event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Role</span>
          <select
            className="field-select"
            value={value.role}
            onChange={(event) =>
              onChange({
                ...value,
                role: event.target.value as SchoolUserRole,
                linkedStudentIds: event.target.value === 'GUARDIAN' ? value.linkedStudentIds : [],
                linkedGuardianIds: event.target.value === 'STUDENT' ? value.linkedGuardianIds : [],
                roleDefinitionId: null
              })
            }
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>

      {value.role === 'ADMIN' || value.role === 'STAFF' ? (
        <label className="field">
          <span>Custom role</span>
          <select
            className="field-select"
            value={value.roleDefinitionId ?? ''}
            onChange={(event) => setField('roleDefinitionId', event.target.value || null)}
          >
            <option value="">Default permissions</option>
            {assignableRoles
              .filter((role) => role.baseRole === value.role)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
          </select>
          <small>Leave as default to use standard {value.role} permissions.</small>
        </label>
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>Address line 1</span>
          <input
            type="text"
            value={value.addressLine1}
            onChange={(event) => setField('addressLine1', event.target.value)}
            placeholder="House / street"
          />
        </label>
        <label className="field">
          <span>Address line 2</span>
          <input
            type="text"
            value={value.addressLine2}
            onChange={(event) => setField('addressLine2', event.target.value)}
            placeholder="Building, unit (optional)"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Barangay</span>
          <input
            type="text"
            value={value.barangay}
            onChange={(event) => setField('barangay', event.target.value)}
          />
        </label>
        <label className="field">
          <span>City</span>
          <input type="text" value={value.city} onChange={(event) => setField('city', event.target.value)} />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Province</span>
          <input
            type="text"
            value={value.province}
            onChange={(event) => setField('province', event.target.value)}
          />
        </label>
        <label className="field">
          <span>ZIP code</span>
          <input
            type="text"
            value={value.zipCode}
            onChange={(event) => setField('zipCode', event.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>

      <label className="field">
        <span>{mode === 'create' ? 'Temporary password' : 'Reset password'}</span>
        <input
          type="password"
          value={value.password}
          onChange={(event) => setField('password', event.target.value)}
          placeholder={mode === 'create' ? 'At least 8 characters' : 'Leave blank to keep current password'}
          required={mode === 'create'}
        />
      </label>

      {value.role === 'GUARDIAN' ? (
        <label className="field">
          <span>Mobile number for SMS</span>
          <input
            type="tel"
            value={value.phoneNumber}
            onChange={(event) => setField('phoneNumber', event.target.value)}
            placeholder="09171234567"
          />
          <small>Use a Philippine mobile number. Student attendance messages are sent here.</small>
        </label>
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>Card UID</span>
          <input
            type="text"
            value={value.cardUid}
            onChange={(event) => setField('cardUid', event.target.value)}
            placeholder="RFID-XXXX"
          />
        </label>

        <label className="field">
          <span>School ID number</span>
          <input
            type="text"
            value={value.schoolIdNumber}
            onChange={(event) => setField('schoolIdNumber', event.target.value)}
            placeholder="26-108"
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Grade level</span>
          <input
            type="text"
            value={value.gradeLevel}
            onChange={(event) => setField('gradeLevel', event.target.value)}
            placeholder="Grade 8"
          />
        </label>

        <label className="field">
          <span>Section</span>
          <input
            type="text"
            value={value.section}
            onChange={(event) => setField('section', event.target.value)}
            placeholder="Jade"
          />
        </label>
      </div>

      {value.role === 'GUARDIAN' ? (
        <fieldset className="student-link-fieldset">
          <legend>Linked students</legend>
          <p>Select the students whose attendance this guardian can view.</p>
          <LinkPicker
            directory={students}
            noun="students"
            onChange={(ids) => setField('linkedStudentIds', ids)}
            secondaryLine={(student) =>
              `${student.gradeLevel ?? 'No grade'}${student.section ? ` · ${student.section}` : ''}`
            }
            selectedIds={value.linkedStudentIds}
          />
        </fieldset>
      ) : null}

      {value.role === 'STUDENT' ? (
        <fieldset className="student-link-fieldset">
          <legend>Guardians</legend>
          <p>Select the guardians who can view this student's attendance.</p>
          <LinkPicker
            directory={guardians}
            noun="guardians"
            onChange={(ids) => setField('linkedGuardianIds', ids)}
            selectedIds={value.linkedGuardianIds}
          />
        </fieldset>
      ) : null}

      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={saving}>
          {saving
            ? mode === 'create'
              ? 'Creating user…'
              : 'Saving changes…'
            : mode === 'create'
              ? 'Create user'
              : 'Save changes'}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};
