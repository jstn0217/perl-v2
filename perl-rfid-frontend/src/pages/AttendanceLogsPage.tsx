import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { exportAttendanceLogs, fetchAttendanceLogs } from '../lib/api';
import { useTenantContext } from '../providers/TenantContext';
import { useAuth } from '../providers/auth-context';
import type { AttendanceFilters, AttendanceLogListItem } from '../types/attendance';

const PAGE_SIZE = 10;
const attendanceExportColumns = [
  { key: 'scannedAt', label: 'Scanned at' },
  { key: 'student', label: 'Person' },
  { key: 'role', label: 'Role' },
  { key: 'gradeLevel', label: 'Grade level' },
  { key: 'section', label: 'Section' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'direction', label: 'Direction' },
  { key: 'device', label: 'Device' },
  { key: 'location', label: 'Location' },
  { key: 'message', label: 'Message' }
];
const defaultAttendanceExportColumns = attendanceExportColumns.map((column) => column.key);
const emptyFilters: AttendanceFilters = {
  search: '',
  verdict: '',
  direction: '',
  from: '',
  to: ''
};

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

const verdictCopy = {
  ADMITTED: 'Admitted',
  DENIED: 'Denied'
} as const;

const StudentName = ({ record }: { record: AttendanceLogListItem }) => {
  if (!record.student) {
    return (
      <div>
        <strong>Unknown card</strong>
        <p>No active card holder matched this scan.</p>
      </div>
    );
  }

  return (
    <div>
      <strong>
        {record.student.firstName} {record.student.lastName}
      </strong>
      <p>
        {record.student.role === 'STUDENT'
          ? `${record.student.gradeLevel || 'Unassigned grade'}${
              record.student.section ? ` • ${record.student.section}` : ''
            }`
          : record.student.role}
      </p>
    </div>
  );
};

