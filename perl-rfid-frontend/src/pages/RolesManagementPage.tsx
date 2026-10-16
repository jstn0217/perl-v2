import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineAlert } from '../components/InlineAlert';
import { ListToolbar } from '../components/ListToolbar';
import { Modal } from '../components/Modal';
import {
  createRole,
  deactivateRole,
  fetchPermissionCatalog,
  fetchRoles,
  reactivateRole,
  updateRole
} from '../lib/api';
import { downloadCsvColumns, type CsvColumn } from '../lib/csv';
import { canManageRoles } from '../lib/permissions';
import { useAuth } from '../providers/auth-context';
import type {
  PermissionCatalogEntry,
  PermissionKey,
  RoleBaseRole,
  RoleListItem
} from '../types/role';

interface RoleFormState {
  name: string;
  description: string;
  baseRole: RoleBaseRole;
  permissions: PermissionKey[];
}

const emptyRoleForm: RoleFormState = {
  name: '',
  description: '',
  baseRole: 'ADMIN',
  permissions: []
};

const toRoleFormState = (role: RoleListItem): RoleFormState => ({
  name: role.name,
  description: role.description ?? '',
  baseRole: role.baseRole === 'STAFF' ? 'STAFF' : 'ADMIN',
  permissions: [...role.permissions]
});

const baseRoleOptions: RoleBaseRole[] = ['ADMIN', 'STAFF'];

