import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import {
  exportSchoolAuditLogs,
  exportSupportAuditLogs,
  fetchSchoolAuditLogs,
  fetchSupportAuditLogs
} from '../lib/api';
import { isPlatformSupport } from '../lib/permissions';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import type { AuditFilters, AuditPage } from '../types/admin';

const PAGE_SIZE = 20;
const auditExportColumns = [
  { key: 'occurredAt', label: 'Occurred at' },
  { key: 'schoolId', label: 'School ID' },
  { key: 'action', label: 'Action' },
  { key: 'actorUserId', label: 'Actor user ID' },
  { key: 'actorRole', label: 'Actor role' },
  { key: 'supportInitiated', label: 'Support initiated' },
  { key: 'targetType', label: 'Target type' },
  { key: 'targetId', label: 'Target ID' },
  { key: 'changeSummary', label: 'Change summary' }
];
const defaultAuditExportColumns = auditExportColumns.map((column) => column.key);
const emptyFilters: AuditFilters = {
  search: '',
  action: '',
  actorRole: '',
  supportInitiated: '',
  targetType: '',
  from: '',
  to: ''
};
const auditActions = [
  'SUPPORT_CONTEXT_ACCESSED',
  'SCHOOL_CREATED',
  'SCHOOL_PROFILE_UPDATED',
  'SCHOOL_LOGO_UPDATED',
  'USER_CREATED',
  'USERS_IMPORTED',
  'USER_UPDATED',
  'USER_IMAGE_UPDATED',
  'USER_DEACTIVATED',
  'DEVICE_REGISTERED',
  'DEVICE_KEY_ROTATED',
  'DEVICE_DEACTIVATED',
  'ATTENDANCE_EXPORTED',
  'SCHOOL_DATA_EXPORTED',
  'SCHOOL_BACKUP_CREATED',
  'USER_DATA_EXPORTED',
  'USER_DATA_ERASED',
  'SCHOOL_DATA_ERASED',
  'SCHOOL_BACKUP_RESTORED'
];

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(value));