export const AttendanceLogsPage = () => {
  const { activeSchool } = useTenantContext();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AttendanceFilters>(emptyFilters);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState(
    defaultAttendanceExportColumns
  );
  const deferredSearch = useDeferredValue(filters.search);
  const apiFilters = useMemo<AttendanceFilters>(() => ({
    ...filters,
    search: deferredSearch,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : '',
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : ''
  }), [deferredSearch, filters]);
  const filterKey = JSON.stringify(apiFilters);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const [logState, setLogState] = useState<{
    requestKey: string;
    page: number;
    records: AttendanceLogListItem[];
    total: number;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    requestKey: string;
    page: number;
    message: string;
  } | null>(null);
  const requestKey = `${activeSchool.slug}:${filterKey}`;
  const activePage = logState?.requestKey === requestKey ? page : 1;

  useEffect(() => {
    let cancelled = false;

    void fetchAttendanceLogs({
      schoolSlug: activeSchool.slug,
      page: activePage,
      pageSize: PAGE_SIZE,
      filters: apiFilters
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLogState({
            requestKey,
            page: activePage,
            records: payload.records,
            total: payload.total
          });
          setErrorState(null);
        });
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setErrorState({
            requestKey,
            page: activePage,
            message: loadError instanceof Error ? loadError.message : 'Unable to load attendance logs.'
          });
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activePage, activeSchool.slug, apiFilters, requestKey]);

  const records =
    logState?.requestKey === requestKey && logState.page === activePage ? logState.records : [];
  const total =
    logState?.requestKey === requestKey && logState.page === activePage ? logState.total : 0;
  const status =
    errorState?.requestKey === requestKey && errorState.page === activePage
      ? 'error'
      : logState?.requestKey === requestKey && logState.page === activePage
        ? 'ready'
        : 'loading';
  const error =
    errorState?.requestKey === requestKey && errorState.page === activePage
      ? errorState.message
      : null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const updateFilter = <Key extends keyof AttendanceFilters>(
    key: Key,
    value: AttendanceFilters[Key]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setExportError(null);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportAttendanceLogs(activeSchool.slug, apiFilters, selectedExportColumns);
    } catch (exportFailure) {
      setExportError(
        exportFailure instanceof Error ? exportFailure.message : 'Unable to export attendance records.'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="log-shell">
      <article className="preview-panel">
        <div className="section-heading">
          <div>
            <p className="panel-label">
              {user?.role === 'STUDENT'
                ? 'My attendance'
                : user?.role === 'GUARDIAN'
                  ? 'Linked student attendance'
                  : 'Attendance records'}
            </p>
            <h2>
              {user?.role === 'STUDENT'
                ? 'Your attendance history'
                : user?.role === 'GUARDIAN'
                  ? 'Attendance for your linked students'
                  : `Attendance log for ${activeSchool.name}`}
            </h2>
          </div>
          <div className="log-shell__meta">
            <span>{total} total records</span>
            <span>Page {activePage} of {totalPages}</span>
          </div>
        </div>

        <ListToolbar
          activeFilterCount={activeFilterCount}
          exportColumns={attendanceExportColumns}
          exportDisabled={status === 'loading' || exporting}
          onClear={() => {
            setFilters(emptyFilters);
            setPage(1);
            setExportError(null);
          }}
          onExport={() => void handleExport()}
          onExportColumnsChange={setSelectedExportColumns}
          onSearchChange={(value) => updateFilter('search', value)}
          resultCount={total}
          resultLabel={total === 1 ? 'attendance record' : 'attendance records'}
          search={filters.search}
          searchLabel="Search person, device, or message"
          selectedExportColumns={selectedExportColumns}
        >
          <label className="compact-field">
            <span>Result</span>
            <select
              value={filters.verdict}
              onChange={(event) =>
                updateFilter('verdict', event.target.value as AttendanceFilters['verdict'])
              }
            >
              <option value="">All results</option>
              <option value="ADMITTED">Admitted</option>
              <option value="DENIED">Denied</option>
            </select>
          </label>
          <label className="compact-field">
            <span>Direction</span>
            <select
              value={filters.direction}
              onChange={(event) =>
                updateFilter('direction', event.target.value as AttendanceFilters['direction'])
              }
            >
              <option value="">In and out</option>
              <option value="IN">Entry</option>
              <option value="OUT">Exit</option>
            </select>
          </label>
          <label className="compact-field">
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
          </label>
          <label className="compact-field">
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </label>
        </ListToolbar>

        {exportError ? (
          <div className="form-message form-message--error" role="alert">{exportError}</div>
        ) : null}

        {status === 'error' ? (
          <div className="empty-state empty-state--error" role="alert">
            <h3>Unable to load the log</h3>
            <p>{error ?? 'Try again in a moment.'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Result</th>
                    <th scope="col">Device</th>
                    <th scope="col">Message</th>
                    <th scope="col">Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {status === 'loading' ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={`skeleton-${index}`}>
                        <td colSpan={5}>
                          <div className="table-skeleton" />
                        </td>
                      </tr>
                    ))
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <h3>{activeFilterCount > 0 ? 'No matching records' : 'No records yet'}</h3>
                          <p>
                            {activeFilterCount > 0
                              ? 'Adjust or clear the filters to broaden the attendance results.'
                              : 'A connected device will populate this log.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.log.id}>
                        <td data-label="Person">
                          <StudentName record={record} />
                        </td>
                        <td data-label="Result">
                          <div className="result-cell">
                            <span className={`status-pill status-pill--${record.log.verdict.toLowerCase()}`}>
                              {verdictCopy[record.log.verdict]}
                            </span>
                            <span className={`status-pill status-pill--direction-${record.log.direction.toLowerCase()}`}>
                              {record.log.direction}
                            </span>
                          </div>
                        </td>
                        <td data-label="Device">
                          <div>
                            <strong>{record.device?.name ?? 'Unknown device'}</strong>
                            <p>{record.device?.location ?? 'No location'}</p>
                          </div>
                        </td>
                        <td className="message-cell" data-label="Message">{record.log.message}</td>
                        <td data-label="Scanned">{formatTimestamp(record.log.scannedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {status === 'ready' ? (
              <Pagination
                itemLabel="records"
                onPageChange={setPage}
                page={activePage}
                pageSize={PAGE_SIZE}
                totalItems={total}
              />
            ) : null}
          </>
        )}
      </article>
    </section>
  );
};
