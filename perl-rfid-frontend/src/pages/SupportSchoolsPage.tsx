import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListToolbar } from '../components/ListToolbar';
import { Modal } from '../components/Modal';
import { useTenantContext } from '../providers/TenantContext';
import {
  createSupportSchool,
  enterSupportSchool,
  updateSupportSchoolSmsSettings
} from '../lib/api';
import { downloadCsvColumns, type CsvColumn } from '../lib/csv';
import type { SchoolProfile } from '../types/school';
import { canProvisionSchools, isSupportAgent } from '../lib/permissions';
import { useAuth } from '../providers/auth-context';

const emptySchoolForm = {
  name: '',
  slug: '',
  contactEmail: '',
  primaryColor: '#164E63',
  secondaryColor: '#ECF4F6',
  accentColor: '#F59E0B'
};
const schoolExportColumns: CsvColumn<SchoolProfile>[] = [
  { key: 'name', label: 'School name', value: (school) => school.name },
  { key: 'slug', label: 'Slug', value: (school) => school.slug },
  { key: 'contactEmail', label: 'Contact email', value: (school) => school.contactEmail },
  {
    key: 'smsEnabled',
    label: 'SMS subscription',
    value: (school) => (school.smsEnabled ? 'Enabled' : 'Disabled')
  },
  {
    key: 'smsSenderName',
    label: 'SMS sender',
    value: (school) => school.smsSenderName ?? ''
  },
  {
    key: 'primaryColor',
    label: 'Primary color',
    value: (school) => school.theme.primaryColor
  },
  {
    key: 'secondaryColor',
    label: 'Secondary color',
    value: (school) => school.theme.secondaryColor
  },
  {
    key: 'accentColor',
    label: 'Accent color',
    value: (school) => school.theme.accentColor
  }
];
const defaultSchoolExportColumns = schoolExportColumns.map((column) => column.key);

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const SupportSchoolsPage = () => {
  const { user } = useAuth();
  const canProvision = canProvisionSchools(user?.role);
  const {
    activeSchool,
    schools,
    setActiveSchoolSlug,
    setAuthenticatedSchool
  } = useTenantContext();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState(emptySchoolForm);
  const [search, setSearch] = useState('');
  const [savingSmsSchoolId, setSavingSmsSchoolId] = useState<string | null>(null);
  const [selectedExportColumns, setSelectedExportColumns] = useState(
    defaultSchoolExportColumns
  );
  const filteredSchools = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return schools;
    return schools.filter((school) =>
      [
        school.name,
        school.slug,
        school.contactEmail,
        school.smsEnabled ? 'enabled' : 'disabled',
        school.smsSenderName ?? ''
      ]
        .some((value) => value.toLocaleLowerCase().includes(query))
    );
  }, [schools, search]);

  const updateSmsSubscription = async (school: SchoolProfile, enabled: boolean) => {
    setSavingSmsSchoolId(school.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSupportSchoolSmsSettings(school.id, {
        smsEnabled: enabled,
        smsSenderName: school.smsSenderName
      });
      const updatedSchools = schools.map((entry) => (entry.id === updated.id ? updated : entry));
      setAuthenticatedSchool(
        activeSchool.id === updated.id ? updated : activeSchool,
        updatedSchools
      );
      setNotice(`${updated.name} SMS subscription is now ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update SMS subscription.'
      );
    } finally {
      setSavingSmsSchoolId(null);
    }
  };

  const selectSchool = (schoolId: string, schoolSlug: string, destination?: string) => {
    setError(null);
    setNotice(null);
    void enterSupportSchool(schoolId)
      .then(() => {
        setActiveSchoolSlug(schoolSlug);
        if (destination) navigate(destination);
      })
      .catch((selectError) =>
        setError(
          selectError instanceof Error
            ? selectError.message
            : 'Unable to open this school support context.'
        )
      );
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditorOpen(false);
    setError(null);
  };

  const handleCreateSchool = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const school = await createSupportSchool({
        name: form.name,
        slug: form.slug,
        contactEmail: form.contactEmail,
        theme: {
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          accentColor: form.accentColor
        }
      });
      setAuthenticatedSchool(school, [...schools, school]);
      setNotice(`${school.name} was created and is now the active support context.`);
      setForm(emptySchoolForm);
      setSlugEdited(false);
      setEditorOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create school.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="admin-shell">
      <header className="section-heading">
        <div>
          <p className="panel-label">{canProvision ? 'System administration' : 'Platform support'}</p>
          <h2>School accounts</h2>
          <p className="section-copy">
            {isSupportAgent(user?.role)
              ? 'Select a school context to inspect its profile, people, devices, attendance, and action history in read-only mode.'
              : 'Select a school context to administer its profile, people, devices, and attendance. Every change is written to the system action log.'}
          </p>
        </div>
        {canProvision ? <button
          className="primary-button"
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            setEditorOpen(true);
          }}
        >
          Add school
        </button> : null}
      </header>

      {error ? (
        <div className="form-message form-message--error" role="alert">{error}</div>
      ) : null}
      {notice ? (
        <div className="form-message form-message--success" role="status">{notice}</div>
      ) : null}

      <ListToolbar
        activeFilterCount={search ? 1 : 0}
        exportColumns={schoolExportColumns}
        onClear={() => setSearch('')}
        onExport={() =>
          downloadCsvColumns(
            `school-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
            schoolExportColumns,
            selectedExportColumns,
            filteredSchools
          )
        }
        onExportColumnsChange={setSelectedExportColumns}
        onSearchChange={setSearch}
        resultCount={filteredSchools.length}
        resultLabel={filteredSchools.length === 1 ? 'school' : 'schools'}
        search={search}
        searchLabel="Search school, slug, or contact email"
        selectedExportColumns={selectedExportColumns}
      />

      <div className="support-school-list">
        {filteredSchools.length === 0 ? (
          <div className="empty-state">
            <h3>No matching schools</h3>
            <p>Clear the search to return to the full protected school directory.</p>
          </div>
        ) : filteredSchools.map((school) => {
          const isActive = school.id === activeSchool.id;

          return (
            <article className="support-school-row" key={school.id}>
              <div>
                <strong>{school.name}</strong>
                <p>{school.contactEmail} · {school.slug}</p>
                <p>
                  <span className={`status-pill ${school.smsEnabled ? 'status-pill--admitted' : 'status-pill--muted'}`}>
                    SMS {school.smsEnabled ? 'enabled' : 'disabled'}
                  </span>
                  {school.smsSenderName ? ` · Sender: ${school.smsSenderName}` : ''}
                </p>
              </div>
              <div className="table-actions">
                {canProvision ? (
                  <button
                    className="secondary-button"
                    disabled={savingSmsSchoolId === school.id}
                    type="button"
                    onClick={() => void updateSmsSubscription(school, !school.smsEnabled)}
                  >
                    {savingSmsSchoolId === school.id
                      ? 'Saving…'
                      : school.smsEnabled
                        ? 'Disable SMS'
                        : 'Enable SMS'}
                  </button>
                ) : null}
                <button
                  className={isActive ? 'primary-button' : 'secondary-button'}
                  type="button"
                  onClick={() => selectSchool(school.id, school.slug)}
                >
                  {isActive ? 'Current context' : 'Select school'}
                </button>
                <button
                  className="secondary-button secondary-button--link"
                  type="button"
                  onClick={() => selectSchool(school.id, school.slug, '/admin/users')}
                >
                  Open people
                </button>
                <button
                  className="secondary-button secondary-button--link"
                  type="button"
                  onClick={() => selectSchool(school.id, school.slug, '/logs')}
                >
                  Attendance
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        description="Create the tenant profile first. School users and devices can be added after provisioning."
        onClose={closeEditor}
        open={editorOpen}
        title="Add school account"
      >
        <form className="admin-form modal-form" onSubmit={handleCreateSchool}>
          {error ? (
            <div className="form-message form-message--error" role="alert">{error}</div>
          ) : null}

          <label className="field">
            <span>School name</span>
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  slug: slugEdited ? current.slug : toSlug(name)
                }));
              }}
              required
              minLength={2}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>School slug</span>
              <input
                type="text"
                value={form.slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setForm((current) => ({ ...current, slug: toSlug(event.target.value) }));
                }}
                placeholder="northview-academy"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
            <label className="field">
              <span>Contact email</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactEmail: event.target.value }))
                }
                required
              />
            </label>
          </div>

          <div className="field-grid field-grid--triple">
            {([
              ['primaryColor', 'Primary'],
              ['secondaryColor', 'Background'],
              ['accentColor', 'Accent']
            ] as const).map(([key, label]) => (
              <label className="field field--color" key={key}>
                <span>{label} color</span>
                <input
                  type="color"
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
                <strong>{form[key]}</strong>
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? 'Creating school…' : 'Create school'}
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
