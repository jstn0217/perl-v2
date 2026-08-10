import { useState } from 'react';
import { InlineAlert } from '../components/InlineAlert';
import { updateProfile } from '../lib/api';
import { useAuth } from '../providers/auth-context';

const roleLabel = (role: string) =>
  role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const EditProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword && !currentPassword) {
      setError('Enter your current password to set a new one.');
      return;
    }

    setStatus('saving');

    try {
      const updated = await updateProfile({
        firstName,
        lastName,
        ...(newPassword ? { currentPassword, newPassword } : {})
      });

      updateUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <section className="admin-shell">
      <div className="section-heading">
        <div>
          <p className="panel-label">Account</p>
          <h2>Edit profile</h2>
          <p className="section-copy">Update your name or password. Changes apply to your account only.</p>
        </div>
      </div>

      <form className="preview-panel admin-form" onSubmit={handleSubmit}>
        <div className="admin-form__header">
          <div>
            <p className="panel-label">Your details</p>
            <h3>{user.firstName} {user.lastName}</h3>
          </div>
          <span className="status-pill status-pill--muted">{roleLabel(user.role)}</span>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              required
            />
          </label>

          <label className="field">
            <span>Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              required
            />
          </label>
        </div>

        <div className="form-section-divider">
          <p className="panel-label">Change password</p>
          <p className="section-copy">Leave both fields blank to keep your current password.</p>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Required to set a new password"
            />
          </label>

          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Leave blank to keep current password"
            />
          </label>
        </div>

        {error ? (
          <InlineAlert tone="error" message={error} />
        ) : success ? (
          <InlineAlert message={success} />
        ) : null}

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
};