export const RolesManagementPage = () => {
  const { user } = useAuth();
  const canManage = canManageRoles(user?.role);

  const [reloadToken, setReloadToken] = useState(0);
  const [loadedData, setLoadedData] = useState<{
    token: number;
    roles: RoleListItem[];
    catalog: PermissionCatalogEntry[];
  } | null>(null);
  const [loadedError, setLoadedError] = useState<{ token: number; message: string } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedExportColumns, setSelectedExportColumns] = useState([
    'name',
    'baseRole',
    'permissionCount',
    'status',
    'type'
  ]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [formState, setFormState] = useState<RoleFormState>(emptyRoleForm);
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<RoleListItem | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchRoles(), fetchPermissionCatalog()])
      .then(([roleList, catalogEntries]) => {
        if (cancelled) return;
        setLoadedData({ token: reloadToken, roles: roleList, catalog: catalogEntries });
        setLoadedError(null);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setLoadedError({
          token: reloadToken,
          message: fetchError instanceof Error ? fetchError.message : 'Unable to load roles.'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const roles = useMemo(
    () => (loadedData?.token === reloadToken ? loadedData.roles : []),
    [loadedData, reloadToken]
  );
  const catalog = useMemo(
    () => (loadedData?.token === reloadToken ? loadedData.catalog : []),
    [loadedData, reloadToken]
  );
  const loadStatus: 'loading' | 'ready' | 'error' =
    loadedError?.token === reloadToken
      ? 'error'
      : loadedData?.token === reloadToken
        ? 'ready'
        : 'loading';
  const loadError = loadedError?.token === reloadToken ? loadedError.message : null;

  const catalogByKey = useMemo(
    () => new Map(catalog.map((entry) => [entry.key, entry])),
    [catalog]
  );

  const catalogGroups = useMemo(() => {
    const groups = new Map<string, PermissionCatalogEntry[]>();
    for (const entry of catalog) {
      const existing = groups.get(entry.group) ?? [];
      existing.push(entry);
      groups.set(entry.group, existing);
    }
    return [...groups.entries()];
  }, [catalog]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return roles;
    return roles.filter((role) =>
      [role.name, role.description ?? '', role.baseRole].some((value) =>
        value.toLocaleLowerCase().includes(query)
      )
    );
  }, [roles, search]);

  const roleExportColumns: CsvColumn<RoleListItem>[] = [
    { key: 'name', label: 'Role name', value: (role) => role.name },
    { key: 'baseRole', label: 'Base role', value: (role) => role.baseRole },
    { key: 'permissionCount', label: 'Permissions', value: (role) => role.permissions.length },
    { key: 'status', label: 'Status', value: (role) => (role.isActive ? 'Active' : 'Inactive') },
    { key: 'type', label: 'Type', value: (role) => (role.isSystem ? 'Built-in' : 'Custom') }
  ];

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingRole(null);
    setError(null);
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditingRole(null);
    setFormState(emptyRoleForm);
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  };

  const openEdit = (role: RoleListItem) => {
    setEditorMode('edit');
    setEditingRole(role);
    setFormState(toRoleFormState(role));
    setError(null);
    setNotice(null);
    setEditorOpen(true);
  };

  const togglePermission = (key: PermissionKey, checked: boolean) => {
    setFormState((current) => ({
      ...current,
      permissions: checked
        ? [...current.permissions, key]
        : current.permissions.filter((permission) => permission !== key)
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formState.permissions.length === 0) {
      setError('Select at least one permission.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (editorMode === 'create') {
        const created = await createRole({
          name: formState.name,
          description: formState.description.trim() || null,
          baseRole: formState.baseRole,
          permissions: formState.permissions
        });
        setNotice(`Created role "${created.name}".`);
      } else if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          name: formState.name,
          description: formState.description.trim() || null,
          permissions: formState.permissions
        });
        setNotice(`Updated role "${updated.name}".`);
      }
      setReloadToken((token) => token + 1);
      setEditorOpen(false);
      setEditingRole(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (role: RoleListItem) => {
    setError(null);
    setNotice(null);
    try {
      const updated = await deactivateRole(role.id);
      setNotice(`Deactivated role "${updated.name}".`);
      setReloadToken((token) => token + 1);
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate this role.'
      );
    } finally {
      setDeactivateTarget(null);
    }
  };

  const handleReactivate = async (role: RoleListItem) => {
    setError(null);
    setNotice(null);
    setReactivating(role.id);
    try {
      const updated = await reactivateRole(role.id);
      setNotice(`Reactivated role "${updated.name}".`);
      setReloadToken((token) => token + 1);
    } catch (reactivateError) {
      setError(
        reactivateError instanceof Error ? reactivateError.message : 'Unable to reactivate this role.'
      );
    } finally {
      setReactivating(null);
    }
  };

  return (
    <section className="admin-shell">
      <header className="section-heading">
        <div className="platform-heading">
          <ShieldCheck size={32} aria-hidden="true" className="platform-mark" />
          <div>
            <p className="panel-label">{canManage ? 'System administration' : 'Platform support'}</p>
            <h2>Roles &amp; permissions</h2>
            <p className="section-copy">
              {canManage
                ? 'Create and edit custom roles that admins can assign to ADMIN or STAFF users. Built-in roles cannot be changed.'
                : 'Review built-in and custom roles and the permissions each one grants, in read-only mode.'}
            </p>
          </div>
        </div>
        {canManage ? (
          <button className="primary-button" type="button" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            New role
          </button>
        ) : null}
      </header>

      {error ? <InlineAlert tone="error" message={error} /> : null}
      {notice ? <InlineAlert message={notice} /> : null}

      {loadStatus === 'ready' ? (
        <ListToolbar
          activeFilterCount={search ? 1 : 0}
          exportColumns={roleExportColumns}
          onClear={() => setSearch('')}
          onExport={() =>
            downloadCsvColumns(
              `roles-${new Date().toISOString().slice(0, 10)}.csv`,
              roleExportColumns,
              selectedExportColumns,
              filteredRoles
            )
          }
          onExportColumnsChange={setSelectedExportColumns}
          onSearchChange={setSearch}
          resultCount={filteredRoles.length}
          resultLabel={filteredRoles.length === 1 ? 'role' : 'roles'}
          search={search}
          searchLabel="Search role name or description"
          selectedExportColumns={selectedExportColumns}
        />
      ) : null}

      <div className="table-wrap">
        <table className="attendance-table">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Base role</th>
              <th scope="col">Permissions</th>
              <th scope="col">Status</th>
              {canManage ? <th scope="col">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={`role-skeleton-${index}`}>
                  <td colSpan={canManage ? 5 : 4}>
                    <div className="table-skeleton" />
                  </td>
                </tr>
              ))
            ) : loadStatus === 'error' ? (
              <tr>
                <td colSpan={canManage ? 5 : 4}>
                  <div className="empty-state empty-state--error" role="alert">
                    <h3>Unable to load roles</h3>
                    <p>{loadError ?? 'Try again in a moment.'}</p>
                  </div>
                </td>
              </tr>
            ) : filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 5 : 4}>
                  <div className="empty-state">
                    <h3>No matching roles</h3>
                    <p>Clear the search to see the full role list.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td data-label="Role">
                    <strong>{role.name}</strong>
                    <div className="table-actions">
                      <span
                        className={`status-pill ${role.isSystem ? 'status-pill--muted' : 'status-pill--admitted'}`}
                      >
                        {role.isSystem ? 'Built-in' : 'Custom'}
                      </span>
                    </div>
                    {role.description ? <p>{role.description}</p> : null}
                  </td>
                  <td data-label="Base role">{role.baseRole}</td>
                  <td data-label="Permissions">
                    {role.permissions.length === 0
                      ? 'None'
                      : role.permissions
                          .map((key) => catalogByKey.get(key)?.label ?? key)
                          .join(', ')}
                    <p>
                      {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                    </p>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`status-pill ${role.isActive ? 'status-pill--admitted' : 'status-pill--denied'}`}
                    >
                      {role.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage ? (
                    <td data-label="Actions">
                      {role.assignable ? (
                        <div className="table-actions">
                          <button className="secondary-button" type="button" onClick={() => openEdit(role)}>
                            Edit
                          </button>
                          {role.isActive ? (
                            <button
                              className="secondary-button secondary-button--danger"
                              type="button"
                              onClick={() => setDeactivateTarget(role)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={reactivating === role.id}
                              onClick={() => void handleReactivate(role)}
                            >
                              {reactivating === role.id ? 'Reactivating…' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="status-pill status-pill--muted">Not editable</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        description="Custom roles grant a fixed set of school-scoped permissions to ADMIN or STAFF users."
        onClose={closeEditor}
        open={editorOpen}
        title={editorMode === 'create' ? 'Create custom role' : `Edit ${editingRole?.name ?? 'role'}`}
      >
        <form className="admin-form modal-form" onSubmit={handleSubmit}>
          {error ? <InlineAlert tone="error" message={error} /> : null}

          <div className="field-grid">
            <label className="field">
              <span>Role name</span>
              <input
                autoFocus
                type="text"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                required
                minLength={2}
              />
            </label>

            <label className="field">
              <span>Base role</span>
              <select
                className="field-select"
                value={formState.baseRole}
                disabled={editorMode === 'edit'}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, baseRole: event.target.value as RoleBaseRole }))
                }
              >
                {baseRoleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {editorMode === 'edit' ? <small>Base role cannot change after a role is created.</small> : null}
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <input
              type="text"
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="What this role is for"
            />
          </label>

          {catalogGroups.map(([group, entries]) => (
            <fieldset className="student-link-fieldset" key={group}>
              <legend>{group}</legend>
              <div className="student-link-list">
                {entries.map((entry) => (
                  <label key={entry.key}>
                    <input
                      type="checkbox"
                      checked={formState.permissions.includes(entry.key)}
                      onChange={(event) => togglePermission(entry.key, event.target.checked)}
                    />
                    <span>
                      <strong>{entry.label}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving
                ? editorMode === 'create'
                  ? 'Creating role…'
                  : 'Saving changes…'
                : editorMode === 'create'
                  ? 'Create role'
                  : 'Save changes'}
            </button>
            <button className="secondary-button" type="button" onClick={closeEditor}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deactivateTarget !== null}
        title={deactivateTarget ? `Deactivate ${deactivateTarget.name}?` : 'Deactivate role?'}
        description="Users still assigned to this role will block deactivation until they're reassigned."
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
