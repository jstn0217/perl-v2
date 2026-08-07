import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { exportNotificationLogs, fetchNotificationLogs } from '../lib/api';
import { useTenantContext } from '../providers/TenantContext';
import type { NotificationFilters, NotificationPage } from '../types/admin';

const PAGE_SIZE = 20;
const exportColumns = [
  { key: 'createdAt', label: 'Created at' },
  { key: 'status', label: 'Status' },
  { key: 'direction', label: 'Direction' },
  { key: 'recipient', label: 'Recipient' },
  { key: 'message', label: 'Message' },
  { key: 'provider', label: 'Provider' },
  { key: 'providerStatus', label: 'Provider status' },
  { key: 'providerMessageId', label: 'Provider message ID' },
  { key: 'network', label: 'Network' },
  { key: 'errorMessage', label: 'Error' },
  { key: 'attendanceLogId', label: 'Attendance log ID' },
  { key: 'studentUserId', label: 'Student user ID' },
  { key: 'guardianUserId', label: 'Guardian user ID' }
];
const emptyFilters: NotificationFilters = {
  search: '',
  status: '',
  direction: '',
  from: '',
  to: ''
};

export const NotificationLogsPage = () => {
  const { activeSchool } = useTenantContext();
  const [filters, setFilters] = useState(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search);
  const apiFilters = useMemo(() => ({
    ...filters,
    search: deferredSearch,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : '',
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : ''
  }), [deferredSearch, filters]);
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<NotificationPage | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState(exportColumns.map(({ key }) => key));
  const requestKey = `${activeSchool.id}:${page}:${JSON.stringify(apiFilters)}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    void fetchNotificationLogs(activeSchool.id, page, PAGE_SIZE, apiFilters)
      .then((result) => {
        if (!cancelled) {
          setPayload(result);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Unable to load SMS logs.');
          setLoadedKey(requestKey);
        }
      });
    return () => { cancelled = true; };
  }, [activeSchool.id, apiFilters, page, requestKey]);

  const update = <K extends keyof NotificationFilters>(key: K, value: NotificationFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <section className="log-shell">
      <header className="section-heading">
        <div>
          <p className="panel-label">Notification operations</p>
          <h2>SMS delivery history</h2>
          <p className="section-copy">
            Trace each student attendance message from queueing through Semaphore delivery.
          </p>
        </div>
      </header>

      <ListToolbar
        activeFilterCount={activeFilterCount}
        exportColumns={exportColumns}
        exportDisabled={loading}
        onClear={() => { setFilters(emptyFilters); setPage(1); }}
        onExport={() => void exportNotificationLogs(activeSchool.id, apiFilters, selectedColumns)}
        onExportColumnsChange={setSelectedColumns}
        onSearchChange={(value) => update('search', value)}
        resultCount={payload?.total ?? 0}
        resultLabel={(payload?.total ?? 0) === 1 ? 'transaction' : 'transactions'}
        search={filters.search}
        searchLabel="Search recipient, message, provider ID, or error"
        selectedExportColumns={selectedColumns}
      >
        <label className="compact-field">
          <span>Status</span>
          <select value={filters.status} onChange={(event) => update('status', event.target.value as NotificationFilters['status'])}>
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </label>
        <label className="compact-field">
          <span>Direction</span>
          <select value={filters.direction} onChange={(event) => update('direction', event.target.value as NotificationFilters['direction'])}>
            <option value="">In and out</option>
            <option value="IN">Logged in</option>
            <option value="OUT">Logged out</option>
          </select>
        </label>
        <label className="compact-field">
          <span>From</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} />
        </label>
        <label className="compact-field">
          <span>To</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} />
        </label>
      </ListToolbar>

      {error ? <div className="form-message form-message--error" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>When</th><th>Status</th><th>Recipient</th><th>Movement</th>
              <th>Provider result</th><th>Message / issue</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="table-skeleton" /></td></tr>
            ) : payload?.records.length ? payload.records.map((record) => (
              <tr key={record.id}>
                <td data-label="When">{new Date(record.createdAt).toLocaleString()}</td>
                <td data-label="Status"><span className="status-pill">{record.status}</span></td>
                <td data-label="Recipient">{record.recipient ?? 'Not available'}</td>
                <td data-label="Movement">{record.direction === 'IN' ? 'Logged in' : 'Logged out'}</td>
                <td data-label="Provider result">
                  <strong>{record.provider}</strong>
                  <p>{record.providerStatus ?? record.providerMessageId ?? '—'}</p>
                </td>
                <td className="message-cell" data-label="Message / issue">
                  {record.errorMessage ? <strong>{record.errorMessage}</strong> : record.message}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6}><div className="empty-state"><h3>No SMS transactions</h3><p>Student attendance notifications will appear here.</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && payload ? (
        <Pagination itemLabel="transactions" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} totalItems={payload.total} />
      ) : null}
    </section>
  );
};
