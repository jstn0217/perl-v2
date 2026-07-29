import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import {
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUsers,
  importAdminUsers,
  updateAdminUser,
  uploadAdminUserImage
} from '../lib/api';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import { downloadCsvColumns, parseCsv, type CsvColumn } from '../lib/csv';
import { canManageSchool } from '../lib/permissions';
import type {
  ManagedUser,
  ManagedUserCreatePayload,
  ManagedUserImportPayload,
  ManagedUserImportResult,
  ManagedUserUpdatePayload,
  SchoolUserRole
} from '../types/admin';

const roleOptions: SchoolUserRole[] = ['ADMIN', 'STAFF', 'STUDENT', 'GUARDIAN'];
const USER_PAGE_SIZE = 8;
const importHeaders = [
  'email',
  'password',
  'firstName',
  'lastName',
  'role',
  'cardUid',
  'gradeLevel',
  'section',
  'phoneNumber',
  'linkedStudentEmails'
] as const;
const emptyUserFilters = {
  search: '',
  role: '',
  status: ''
};
const defaultUserExportColumns = [
  'firstName',
  'lastName',
  'email',
  'role',
  'status',
  'cardUid',
  'gradeLevel',
  'section',
  'phoneNumber',
  'linkedStudents'
];

type UserFormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: SchoolUserRole;
  cardUid: string;
  gradeLevel: string;
  section: string;
  imageUrl: string;
  phoneNumber: string;
  linkedStudentIds: string[];
};

const createEmptyUserForm = (): UserFormState => ({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'STAFF',
  cardUid: '',
  gradeLevel: '',
  section: '',
  imageUrl: '',
  phoneNumber: '',
  linkedStudentIds: []
});

const toUserFormState = (user: ManagedUser): UserFormState => ({
  email: user.email,
  password: '',
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  cardUid: user.cardUid ?? '',
  gradeLevel: user.gradeLevel ?? '',
  section: user.section ?? '',
  imageUrl: user.imageUrl ?? '',
  phoneNumber: user.phoneNumber ?? '',
  linkedStudentIds: user.linkedStudentIds
});

const sortUsers = (users: ManagedUser[]) =>
  [...users].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    const nameCompare = `${left.lastName} ${left.firstName}`.localeCompare(
      `${right.lastName} ${right.firstName}`
    );

    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.email.localeCompare(right.email);
  });

const UserStatusPill = ({ user }: { user: ManagedUser }) => (
  <div className="result-cell">
    <span className={`status-pill ${user.isActive ? 'status-pill--admitted' : 'status-pill--denied'}`}>
      {user.isActive ? 'Active' : 'Inactive'}
    </span>
    <span className="status-pill status-pill--muted">{user.role}</span>
  </div>
);

