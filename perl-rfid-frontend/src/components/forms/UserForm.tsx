import type { ChangeEvent, FormEvent } from 'react';
import type { ManagedUser, SchoolUserRole } from '../../types/admin';
import type { UserFormState } from './userFormState';

const roleOptions: SchoolUserRole[] = ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'];

interface UserFormProps {
  error?: string | null;
  imagePreview: string | null;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onChange: (next: UserFormState) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  students: ManagedUser[];
  value: UserFormState;
}

/**
 * Shared school-user create/edit form. Owns field controls and native validation;
 * the save mutation itself stays with the page that renders this (create vs edit
 * call different API endpoints).
 */
export const UserForm = ({
  error,
  imagePreview,
  mode,
  onCancel,
  onChange,
  onImageChange,
  onSubmit,
  saving,
  students,
  value
}: UserFormProps) => {
  const setField = <Key extends keyof UserFormState>(key: Key, fieldValue: UserFormState[Key]) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <form className="admin-form modal-form" onSubmit={onSubmit}>
      {error ? (
        <div className="form-message form-message--error" role="alert">
          {error}
        </div>
      ) : null}

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
                linkedStudentIds: event.target.value === 'GUARDIAN' ? value.linkedStudentIds : []
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

      {value.role === 'GUARDIAN' ? (
        <fieldset className="student-link-fieldset">
          <legend>Linked students</legend>
          <p>Select the students whose attendance this guardian can view.</p>
          <div className="student-link-list">
            {students.length > 0 ? (
              students.map((student) => (
                <label key={student.id}>
                  <input
                    type="checkbox"
                    checked={value.linkedStudentIds.includes(student.id)}
                    onChange={(event) =>
                      setField(
                        'linkedStudentIds',
                        event.target.checked
                          ? [...value.linkedStudentIds, student.id]
                          : value.linkedStudentIds.filter((id) => id !== student.id)
                      )
                    }
                  />
                  <span>
                    <strong>{student.firstName} {student.lastName}</strong>
                    <small>{student.gradeLevel ?? 'No grade'}{student.section ? ` · ${student.section}` : ''}</small>
                  </span>
                </label>
              ))
            ) : (
              <p>No student accounts are available to link.</p>
            )}
          </div>
        </fieldset>
      ) : null}

      <div className="field-grid field-grid--triple">
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

      <div className="image-upload-row">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Selected user preview"
            className="user-avatar user-avatar--large"
            loading="lazy"
          />
        ) : (
          <span className="user-avatar user-avatar--large user-avatar--fallback" aria-hidden="true">
            {value.firstName.slice(0, 1)}{value.lastName.slice(0, 1)}
          </span>
        )}
        <label className="field upload-field">
          <span>User photo</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImageChange} />
          <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
        </label>
      </div>

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
