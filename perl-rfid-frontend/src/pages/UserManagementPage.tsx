import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Upload, UserPlus, UserX } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineAlert } from '../components/InlineAlert';
import { Modal } from '../components/Modal';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { useListQueryState } from '../hooks/useListQueryState';
import { useServerList } from '../hooks/useServerList';
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
import { UserForm } from '../components/forms/UserForm';
import { createEmptyUserForm, toUserFormState, type UserFormState } from '../components/forms/userFormState';
import { ExportColumnSelector } from '../components/ExportColumnSelector';
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
  'schoolIdNumber',
  'section',
  'address',
  'phoneNumber',
  'linkedStudentEmails'
] as const;
const emptyUserFilters = {
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
  'schoolIdNumber',
  'section',
  'phoneNumber',
  'linkedStudents'
];

type TableColumnKey =
  | 'user'
  | 'status'
  | 'cardUid'
  | 'schoolIdNumber'
  | 'gradeLevel'
  | 'section'
  | 'phoneNumber'
  | 'address'
  | 'linkedStudents';

const allTableColumns: { key: TableColumnKey; label: string }[] = [
  { key: 'user', label: 'User' },
  { key: 'status', label: 'Status' },
  { key: 'cardUid', label: 'Card UID' },
  { key: 'schoolIdNumber', label: 'School ID number' },
  { key: 'gradeLevel', label: 'Grade level' },
  { key: 'section', label: 'Section' },
  { key: 'phoneNumber', label: 'Mobile number' },
  { key: 'address', label: 'Address' },
  { key: 'linkedStudents', label: 'Linked students' }
];