const formatAction = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const AuditLogsPage = () => {
  const { user } = useAuth();
  const { activeSchool, schools } = useTenantContext();
  const isSupport = isPlatformSupport(user?.role);
  const [schoolFilter, setSchoolFilter] = useState(isSupport ? '' : activeSchool.id);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedExportColumns, setSelectedExportColumns] = useState(defaultAuditExportColumns);
  const deferredSearch = useDeferredValue(filters.search);
  const apiFilters = useMemo<AuditFilters>(() => ({
    ...filters,
    search: deferredSearch,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : '',
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : ''
  }), [deferredSearch, filters]);
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState<AuditPage | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const filterKey = JSON.stringify(apiFilters);
  const requestKey = `${isSupport ? 'support' : activeSchool.id}:${schoolFilter}:${filterKey}:${page}`;
  const loading = loadedKey !== requestKey;
  const error = errorState?.key === requestKey ? errorState.message : null;
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (isSupport && schoolFilter ? 1 : 0);

  useEffect(() => {
    let cancelled = false;

    const request = isSupport
      ? fetchSupportAuditLogs({
          page,
          pageSize: PAGE_SIZE,
          schoolId: schoolFilter || undefined,
          filters: apiFilters
        })
      : fetchSchoolAuditLogs(activeSchool.id, page, PAGE_SIZE, apiFilters);

    void request
      .then((payload) => {
        if (!cancelled) {
          setAuditPage(payload);
          setLoadedKey(requestKey);
          setErrorState(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setErrorState({
            key: requestKey,
            message: loadError instanceof Error ? loadError.message : 'Unable to load action logs.'
          });
          setLoadedKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, apiFilters, isSupport, page, requestKey, schoolFilter]);

  const schoolNames = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools]
  );
  const updateFilter = <Key extends keyof AuditFilters>(
    key: Key,
    value: AuditFilters[Key]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setExportError(null);
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    if (isSupport) setSchoolFilter('');
    setPage(1);
    setExportError(null);
  };
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      if (isSupport) {
        await exportSupportAuditLogs(
          schoolFilter || undefined,
          apiFilters,
          selectedExportColumns
        );
      } else {
        await exportSchoolAuditLogs(activeSchool.id, apiFilters, selectedExportColumns);
      }
    } catch (exportFailure) {
      setExportError(
        exportFailure instanceof Error ? exportFailure.message : 'Unable to export action logs.'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="log-shell">
      <header className="section-heading">
        <div>
          <p className="panel-label">{isSupport ? 'Platform monitoring' : 'School monitoring'}</p>
          <h2>{isSupport ? 'System action log' : 'School action log'}</h2>
          <p className="section-copy">
            Review who changed each school or user account, when it happened, and whether system
            support initiated it.
          </p>
        </div>

      </header>

      <ListToolbar
        activeFilterCount={activeFilterCount}
        exportColumns={auditExportColumns}
        exportDisabled={loading || exporting}
        onClear={clearFilters}
        onExport={() => void handleExport()}
        onExportColumnsChange={setSelectedExportColumns}
        onSearchChange={(value) => updateFilter('search', value)}
        resultCount={auditPage?.total ?? 0}
        resultLabel={(auditPage?.total ?? 0) === 1 ? 'action' : 'actions'}
        search={filters.search}
        searchLabel="Search actor, target, action, or change"
        selectedExportColumns={selectedExportColumns}
      >
        {isSupport ? (
          <label className="compact-field">
            <span>School</span>
            <select
              value={schoolFilter}
              onChange={(event) => {
                setSchoolFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>{school.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="compact-field">
          <span>Action</span>
          <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
            <option value="">All actions</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>{formatAction(action)}</option>
            ))}
          </select>
        </label>
        <label className="compact-field">
          <span>Actor</span>
          <select
            value={filters.actorRole}
            onChange={(event) =>
              updateFilter('actorRole', event.target.value as AuditFilters['actorRole'])
            }
          >
            <option value="">All roles</option>
            <option value="SYSTEM_ADMIN">System admin</option>
            <option value="SUPPORT">Support</option>
            <option value="ADMIN">School admin</option>
            <option value="STAFF">Staff</option>
            <option value="STUDENT">Student</option>
            <option value="GUARDIAN">Guardian</option>
          </select>
        </label>
        <label className="compact-field">
          <span>Origin</span>
          <select
            value={filters.supportInitiated}
            onChange={(event) =>
              updateFilter(
                'supportInitiated',
                event.target.value as AuditFilters['supportInitiated']
              )
            }
          >
            <option value="">Any origin</option>
            <option value="true">System support</option>
            <option value="false">School account</option>
          </select>
        </label>
        <label className="compact-field">
          <span>Target</span>
          <select
            value={filters.targetType}
            onChange={(event) =>
              updateFilter('targetType', event.target.value as AuditFilters['targetType'])
            }
          >
            <option value="">All targets</option>
            <option value="SCHOOL">School</option>
            <option value="USER">User</option>
            <option value="DEVICE">Device</option>
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

      {error ? (
        <div className="empty-state empty-state--error" role="alert">
          <h3>Action log unavailable</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="attendance-table audit-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">School</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Target</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`audit-skeleton-${index}`}>
                      <td colSpan={6}><div className="table-skeleton" /></td>
                    </tr>
                  ))
                ) : auditPage?.records.length ? (
                  auditPage.records.map((record) => (
                    <tr key={record.id}>
                      <td><time dateTime={record.occurredAt}>{formatTimestamp(record.occurredAt)}</time></td>
                      <td>{schoolNames.get(record.schoolId) ?? record.schoolId}</td>
                      <td><strong>{formatAction(record.action)}</strong></td>
                      <td>
                        <span className={`status-pill ${record.supportInitiated ? 'status-pill--direction-out' : 'status-pill--muted'}`}>
                          {record.supportInitiated ? 'System support' : record.actorRole}
                        </span>
                        <p>{record.actorUserId}</p>
                      </td>
                      <td>{record.targetId ?? record.targetType}</td>
                      <td className="message-cell">{record.changeSummary}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <h3>No actions recorded</h3>
                        <p>Changes to school settings, people, and devices will appear here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && auditPage ? (
            <Pagination
              itemLabel="actions"
              onPageChange={setPage}
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={auditPage.total}
            />
          ) : null}
        </>
      )}
    </section>
  );
};