export const UserManagementPage = () => {
  const { user: sessionUser } = useAuth();
  const { activeSchool } = useTenantContext();
  const canEdit = canManageSchool(sessionUser?.role);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formState, setFormState] = useState<UserFormState>(createEmptyUserForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyUserFilters);
  const [selectedExportColumns, setSelectedExportColumns] = useState(
    defaultUserExportColumns
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ManagedUserImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!sessionUser) {
      return;
    }

    let cancelled = false;

    void fetchAdminUsers(activeSchool.id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setUsers(sortUsers(payload));
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load school users.');
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, sessionUser]);

  const selectedUser = useMemo(
    () => users.find((managedUser) => managedUser.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((managedUser) => managedUser.isActive).length,
      students: users.filter((managedUser) => managedUser.role === 'STUDENT').length,
      guardians: users.filter((managedUser) => managedUser.role === 'GUARDIAN').length
    }),
    [users]
  );
  const students = useMemo(
    () => users.filter((managedUser) => managedUser.role === 'STUDENT'),
    [users]
  );
  const userNames = useMemo(
    () =>
      new Map(
        users.map((managedUser) => [
          managedUser.id,
          `${managedUser.firstName} ${managedUser.lastName}`
        ])
      ),
    [users]
  );
  const userExportColumns = useMemo<CsvColumn<ManagedUser>[]>(
    () => [
      { key: 'firstName', label: 'First name', value: (managedUser) => managedUser.firstName },
      { key: 'lastName', label: 'Last name', value: (managedUser) => managedUser.lastName },
      { key: 'email', label: 'Email', value: (managedUser) => managedUser.email },
      { key: 'role', label: 'Role', value: (managedUser) => managedUser.role },
      {
        key: 'status',
        label: 'Status',
        value: (managedUser) => (managedUser.isActive ? 'Active' : 'Inactive')
      },
      { key: 'cardUid', label: 'Card UID', value: (managedUser) => managedUser.cardUid ?? '' },
      {
        key: 'gradeLevel',
        label: 'Grade level',
        value: (managedUser) => managedUser.gradeLevel ?? ''
      },
      { key: 'section', label: 'Section', value: (managedUser) => managedUser.section ?? '' },
      { key: 'phoneNumber', label: 'Mobile number', value: (managedUser) => managedUser.phoneNumber ?? '' },
      {
        key: 'linkedStudents',
        label: 'Linked students',
        value: (managedUser) =>
          managedUser.linkedStudentIds
            .map((studentId) => userNames.get(studentId) ?? studentId)
            .join('; ')
      }
    ],
    [userNames]
  );
  const filteredUsers = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase();
    return users.filter((managedUser) => {
      if (filters.role && managedUser.role !== filters.role) return false;
      if (
        filters.status &&
        (filters.status === 'active') !== managedUser.isActive
      ) return false;
      if (!search) return true;
      return [
        managedUser.firstName,
        managedUser.lastName,
        managedUser.email,
        managedUser.cardUid,
        managedUser.gradeLevel,
        managedUser.section,
        managedUser.phoneNumber,
        ...managedUser.linkedStudentIds.map((studentId) => userNames.get(studentId))
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(search));
    });
  }, [filters, userNames, users]);
  const userPagination = usePagination(filteredUsers, USER_PAGE_SIZE);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (!sessionUser) {
    return null;
  }

  const closeEditor = () => {
    setEditorOpen(false);
    setError(null);
  };

  const openNewUser = () => {
    setEditorMode('create');
    setSelectedUserId(null);
    setFormState(createEmptyUserForm());
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  };

  const openEditor = (managedUser: ManagedUser) => {
    setEditorMode('edit');
    setSelectedUserId(managedUser.id);
    setFormState(toUserFormState(managedUser));
    setImageFile(null);
    setImagePreview(managedUser.imageUrl);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  };

  const normalizeOptionalField = (value: string) => {
    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    setNotice(null);

    try {
      if (editorMode === 'create') {
        const payload: ManagedUserCreatePayload = {
          email: formState.email,
          password: formState.password,
          firstName: formState.firstName,
          lastName: formState.lastName,
          role: formState.role,
          cardUid: normalizeOptionalField(formState.cardUid),
          gradeLevel: normalizeOptionalField(formState.gradeLevel),
          section: normalizeOptionalField(formState.section),
          imageUrl: normalizeOptionalField(formState.imageUrl),
          phoneNumber: normalizeOptionalField(formState.phoneNumber),
          linkedStudentIds: formState.linkedStudentIds
        };

        let createdUser = await createAdminUser(activeSchool.id, payload);
        if (imageFile) {
          createdUser = await uploadAdminUserImage(activeSchool.id, createdUser.id, imageFile);
        }
        setUsers((current) => sortUsers([createdUser, ...current]));
        setNotice(`Added ${createdUser.firstName} ${createdUser.lastName} to ${createdUser.role}.`);
        setEditorOpen(false);
        setSelectedUserId(null);
        setFormState(createEmptyUserForm());
        setImageFile(null);
        setImagePreview(null);
      } else if (selectedUser) {
        const payload: ManagedUserUpdatePayload = {
          email: formState.email,
          firstName: formState.firstName,
          lastName: formState.lastName,
          role: formState.role,
          cardUid: normalizeOptionalField(formState.cardUid),
          gradeLevel: normalizeOptionalField(formState.gradeLevel),
          section: normalizeOptionalField(formState.section),
          imageUrl: normalizeOptionalField(formState.imageUrl),
          phoneNumber: normalizeOptionalField(formState.phoneNumber),
          linkedStudentIds: formState.linkedStudentIds
        };

        if (formState.password.trim()) {
          payload.password = formState.password;
        }

        let updatedUser = await updateAdminUser(activeSchool.id, selectedUser.id, payload);
        if (imageFile) {
          updatedUser = await uploadAdminUserImage(activeSchool.id, selectedUser.id, imageFile);
        }
        setUsers((current) =>
          sortUsers(current.map((managedUser) => (managedUser.id === updatedUser.id ? updatedUser : managedUser)))
        );
        setNotice(`Updated ${updatedUser.firstName} ${updatedUser.lastName}.`);
        setEditorOpen(false);
      }

      setStatus('ready');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this user.');
      setStatus('ready');
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleDeactivate = async (managedUser: ManagedUser) => {
    setStatus('saving');
    setError(null);
    setNotice(null);

    try {
      const updatedUser = await deactivateAdminUser(activeSchool.id, managedUser.id);
      setUsers((current) =>
        sortUsers(current.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry)))
      );
      setNotice(`${updatedUser.firstName} ${updatedUser.lastName} has been deactivated.`);

      if (selectedUserId === updatedUser.id) {
        setFormState(toUserFormState(updatedUser));
      }
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate this user.'
      );
    } finally {
      setStatus('ready');
    }
  };

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importFile) {
      setError('Choose a CSV file to import.');
      return;
    }
    if (importFile.size > 2 * 1024 * 1024) {
      setError('CSV import files must be 2 MB or smaller.');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const parsed = parseCsv((await importFile.text()).replace(/^\uFEFF/, ''));
      const header = parsed[0]?.map((value) => value.trim()) ?? [];
      const positions = new Map(header.map((value, index) => [value, index]));
      const missing = importHeaders.filter((name) => !positions.has(name));
      if (missing.length > 0) {
        throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`);
      }
      const read = (row: string[], name: (typeof importHeaders)[number]) =>
        row[positions.get(name) ?? -1]?.trim() ?? '';
      const rows: ManagedUserImportPayload[] = parsed.slice(1).map((row) => ({
        email: read(row, 'email'),
        password: read(row, 'password'),
        firstName: read(row, 'firstName'),
        lastName: read(row, 'lastName'),
        role: read(row, 'role').toUpperCase() as SchoolUserRole,
        cardUid: read(row, 'cardUid') || null,
        gradeLevel: read(row, 'gradeLevel') || null,
        section: read(row, 'section') || null,
        phoneNumber: read(row, 'phoneNumber') || null,
        linkedStudentEmails: read(row, 'linkedStudentEmails')
          .split(';')
          .map((email) => email.trim())
          .filter(Boolean)
      }));
      const result = await importAdminUsers(activeSchool.id, rows);
      setUsers((current) => sortUsers([...result.created, ...current]));
      setImportResult(result);
      setNotice(
        `Imported ${result.created.length} user${result.created.length === 1 ? '' : 's'}${
          result.errors.length ? `; ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} need attention` : ''
        }.`
      );
      if (result.errors.length === 0) {
        setImportOpen(false);
        setImportFile(null);
      }
    } catch (importFailure) {
      setError(importFailure instanceof Error ? importFailure.message : 'Unable to import this CSV.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="admin-shell">
      <div className="section-heading">
        <div>
          <p className="panel-label">School directory</p>
          <h2>School users</h2>
          <p className="section-copy">
            Manage staff, students, and guardians inside the signed-in school scope without crossing tenants.
          </p>
        </div>
      </div>

      <div className="stats-row stats-row--admin">
        <article className="preview-panel stat-panel">
          <p className="panel-label">Total accounts</p>
          <strong>{counts.total}</strong>
          <p>{counts.active} active across the current school.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Students</p>
          <strong>{counts.students}</strong>
          <p>RFID-attendance subjects and classroom rosters.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Guardians</p>
          <strong>{counts.guardians}</strong>
          <p>Notification recipients linked to student records later.</p>
        </article>
      </div>

      <div>
        <article className="preview-panel">
          <div className="admin-form__header">
            <div>
              <p className="panel-label">Roster</p>
              <h3>School-scoped user list</h3>
            </div>
            {canEdit ? <div className="table-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setError(null);
                  setImportResult(null);
                  setImportOpen(true);
                }}
              >
                Import CSV
              </button>
              <button className="secondary-button" type="button" onClick={openNewUser}>
                New user
              </button>
            </div> : (
              <span className="status-pill status-pill--muted">Read-only support view</span>
            )}
          </div>

          {error && !editorOpen ? (
            <div className="form-message form-message--error" role="alert">
              {error}
            </div>
          ) : notice ? (
            <div className="form-message" role="status">
              {notice}
            </div>
          ) : null}

          <ListToolbar
            activeFilterCount={activeFilterCount}
            exportColumns={userExportColumns}
            exportDisabled={status === 'loading'}
            onClear={() => {
              setFilters(emptyUserFilters);
              userPagination.setPage(1);
            }}
            onExport={() =>
              downloadCsvColumns(
                `${activeSchool.slug}-people-${new Date().toISOString().slice(0, 10)}.csv`,
                userExportColumns,
                selectedExportColumns,
                filteredUsers
              )
            }
            onExportColumnsChange={setSelectedExportColumns}
            onSearchChange={(value) => {
              setFilters((current) => ({ ...current, search: value }));
              userPagination.setPage(1);
            }}
            resultCount={filteredUsers.length}
            resultLabel={filteredUsers.length === 1 ? 'person' : 'people'}
            search={filters.search}
            searchLabel="Search name, email, class, card, or linked student"
            selectedExportColumns={selectedExportColumns}
          >
            <label className="compact-field">
              <span>Role</span>
              <select
                value={filters.role}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, role: event.target.value }));
                  userPagination.setPage(1);
                }}
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className="compact-field">
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, status: event.target.value }));
                  userPagination.setPage(1);
                }}
              >
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </ListToolbar>

          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attendance data</th>
                  {canEdit ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {status === 'loading' ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`user-skeleton-${index}`}>
                      <td colSpan={canEdit ? 4 : 3}>
                        <div className="table-skeleton" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3}>
                      <div className="empty-state">
                        <h3>{activeFilterCount > 0 ? 'No matching people' : 'No users found'}</h3>
                        <p>
                          {activeFilterCount > 0
                            ? 'Adjust or clear the filters to broaden the roster.'
                            : 'Create the first school-scoped account from the editor on this page.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  userPagination.pageItems.map((managedUser) => (
                    <tr key={managedUser.id}>
                      {canEdit ? <td>
                        <div className="user-identity">
                          {managedUser.imageUrl ? (
                            <img src={managedUser.imageUrl} alt="" className="user-avatar" />
                          ) : (
                            <span className="user-avatar user-avatar--fallback" aria-hidden="true">
                              {managedUser.firstName.slice(0, 1)}{managedUser.lastName.slice(0, 1)}
                            </span>
                          )}
                          <div>
                            <strong>{managedUser.firstName} {managedUser.lastName}</strong>
                            <p>{managedUser.email}</p>
                          </div>
                        </div>
                      </td> : null}
                      <td>
                        <UserStatusPill user={managedUser} />
                      </td>
                      <td>
                        <div>
                          {managedUser.role === 'GUARDIAN' ? (
                            <>
                              <strong>
                                {managedUser.linkedStudentIds.length} linked student
                                {managedUser.linkedStudentIds.length === 1 ? '' : 's'}
                              </strong>
                              <p>
                                {managedUser.linkedStudentIds
                                  .map((studentId) => userNames.get(studentId) ?? studentId)
                                  .join(', ') || 'No students linked'}
                              </p>
                            </>
                          ) : (
                            <>
                              <strong>{managedUser.cardUid ?? 'No card assigned'}</strong>
                              <p>
                                {managedUser.gradeLevel ?? 'No grade'}
                                {managedUser.section ? ` • ${managedUser.section}` : ''}
                              </p>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => openEditor(managedUser)}
                          >
                            Edit
                          </button>
                          <button
                            className="secondary-button secondary-button--danger"
                            type="button"
                            disabled={!managedUser.isActive || managedUser.id === sessionUser.id || status === 'saving'}
                            onClick={() => void handleDeactivate(managedUser)}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {status !== 'loading' ? (
            <Pagination
              itemLabel="users"
              onPageChange={userPagination.setPage}
              page={userPagination.page}
              pageSize={userPagination.pageSize}
              totalItems={userPagination.totalItems}
            />
          ) : null}
        </article>
      </div>

      <Modal
        description="Upload the People template to add up to 500 school-scoped accounts."
        onClose={() => {
          if (importing) return;
          setImportOpen(false);
          setImportFile(null);
          setImportResult(null);
          setError(null);
        }}
        open={importOpen}
        title="Import school people"
      >
        <form className="admin-form modal-form" onSubmit={handleImport}>
          <div className="import-guidance">
            <div>
              <strong>Start with the template</strong>
              <p>
                Keep the headers unchanged. Use ADMIN, STAFF, STUDENT, or GUARDIAN for role.
                Separate multiple guardian-linked student emails with semicolons.
              </p>
            </div>
            <a
              className="secondary-button secondary-button--link"
              href="/templates/people-import-template.csv"
              download
            >
              Download template
            </a>
          </div>
          <label className="field upload-field">
            <span>Completed CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportResult(null);
                setError(null);
              }}
              required
            />
            <small>Maximum 500 rows and 2 MB per import.</small>
          </label>

          {error && importOpen ? (
            <div className="form-message form-message--error" role="alert">{error}</div>
          ) : null}
          {importResult?.errors.length ? (
            <div className="import-errors" role="status">
              <strong>{importResult.created.length} imported; review these rows:</strong>
              <ul>
                {importResult.errors.slice(0, 12).map((rowError) => (
                  <li key={`${rowError.row}-${rowError.message}`}>
                    Row {rowError.row}: {rowError.message}
                  </li>
                ))}
              </ul>
              {importResult.errors.length > 12 ? (
                <p>{importResult.errors.length - 12} additional errors are not shown.</p>
              ) : null}
            </div>
          ) : null}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={importing}>
              {importing ? 'Importing people…' : 'Import people'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportFile(null);
                setImportResult(null);
                setError(null);
              }}
              disabled={importing}
            >
              Close
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Account details stay scoped to the signed-in school."
        onClose={closeEditor}
        open={editorOpen}
        title={editorMode === 'create' ? 'Add school user' : 'Update school user'}
      >
        <form className="admin-form modal-form" onSubmit={handleSubmit}>
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
                value={formState.firstName}
                onChange={(event) => setFormState((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </label>

            <label className="field">
              <span>Last name</span>
              <input
                type="text"
                value={formState.lastName}
                onChange={(event) => setFormState((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>

            <label className="field">
              <span>Role</span>
              <select
                className="field-select"
                value={formState.role}
                onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      role: event.target.value as SchoolUserRole,
                      linkedStudentIds:
                        event.target.value === 'GUARDIAN' ? current.linkedStudentIds : []
                    }))
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
            <span>{editorMode === 'create' ? 'Temporary password' : 'Reset password'}</span>
            <input
              type="password"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              placeholder={editorMode === 'create' ? 'At least 8 characters' : 'Leave blank to keep current password'}
              required={editorMode === 'create'}
            />
          </label>

          {formState.role === 'GUARDIAN' ? (
            <label className="field">
              <span>Mobile number for SMS</span>
              <input
                type="tel"
                value={formState.phoneNumber}
                onChange={(event) => setFormState((current) => ({ ...current, phoneNumber: event.target.value }))}
                placeholder="09171234567"
              />
              <small>Use a Philippine mobile number. Student attendance messages are sent here.</small>
            </label>
          ) : null}

          {formState.role === 'GUARDIAN' ? (
            <fieldset className="student-link-fieldset">
              <legend>Linked students</legend>
              <p>Select the students whose attendance this guardian can view.</p>
              <div className="student-link-list">
                {students.length > 0 ? (
                  students.map((student) => (
                    <label key={student.id}>
                      <input
                        type="checkbox"
                        checked={formState.linkedStudentIds.includes(student.id)}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            linkedStudentIds: event.target.checked
                              ? [...current.linkedStudentIds, student.id]
                              : current.linkedStudentIds.filter((id) => id !== student.id)
                          }))
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
                value={formState.cardUid}
                onChange={(event) => setFormState((current) => ({ ...current, cardUid: event.target.value }))}
                placeholder="RFID-XXXX"
              />
            </label>

            <label className="field">
              <span>Grade level</span>
              <input
                type="text"
                value={formState.gradeLevel}
                onChange={(event) => setFormState((current) => ({ ...current, gradeLevel: event.target.value }))}
                placeholder="Grade 8"
              />
            </label>

            <label className="field">
              <span>Section</span>
              <input
                type="text"
                value={formState.section}
                onChange={(event) => setFormState((current) => ({ ...current, section: event.target.value }))}
                placeholder="Jade"
              />
            </label>
          </div>

          <div className="image-upload-row">
            {imagePreview ? (
              <img src={imagePreview} alt="Selected user preview" className="user-avatar user-avatar--large" />
            ) : (
              <span className="user-avatar user-avatar--large user-avatar--fallback" aria-hidden="true">
                {formState.firstName.slice(0, 1)}{formState.lastName.slice(0, 1)}
              </span>
            )}
            <label className="field upload-field">
              <span>User photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
              />
              <small>JPEG, PNG, or WebP. Maximum 5 MB.</small>
            </label>
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={status === 'saving'}>
              {status === 'saving'
                ? editorMode === 'create'
                  ? 'Creating user…'
                  : 'Saving changes…'
                : editorMode === 'create'
                  ? 'Create user'
                  : 'Save changes'}
            </button>
            <button className="secondary-button" type="button" onClick={closeEditor}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