const defaultVisibleTableColumns: TableColumnKey[] = [
  'user',
  'status',
  'cardUid',
  'gradeLevel',
  'section'
];

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
  const query = useListQueryState({
    pageSize: USER_PAGE_SIZE,
    defaultSort: 'name',
    defaultFilters: emptyUserFilters
  });

  const [studentsDirectory, setStudentsDirectory] = useState<ManagedUser[]>([]);
  const [guardiansDirectory, setGuardiansDirectory] = useState<ManagedUser[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [formState, setFormState] = useState<UserFormState>(createEmptyUserForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const initialFormStateRef = useRef<UserFormState>(createEmptyUserForm());
  const initialImageFileRef = useRef<File | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ManagedUserImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState(defaultUserExportColumns);

  const visibleColumnsStorageKey = `perl.people.visibleColumns.${activeSchool.id}`;
  const loadVisibleTableColumns = (storageKey: string): TableColumnKey[] => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return defaultVisibleTableColumns;
      const parsed = JSON.parse(stored) as string[];
      const valid = allTableColumns.map((column) => column.key);
      const restored = parsed.filter((key): key is TableColumnKey => valid.includes(key as TableColumnKey));
      return restored.length > 0 ? restored : defaultVisibleTableColumns;
    } catch {
      return defaultVisibleTableColumns;
    }
  };

  const [visibleTableColumns, setVisibleTableColumns] = useState<TableColumnKey[]>(() =>
    loadVisibleTableColumns(visibleColumnsStorageKey)
  );
  const [loadedColumnsKey, setLoadedColumnsKey] = useState(visibleColumnsStorageKey);

  if (loadedColumnsKey !== visibleColumnsStorageKey) {
    setLoadedColumnsKey(visibleColumnsStorageKey);
    setVisibleTableColumns(loadVisibleTableColumns(visibleColumnsStorageKey));
  }

  const updateVisibleTableColumns = (columns: TableColumnKey[]) => {
    setVisibleTableColumns(columns);
    window.localStorage.setItem(visibleColumnsStorageKey, JSON.stringify(columns));
  };

  const [deactivateTarget, setDeactivateTarget] = useState<ManagedUser | null>(null);

  const listRequestKey = [
    activeSchool.id,
    query.page,
    query.pageSize,
    query.debouncedSearch,
    query.sort,
    query.dir,
    query.filters.role,
    query.filters.status,
    reloadToken
  ].join('|');

  const {
    items: users,
    total,
    status: listStatus,
    error: listError
  } = useServerList<ManagedUser>({
    requestKey: listRequestKey,
    enabled: Boolean(sessionUser),
    errorMessage: 'Unable to load school users.',
    fetcher: () =>
      fetchAdminUsers(activeSchool.id, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.debouncedSearch || undefined,
        sort: query.sort,
        dir: query.dir,
        role: (query.filters.role || undefined) as SchoolUserRole | undefined,
        status: (query.filters.status || undefined) as 'active' | 'inactive' | undefined
      }).then((payload) => ({ items: payload.users, total: payload.total }))
  });

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;

    void fetchAdminUsers(activeSchool.id, {
      page: 1,
      pageSize: 1,
      sort: 'name',
      dir: 'asc',
      role: 'STUDENT',
      all: true
    })
      .then((payload) => {
        if (!cancelled) setStudentsDirectory(payload.users);
      })
      .catch(() => {
        if (!cancelled) setStudentsDirectory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, reloadToken, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;

    void fetchAdminUsers(activeSchool.id, {
      page: 1,
      pageSize: 1,
      sort: 'name',
      dir: 'asc',
      role: 'GUARDIAN',
      all: true
    })
      .then((payload) => {
        if (!cancelled) setGuardiansDirectory(payload.users);
      })
      .catch(() => {
        if (!cancelled) setGuardiansDirectory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, reloadToken, sessionUser]);

  const selectedUser = useMemo(
    () => users.find((managedUser) => managedUser.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const studentNames = useMemo(
    () =>
      new Map(
        studentsDirectory.map((student) => [student.id, `${student.firstName} ${student.lastName}`])
      ),
    [studentsDirectory]
  );

  const guardianAddressByStudentId = useMemo(() => {
    const fallbacks = new Map<string, string>();
    for (const guardian of guardiansDirectory) {
      if (!guardian.address) continue;
      for (const studentId of guardian.linkedStudentIds) {
        if (!fallbacks.has(studentId)) {
          fallbacks.set(studentId, guardian.address);
        }
      }
    }
    return fallbacks;
  }, [guardiansDirectory]);

  const studentAddressByGuardianId = useMemo(() => {
    const fallbacks = new Map<string, string>();
    const studentsById = new Map(studentsDirectory.map((student) => [student.id, student]));
    for (const guardian of guardiansDirectory) {
      for (const studentId of guardian.linkedStudentIds) {
        const student = studentsById.get(studentId);
        if (student?.address) {
          fallbacks.set(guardian.id, student.address);
          break;
        }
      }
    }
    return fallbacks;
  }, [guardiansDirectory, studentsDirectory]);

  const resolveAddressValue = useCallback(
    (managedUser: ManagedUser): { text: string; fallbackTag: 'guardian' | 'student' | null } => {
      if (managedUser.address) return { text: managedUser.address, fallbackTag: null };
      if (managedUser.role === 'STUDENT') {
        const guardianAddress = guardianAddressByStudentId.get(managedUser.id);
        if (guardianAddress) return { text: guardianAddress, fallbackTag: 'guardian' };
      }
      if (managedUser.role === 'GUARDIAN') {
        const studentAddress = studentAddressByGuardianId.get(managedUser.id);
        if (studentAddress) return { text: studentAddress, fallbackTag: 'student' };
      }
      return { text: '', fallbackTag: null };
    },
    [guardianAddressByStudentId, studentAddressByGuardianId]
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
      { key: 'schoolIdNumber', label: 'School ID number', value: (managedUser) => managedUser.schoolIdNumber ?? '' },
      { key: 'section', label: 'Section', value: (managedUser) => managedUser.section ?? '' },
      { key: 'phoneNumber', label: 'Mobile number', value: (managedUser) => managedUser.phoneNumber ?? '' },
      {
        key: 'address',
        label: 'Address',
        value: (managedUser) => {
          const { text, fallbackTag } = resolveAddressValue(managedUser);
          if (!text) return '';
          return fallbackTag ? `${text} (${fallbackTag})` : text;
        }
      },
      {
        key: 'linkedStudents',
        label: 'Linked students',
        value: (managedUser) =>
          managedUser.linkedStudentIds
            .map((studentId) => studentNames.get(studentId) ?? studentId)
            .join('; ')
      }
    ],
    [studentNames, resolveAddressValue]
  );

  const availableTableColumns = allTableColumns.filter((column) => column.key !== 'user' || canEdit);
  const visibleTableColumnSet = new Set(visibleTableColumns);
  const shownTableColumns = availableTableColumns.filter((column) => visibleTableColumnSet.has(column.key));
  const rowColumnCount = shownTableColumns.length + (canEdit ? 1 : 0);

  const renderTableCell = (managedUser: ManagedUser, key: TableColumnKey) => {
    switch (key) {
      case 'user':
        return (
          <div className="user-identity">
            {managedUser.imageUrl ? (
              <img src={managedUser.imageUrl} alt="" className="user-avatar" loading="lazy" />
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
        );
      case 'status':
        return <UserStatusPill user={managedUser} />;
      case 'cardUid':
        return managedUser.cardUid ?? '—';
      case 'schoolIdNumber':
        return managedUser.schoolIdNumber ?? '—';
      case 'gradeLevel':
        return managedUser.gradeLevel ?? '—';
      case 'section':
        return managedUser.section ?? '—';
      case 'phoneNumber':
        return managedUser.phoneNumber ?? '—';
      case 'address': {
        const { text, fallbackTag } = resolveAddressValue(managedUser);
        if (!text) return '—';
        if (!fallbackTag) return text;
        const title =
          fallbackTag === 'guardian'
            ? "Shown from a linked guardian's address"
            : "Shown from a linked student's address";
        return (
          <span className="inherited-value">
            {text}{' '}
            <span className="inherited-value__tag" title={title}>
              ({fallbackTag})
            </span>
          </span>
        );
      }
      case 'linkedStudents':
        return managedUser.role === 'GUARDIAN'
          ? managedUser.linkedStudentIds
              .map((studentId) => studentNames.get(studentId) ?? studentId)
              .join(', ') || 'No students linked'
          : '—';
      default:
        return null;
    }
  };

  if (!sessionUser) {
    return null;
  }

  const isFormDirty = () =>
    JSON.stringify(formState) !== JSON.stringify(initialFormStateRef.current) ||
    imageFile !== initialImageFileRef.current;

  const resetEditor = () => {
    setEditorOpen(false);
    setError(null);
    setDiscardConfirmOpen(false);
  };

  const requestCloseEditor = () => {
    if (isFormDirty()) {
      setDiscardConfirmOpen(true);
      return;
    }
    resetEditor();
  };

  const openNewUser = () => {
    const initial = createEmptyUserForm();
    setEditorMode('create');
    setSelectedUserId(null);
    setFormState(initial);
    initialFormStateRef.current = initial;
    setImageFile(null);
    initialImageFileRef.current = null;
    setImagePreview(null);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  };

  const openEditor = (managedUser: ManagedUser) => {
    const initial = toUserFormState(managedUser);
    if (managedUser.role === 'STUDENT') {
      initial.linkedGuardianIds = guardiansDirectory
        .filter((guardian) => guardian.linkedStudentIds.includes(managedUser.id))
        .map((guardian) => guardian.id);
    }
    setEditorMode('edit');
    setSelectedUserId(managedUser.id);
    setFormState(initial);
    initialFormStateRef.current = initial;
    setImageFile(null);
    initialImageFileRef.current = null;
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
    setSaveStatus('saving');
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
          schoolIdNumber: normalizeOptionalField(formState.schoolIdNumber),
          section: normalizeOptionalField(formState.section),
          imageUrl: normalizeOptionalField(formState.imageUrl),
          phoneNumber: normalizeOptionalField(formState.phoneNumber),
          address: normalizeOptionalField(formState.address),
          linkedStudentIds: formState.linkedStudentIds,
          linkedGuardianIds: formState.role === 'STUDENT' ? formState.linkedGuardianIds : undefined
        };

        let createdUser = await createAdminUser(activeSchool.id, payload);
        if (imageFile) {
          createdUser = await uploadAdminUserImage(activeSchool.id, createdUser.id, imageFile);
        }
        setNotice(`Added ${createdUser.firstName} ${createdUser.lastName} to ${createdUser.role}.`);
        setReloadToken((token) => token + 1);
        resetEditor();
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
          schoolIdNumber: normalizeOptionalField(formState.schoolIdNumber),
          section: normalizeOptionalField(formState.section),
          imageUrl: normalizeOptionalField(formState.imageUrl),
          phoneNumber: normalizeOptionalField(formState.phoneNumber),
          address: normalizeOptionalField(formState.address),
          linkedStudentIds: formState.linkedStudentIds,
          linkedGuardianIds: formState.role === 'STUDENT' ? formState.linkedGuardianIds : undefined
        };

        if (formState.password.trim()) {
          payload.password = formState.password;
        }

        let updatedUser = await updateAdminUser(activeSchool.id, selectedUser.id, payload);
        if (imageFile) {
          updatedUser = await uploadAdminUserImage(activeSchool.id, selectedUser.id, imageFile);
        }
        setNotice(`Updated ${updatedUser.firstName} ${updatedUser.lastName}.`);
        setReloadToken((token) => token + 1);
        resetEditor();
      }

      setSaveStatus('idle');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this user.');
      setSaveStatus('idle');
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
    setError(null);
    setNotice(null);

    try {
      const updatedUser = await deactivateAdminUser(activeSchool.id, managedUser.id);
      setNotice(`${updatedUser.firstName} ${updatedUser.lastName} has been deactivated.`);
      setReloadToken((token) => token + 1);

      if (selectedUserId === updatedUser.id) {
        setFormState(toUserFormState(updatedUser));
      }
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate this user.'
      );
    } finally {
      setDeactivateTarget(null);
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
        schoolIdNumber: read(row, 'schoolIdNumber') || null,
        section: read(row, 'section') || null,
        address: read(row, 'address') || null,
        phoneNumber: read(row, 'phoneNumber') || null,
        linkedStudentEmails: read(row, 'linkedStudentEmails')
          .split(';')
          .map((email) => email.trim())
          .filter(Boolean)
      }));
      const result = await importAdminUsers(activeSchool.id, rows);
      setImportResult(result);
      setReloadToken((token) => token + 1);
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

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const payload = await fetchAdminUsers(activeSchool.id, {
        page: 1,
        pageSize: 1,
        search: query.debouncedSearch || undefined,
        sort: query.sort,
        dir: query.dir,
        role: (query.filters.role || undefined) as SchoolUserRole | undefined,
        status: (query.filters.status || undefined) as 'active' | 'inactive' | undefined,
        all: true
      });
      downloadCsvColumns(
        `${activeSchool.slug}-people-${new Date().toISOString().slice(0, 10)}.csv`,
        userExportColumns,
        selectedExportColumns,
        payload.users
      );
      setNotice(`Exported ${payload.users.length} matching ${payload.users.length === 1 ? 'person' : 'people'}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export people.');
    } finally {
      setExporting(false);
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
          <p className="panel-label">Matching accounts</p>
          <strong>{total}</strong>
          <p>Across the current search and filters for this school.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Students on file</p>
          <strong>{studentsDirectory.length}</strong>
          <p>RFID-attendance subjects available to link as guardians.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Page size</p>
          <strong>{USER_PAGE_SIZE}</strong>
          <p>Records loaded per page directly from the server.</p>
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
                <Upload size={16} aria-hidden="true" />
                Import CSV
              </button>
              <button className="secondary-button" type="button" onClick={openNewUser}>
                <UserPlus size={16} aria-hidden="true" />
                New user
              </button>
            </div> : (
              <span className="status-pill status-pill--muted">Read-only support view</span>
            )}
          </div>

          {error && !editorOpen ? (
            <InlineAlert tone="error" message={error} />
          ) : notice ? (
            <InlineAlert message={notice} />
          ) : null}

          <ListToolbar
            activeFilterCount={query.activeFilterCount}
            exportColumns={userExportColumns}
            exportDisabled={listStatus === 'loading' || exporting}
            onClear={query.clear}
            onExport={() => void handleExport()}
            onExportColumnsChange={setSelectedExportColumns}
            onSearchChange={query.setSearch}
            resultCount={total}
            resultLabel={total === 1 ? 'person' : 'people'}
            search={query.search}
            searchLabel="Search name, email, class, or card"
            selectedExportColumns={selectedExportColumns}
          >
            <label className="compact-field">
              <span>Role</span>
              <select
                value={query.filters.role}
                onChange={(event) => query.setFilter('role', event.target.value)}
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label className="compact-field">
              <span>Status</span>
              <select
                value={query.filters.status}
                onChange={(event) => query.setFilter('status', event.target.value)}
              >
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </ListToolbar>

          <div className="table-column-controls">
            <ExportColumnSelector
              columns={availableTableColumns}
              onChange={(keys) => updateVisibleTableColumns(keys as TableColumnKey[])}
              selectedColumns={visibleTableColumns}
              triggerLabel="Shown columns"
              heading="Table columns"
              legend="Columns shown in the roster table below"
            />
          </div>

          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  {shownTableColumns.map((column) => (
                    <th key={column.key} scope="col">{column.label}</th>
                  ))}
                  {canEdit ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {listStatus === 'loading' ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`user-skeleton-${index}`}>
                      <td colSpan={rowColumnCount}>
                        <div className="table-skeleton" />
                      </td>
                    </tr>
                  ))
                ) : listStatus === 'error' ? (
                  <tr>
                    <td colSpan={rowColumnCount}>
                      <div className="empty-state empty-state--error" role="alert">
                        <h3>Unable to load the roster</h3>
                        <p>{listError ?? 'Try again in a moment.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={rowColumnCount}>
                      <div className="empty-state">
                        <h3>{query.activeFilterCount > 0 ? 'No matching people' : 'No users found'}</h3>
                        <p>
                          {query.activeFilterCount > 0
                            ? 'Adjust or clear the filters to broaden the roster.'
                            : 'Create the first school-scoped account from the editor on this page.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((managedUser) => (
                    <tr key={managedUser.id}>
                      {shownTableColumns.map((column) => (
                        <td key={column.key} data-label={column.label}>
                          {renderTableCell(managedUser, column.key)}
                        </td>
                      ))}
                      {canEdit ? (
                        <td data-label="Actions">
                          <div className="table-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => openEditor(managedUser)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              className="secondary-button secondary-button--danger"
                              type="button"
                              disabled={!managedUser.isActive || managedUser.id === sessionUser.id}
                              onClick={() => setDeactivateTarget(managedUser)}
                            >
                              <UserX size={16} aria-hidden="true" />
                              Deactivate
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {listStatus === 'ready' ? (
            <Pagination
              itemLabel="users"
              onPageChange={query.setPage}
              page={query.page}
              pageSize={query.pageSize}
              totalItems={total}
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
              <Download size={16} aria-hidden="true" />
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
        onClose={requestCloseEditor}
        open={editorOpen}
        title={editorMode === 'create' ? 'Add school user' : 'Update school user'}
      >
        <UserForm
          error={error}
          imagePreview={imagePreview}
          mode={editorMode}
          onCancel={requestCloseEditor}
          onChange={setFormState}
          onImageChange={handleImageChange}
          onSubmit={handleSubmit}
          saving={saveStatus === 'saving'}
          students={studentsDirectory}
          guardians={guardiansDirectory}
          value={formState}
        />
      </Modal>

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        description={`Closing now will lose the edits made to ${
          editorMode === 'create' ? 'this new user' : `${formState.firstName} ${formState.lastName}`.trim() || 'this user'
        }.`}
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={resetEditor}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title={deactivateTarget ? `Deactivate ${deactivateTarget.firstName} ${deactivateTarget.lastName}?` : 'Deactivate user?'}
        description="Their account will no longer be able to sign in or hold an active RFID card."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => {
          if (deactivateTarget) void handleDeactivate(deactivateTarget);
        }}
        onCancel={() => setDeactivateTarget(null)}
      />
    </section>
  );
};
