import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineAlert } from '../components/InlineAlert';
import { ListToolbar } from '../components/ListToolbar';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { useListQueryState } from '../hooks/useListQueryState';
import { useServerList } from '../hooks/useServerList';
import {
  createAdminSubmission,
  fetchAdminSubmissions,
  updateAdminSubmission
} from '../lib/api';
import type { CsvColumn } from '../lib/csv';
import { downloadCsvColumns } from '../lib/csv';
import { formatAddress } from '../lib/address';
import { canManageSubmissions } from '../lib/permissions';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import type {
  SubmissionRecord,
  SubmissionStatus,
  SubmissionType
} from '../types/submission';

const SUBMISSION_PAGE_SIZE = 10;
const EXPORT_PAGE_SIZE_CAP = 100;

const submissionTypes: SubmissionType[] = ['ENROLLMENT', 'INQUIRY'];
const submissionStatuses: SubmissionStatus[] = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'DECLINED'];
const typeLabels: Record<SubmissionType, string> = {
  ENROLLMENT: 'Enrollment',
  INQUIRY: 'Inquiry'
};
const statusLabels: Record<SubmissionStatus, string> = {
  NEW: 'New',
  IN_REVIEW: 'In review',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined'
};
const statusPillClass: Record<SubmissionStatus, string> = {
  NEW: 'status-pill--muted',
  IN_REVIEW: 'status-pill--pending',
  ACCEPTED: 'status-pill--admitted',
  DECLINED: 'status-pill--denied'
};
const emptySubmissionFilters = {
  type: '',
  status: ''
};

interface ManualFormState {
  type: SubmissionType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  gradeLevelApplying: string;
  guardianName: string;
  message: string;
}

const emptyManualForm: ManualFormState = {
  type: 'ENROLLMENT',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  gradeLevelApplying: '',
  guardianName: '',
  message: ''
};

const normalize = (value: string) => (value.trim().length > 0 ? value.trim() : null);

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const submissionExportColumns: CsvColumn<SubmissionRecord>[] = [
  { key: 'firstName', label: 'First name', value: (row) => row.firstName },
  { key: 'lastName', label: 'Last name', value: (row) => row.lastName },
  { key: 'type', label: 'Type', value: (row) => typeLabels[row.type] },
  { key: 'status', label: 'Status', value: (row) => statusLabels[row.status] },
  { key: 'source', label: 'Source', value: (row) => (row.source === 'PUBLIC' ? 'Public form' : 'Manual') },
  { key: 'email', label: 'Email', value: (row) => row.email },
  { key: 'phone', label: 'Phone', value: (row) => row.phone ?? '' },
  { key: 'address', label: 'Address', value: (row) => formatAddress(row) },
  { key: 'gradeLevelApplying', label: 'Grade level applying', value: (row) => row.gradeLevelApplying ?? '' },
  { key: 'guardianName', label: 'Guardian name', value: (row) => row.guardianName ?? '' },
  { key: 'message', label: 'Message', value: (row) => row.message ?? '' },
  { key: 'notes', label: 'Notes', value: (row) => row.notes ?? '' },
  { key: 'createdAt', label: 'Submitted at', value: (row) => formatTimestamp(row.createdAt) }
];
const defaultSubmissionExportColumns = submissionExportColumns.map((column) => column.key);

export const SubmissionsPage = () => {
  const { user } = useAuth();
  const { activeSchool } = useTenantContext();
  const canEdit = canManageSubmissions(user?.role);

  const query = useListQueryState({
    pageSize: SUBMISSION_PAGE_SIZE,
    defaultSort: 'createdAt',
    defaultFilters: emptySubmissionFilters
  });

  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState(defaultSubmissionExportColumns);

  const [detailTarget, setDetailTarget] = useState<SubmissionRecord | null>(null);
  const [detailStatus, setDetailStatus] = useState<SubmissionStatus>('NEW');
  const [detailNotes, setDetailNotes] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualDiscardConfirmOpen, setManualDiscardConfirmOpen] = useState(false);

  const listRequestKey = [
    activeSchool.id,
    query.page,
    query.pageSize,
    query.debouncedSearch,
    query.sort,
    query.dir,
    query.filters.type,
    query.filters.status,
    reloadToken
  ].join('|');

  const {
    items: submissions,
    total,
    status: listStatus,
    error: listError
  } = useServerList<SubmissionRecord>({
    requestKey: listRequestKey,
    enabled: Boolean(user),
    errorMessage: 'Unable to load submissions.',
    fetcher: () =>
      fetchAdminSubmissions(activeSchool.id, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.debouncedSearch || undefined,
        sort: query.sort,
        dir: query.dir,
        type: (query.filters.type || undefined) as SubmissionType | undefined,
        status: (query.filters.status || undefined) as SubmissionStatus | undefined
      }).then((payload) => ({ items: payload.submissions, total: payload.total }))
  });

  if (!user) {
    return null;
  }

  const openDetail = (submission: SubmissionRecord) => {
    setDetailTarget(submission);
    setDetailStatus(submission.status);
    setDetailNotes(submission.notes ?? '');
    setDetailError(null);
  };

  const closeDetail = () => {
    if (detailSaving) return;
    setDetailTarget(null);
    setDetailError(null);
  };

  const handleDetailSave = async () => {
    if (!detailTarget) return;
    setDetailSaving(true);
    setDetailError(null);
    try {
      const updated = await updateAdminSubmission(activeSchool.id, detailTarget.id, {
        status: detailStatus,
        notes: normalize(detailNotes)
      });
      setNotice(`Updated ${updated.firstName} ${updated.lastName}'s submission.`);
      setReloadToken((token) => token + 1);
      setDetailTarget(null);
    } catch (saveError) {
      setDetailError(saveError instanceof Error ? saveError.message : 'Unable to update this submission.');
    } finally {
      setDetailSaving(false);
    }
  };

  const isManualFormDirty = () => JSON.stringify(manualForm) !== JSON.stringify(emptyManualForm);

  const openManualForm = () => {
    setManualForm(emptyManualForm);
    setManualError(null);
    setManualOpen(true);
  };

  const requestCloseManualForm = () => {
    if (manualSaving) return;
    if (isManualFormDirty()) {
      setManualDiscardConfirmOpen(true);
      return;
    }
    setManualOpen(false);
    setManualError(null);
  };

  const discardManualForm = () => {
    setManualDiscardConfirmOpen(false);
    setManualOpen(false);
    setManualForm(emptyManualForm);
    setManualError(null);
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualSaving(true);
    setManualError(null);
    try {
      const created = await createAdminSubmission(activeSchool.id, {
        type: manualForm.type,
        firstName: manualForm.firstName.trim(),
        lastName: manualForm.lastName.trim(),
        email: manualForm.email.trim(),
        phone: normalize(manualForm.phone),
        addressLine1: normalize(manualForm.addressLine1),
        addressLine2: normalize(manualForm.addressLine2),
        barangay: normalize(manualForm.barangay),
        city: normalize(manualForm.city),
        province: normalize(manualForm.province),
        zipCode: normalize(manualForm.zipCode),
        gradeLevelApplying: manualForm.type === 'ENROLLMENT' ? normalize(manualForm.gradeLevelApplying) : null,
        guardianName: manualForm.type === 'ENROLLMENT' ? normalize(manualForm.guardianName) : null,
        message: normalize(manualForm.message)
      });
      setNotice(`Recorded a ${typeLabels[created.type].toLowerCase()} submission for ${created.firstName} ${created.lastName}.`);
      setReloadToken((token) => token + 1);
      setManualOpen(false);
      setManualForm(emptyManualForm);
    } catch (createError) {
      setManualError(createError instanceof Error ? createError.message : 'Unable to record this submission.');
    } finally {
      setManualSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const payload = await fetchAdminSubmissions(activeSchool.id, {
        page: 1,
        pageSize: EXPORT_PAGE_SIZE_CAP,
        search: query.debouncedSearch || undefined,
        sort: query.sort,
        dir: query.dir,
        type: (query.filters.type || undefined) as SubmissionType | undefined,
        status: (query.filters.status || undefined) as SubmissionStatus | undefined
      });
      downloadCsvColumns(
        `${activeSchool.slug}-submissions-${new Date().toISOString().slice(0, 10)}.csv`,
        submissionExportColumns,
        selectedExportColumns,
        payload.submissions
      );
      setNotice(
        payload.total > EXPORT_PAGE_SIZE_CAP
          ? `Exported the first ${payload.submissions.length} of ${payload.total} matching submissions. Narrow the filters to export the rest.`
          : `Exported ${payload.submissions.length} matching submission${payload.submissions.length === 1 ? '' : 's'}.`
      );
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export submissions.');
    } finally {
      setExporting(false);
    }
  };

  const rowColumnCount = 6;

  return (
    <section className="admin-shell">
      <div className="section-heading">
        <div>
          <p className="panel-label">School directory</p>
          <h2>Enrollment &amp; inquiries</h2>
          <p className="section-copy">
            Review public enrollment applications and inquiries submitted for this school, and record ones
            taken over phone or in person.
          </p>
        </div>
      </div>

      {error ? <InlineAlert tone="error" message={error} /> : notice ? <InlineAlert message={notice} /> : null}

      <article className="preview-panel">
        <div className="admin-form__header">
          <div>
            <p className="panel-label">Submissions</p>
            <h3>Applications and inquiries</h3>
          </div>
          {canEdit ? (
            <button className="secondary-button" type="button" onClick={openManualForm}>
              <Plus size={16} aria-hidden="true" />
              New submission
            </button>
          ) : (
            <span className="status-pill status-pill--muted">Read-only</span>
          )}
        </div>

        <ListToolbar
          activeFilterCount={query.activeFilterCount}
          exportColumns={submissionExportColumns}
          exportDisabled={listStatus === 'loading' || exporting}
          onClear={query.clear}
          onExport={() => void handleExport()}
          onExportColumnsChange={setSelectedExportColumns}
          onSearchChange={query.setSearch}
          resultCount={total}
          resultLabel={total === 1 ? 'submission' : 'submissions'}
          search={query.search}
          searchLabel="Search name or email"
          selectedExportColumns={selectedExportColumns}
        >
          <label className="compact-field">
            <span>Type</span>
            <select value={query.filters.type} onChange={(event) => query.setFilter('type', event.target.value)}>
              <option value="">All types</option>
              {submissionTypes.map((type) => (
                <option key={type} value={type}>{typeLabels[type]}</option>
              ))}
            </select>
          </label>
          <label className="compact-field">
            <span>Status</span>
            <select value={query.filters.status} onChange={(event) => query.setFilter('status', event.target.value)}>
              <option value="">Any status</option>
              {submissionStatuses.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
          </label>
        </ListToolbar>

        <div className="table-wrap">
          <table className="attendance-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Source</th>
                <th scope="col">Contact</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {listStatus === 'loading' ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`submission-skeleton-${index}`}>
                    <td colSpan={rowColumnCount}>
                      <div className="table-skeleton" />
                    </td>
                  </tr>
                ))
              ) : listStatus === 'error' ? (
                <tr>
                  <td colSpan={rowColumnCount}>
                    <div className="empty-state empty-state--error" role="alert">
                      <h3>Unable to load submissions</h3>
                      <p>{listError ?? 'Try again in a moment.'}</p>
                    </div>
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={rowColumnCount}>
                    <div className="empty-state">
                      <h3>{query.activeFilterCount > 0 ? 'No matching submissions' : 'No submissions yet'}</h3>
                      <p>
                        {query.activeFilterCount > 0
                          ? 'Adjust or clear the filters to broaden the list.'
                          : 'Public enrollment and inquiry forms will appear here once submitted.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td data-label="Name">
                      <button className="text-button" type="button" onClick={() => openDetail(submission)}>
                        {submission.firstName} {submission.lastName}
                      </button>
                    </td>
                    <td data-label="Type">
                      <span className="status-pill status-pill--muted">{typeLabels[submission.type]}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`status-pill ${statusPillClass[submission.status]}`}>
                        {statusLabels[submission.status]}
                      </span>
                    </td>
                    <td data-label="Source">{submission.source === 'PUBLIC' ? 'Public form' : 'Manual'}</td>
                    <td data-label="Contact">
                      <div>
                        <strong>{submission.email}</strong>
                        {submission.phone ? <p>{submission.phone}</p> : null}
                      </div>
                    </td>
                    <td data-label="Submitted">{formatTimestamp(submission.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {listStatus === 'ready' ? (
          <Pagination itemLabel="submissions" onPageChange={query.setPage} page={query.page} pageSize={query.pageSize} totalItems={total} />
        ) : null}
      </article>

      <Modal
        description="Full submission details for this record."
        onClose={closeDetail}
        open={detailTarget !== null}
        title={detailTarget ? `${detailTarget.firstName} ${detailTarget.lastName}` : 'Submission'}
      >
        {detailTarget ? (
          <div className="admin-form modal-form">
            <dl className="detail-list">
              <div>
                <dt>Type</dt>
                <dd>{typeLabels[detailTarget.type]}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{detailTarget.source === 'PUBLIC' ? 'Public form' : 'Manual entry'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{detailTarget.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{detailTarget.phone ?? '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{formatAddress(detailTarget) || '—'}</dd>
              </div>
              {detailTarget.type === 'ENROLLMENT' ? (
                <>
                  <div>
                    <dt>Grade level applying</dt>
                    <dd>{detailTarget.gradeLevelApplying ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Guardian name</dt>
                    <dd>{detailTarget.guardianName ?? '—'}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Message</dt>
                <dd>{detailTarget.message ?? '—'}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{formatTimestamp(detailTarget.createdAt)}</dd>
              </div>
            </dl>

            {detailError ? <InlineAlert tone="error" message={detailError} /> : null}

            <label className="field">
              <span>Status</span>
              <select
                value={detailStatus}
                disabled={!canEdit}
                onChange={(event) => setDetailStatus(event.target.value as SubmissionStatus)}
              >
                {submissionStatuses.map((status) => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Internal notes</span>
              <textarea
                rows={3}
                value={detailNotes}
                disabled={!canEdit}
                onChange={(event) => setDetailNotes(event.target.value)}
                placeholder="Notes visible only to school staff."
              />
            </label>

            {canEdit ? (
              <div className="form-actions">
                <button className="primary-button" type="button" disabled={detailSaving} onClick={() => void handleDetailSave()}>
                  {detailSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button className="secondary-button" type="button" onClick={closeDetail} disabled={detailSaving}>
                  Close
                </button>
              </div>
            ) : (
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={closeDetail}>
                  Close
                </button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        description="Record a submission received by phone, email, or in person."
        onClose={requestCloseManualForm}
        open={manualOpen}
        title="New submission"
      >
        <form className="admin-form modal-form" onSubmit={handleManualSubmit}>
          <label className="field">
            <span>Submission type</span>
            <select
              value={manualForm.type}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, type: event.target.value as SubmissionType }))
              }
            >
              {submissionTypes.map((type) => (
                <option key={type} value={type}>{typeLabels[type]}</option>
              ))}
            </select>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>First name</span>
              <input
                type="text"
                value={manualForm.firstName}
                onChange={(event) => setManualForm((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Last name</span>
              <input
                type="text"
                value={manualForm.lastName}
                onChange={(event) => setManualForm((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={manualForm.email}
                onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                type="tel"
                value={manualForm.phone}
                onChange={(event) => setManualForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Address line 1</span>
              <input
                type="text"
                value={manualForm.addressLine1}
                onChange={(event) => setManualForm((current) => ({ ...current, addressLine1: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Address line 2</span>
              <input
                type="text"
                value={manualForm.addressLine2}
                onChange={(event) => setManualForm((current) => ({ ...current, addressLine2: event.target.value }))}
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Barangay</span>
              <input
                type="text"
                value={manualForm.barangay}
                onChange={(event) => setManualForm((current) => ({ ...current, barangay: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>City</span>
              <input
                type="text"
                value={manualForm.city}
                onChange={(event) => setManualForm((current) => ({ ...current, city: event.target.value }))}
              />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Province</span>
              <input
                type="text"
                value={manualForm.province}
                onChange={(event) => setManualForm((current) => ({ ...current, province: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>ZIP code</span>
              <input
                type="text"
                value={manualForm.zipCode}
                onChange={(event) => setManualForm((current) => ({ ...current, zipCode: event.target.value }))}
                inputMode="numeric"
              />
            </label>
          </div>

          {manualForm.type === 'ENROLLMENT' ? (
            <div className="field-grid">
              <label className="field">
                <span>Grade level applying</span>
                <input
                  type="text"
                  value={manualForm.gradeLevelApplying}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, gradeLevelApplying: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Guardian name</span>
                <input
                  type="text"
                  value={manualForm.guardianName}
                  onChange={(event) => setManualForm((current) => ({ ...current, guardianName: event.target.value }))}
                />
              </label>
            </div>
          ) : null}

          <label className="field">
            <span>Message{manualForm.type === 'INQUIRY' ? '' : ' (optional)'}</span>
            <textarea
              rows={3}
              value={manualForm.message}
              onChange={(event) => setManualForm((current) => ({ ...current, message: event.target.value }))}
              required={manualForm.type === 'INQUIRY'}
            />
          </label>

          {manualError ? <InlineAlert tone="error" message={manualError} /> : null}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={manualSaving}>
              {manualSaving ? 'Saving…' : 'Record submission'}
            </button>
            <button className="secondary-button" type="button" onClick={requestCloseManualForm} disabled={manualSaving}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={manualDiscardConfirmOpen}
        title="Discard unsaved changes?"
        description="Closing now will lose the details entered for this submission."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={discardManualForm}
        onCancel={() => setManualDiscardConfirmOpen(false)}
      />
    </section>
  );
};
