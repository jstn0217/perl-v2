import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineAlert } from '../components/InlineAlert';
import { Modal } from '../components/Modal';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { useListQueryState } from '../hooks/useListQueryState';
import {
  createAdminDevice,
  deactivateAdminDevice,
  fetchAdminDevices,
  rotateAdminDeviceKey
} from '../lib/api';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import type { ManagedDevice, RegisteredDeviceResponse } from '../types/admin';
import { downloadCsvColumns, type CsvColumn } from '../lib/csv';
import { canManageSchool } from '../lib/permissions';

type DeviceFormState = {
  name: string;
  location: string;
};

const DEVICE_PAGE_SIZE = 6;
const EXPORT_ROW_CAP = 100;
const emptyDeviceFilters = {
  status: ''
};
const deviceExportColumns: CsvColumn<ManagedDevice>[] = [
  { key: 'name', label: 'Device name', value: (device) => device.name },
  { key: 'location', label: 'Location', value: (device) => device.location },
  { key: 'id', label: 'Device ID', value: (device) => device.id },
  {
    key: 'status',
    label: 'Status',
    value: (device) => (device.isActive ? 'Active' : 'Inactive')
  },
  { key: 'keyLastFour', label: 'Key last four', value: (device) => device.keyLastFour }
];
const defaultDeviceExportColumns = deviceExportColumns.map((column) => column.key);

const createEmptyForm = (): DeviceFormState => ({
  name: '',
  location: ''
});

export const DeviceManagementPage = () => {
  const { user } = useAuth();
  const { activeSchool } = useTenantContext();
  const canEdit = canManageSchool(user?.role);
  const query = useListQueryState({
    pageSize: DEVICE_PAGE_SIZE,
    defaultSort: 'name',
    defaultFilters: emptyDeviceFilters
  });

  const [listState, setListState] = useState<{
    requestKey: string;
    devices: ManagedDevice[];
    total: number;
  } | null>(null);
  const [listErrorState, setListErrorState] = useState<{ requestKey: string; message: string } | null>(
    null
  );
  const [reloadToken, setReloadToken] = useState(0);

  const [formState, setFormState] = useState<DeviceFormState>(createEmptyForm);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issuedDevice, setIssuedDevice] = useState<RegisteredDeviceResponse | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const initialFormStateRef = useRef<DeviceFormState>(createEmptyForm());
  const [deviceAction, setDeviceAction] = useState<{
    deviceId: string;
    type: 'rotate' | 'deactivate';
  } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ManagedDevice | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ManagedDevice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState(defaultDeviceExportColumns);

  const listRequestKey = [
    activeSchool.id,
    query.page,
    query.pageSize,
    query.debouncedSearch,
    query.sort,
    query.dir,
    query.filters.status,
    reloadToken
  ].join('|');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void fetchAdminDevices(activeSchool.id, {
      page: query.page,
      pageSize: query.pageSize,
      search: query.debouncedSearch || undefined,
      sort: query.sort,
      dir: query.dir,
      status: (query.filters.status || undefined) as 'active' | 'inactive' | undefined
    })
      .then((payload) => {
        if (cancelled) return;
        setListState({ requestKey: listRequestKey, devices: payload.devices, total: payload.total });
        setListErrorState(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setListErrorState({
          requestKey: listRequestKey,
          message: loadError instanceof Error ? loadError.message : 'Unable to load school devices.'
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRequestKey, user]);

  const devices = useMemo(
    () => (listState?.requestKey === listRequestKey ? listState.devices : []),
    [listRequestKey, listState]
  );
  // Keep the last known total visible while a refetch is in flight so the toolbar's
  // aria-live result count doesn't announce a misleading "0 devices" mid-search.
  const total = listState?.total ?? 0;
  const listStatus: 'loading' | 'ready' | 'error' =
    listErrorState?.requestKey === listRequestKey
      ? 'error'
      : listState?.requestKey === listRequestKey
        ? 'ready'
        : 'loading';
  const listError = listErrorState?.requestKey === listRequestKey ? listErrorState.message : null;

  const counts = useMemo(
    () => ({
      active: devices.filter((device) => device.isActive).length
    }),
    [devices]
  );

  if (!user) {
    return null;
  }

  const isFormDirty = () => JSON.stringify(formState) !== JSON.stringify(initialFormStateRef.current);

  const closeRegistration = () => {
    setRegistrationOpen(false);
    setError(null);
    setDiscardConfirmOpen(false);
  };

  const requestCloseRegistration = () => {
    if (isFormDirty()) {
      setDiscardConfirmOpen(true);
      return;
    }
    closeRegistration();
  };

  const openRegistration = () => {
    const initial = createEmptyForm();
    setFormState(initial);
    initialFormStateRef.current = initial;
    setError(null);
    setNotice(null);
    setRegistrationOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveStatus('saving');
    setError(null);
    setNotice(null);

    try {
      const result = await createAdminDevice(activeSchool.id, {
        name: formState.name,
        location: formState.location
      });

      setIssuedDevice(result);
      setNotice(`${result.device.name} is now registered for ${result.device.location}.`);
      setFormState(createEmptyForm());
      setReloadToken((token) => token + 1);
      closeRegistration();
      setSaveStatus('idle');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to register this device.');
      setSaveStatus('idle');
    }
  };

  const handleRotateKey = async (device: ManagedDevice) => {
    setDeviceAction({ deviceId: device.id, type: 'rotate' });
    setError(null);
    setNotice(null);

    try {
      const result = await rotateAdminDeviceKey(activeSchool.id, device.id);
      setIssuedDevice(result);
      setNotice(`${result.device.name}'s previous key is revoked. Save the replacement key now.`);
      setReloadToken((token) => token + 1);
    } catch (rotateError) {
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : 'Unable to rotate this key. The existing key remains unchanged.'
      );
    } finally {
      setDeviceAction(null);
      setRotateTarget(null);
    }
  };

  const handleDeactivate = async (device: ManagedDevice) => {
    setDeviceAction({ deviceId: device.id, type: 'deactivate' });
    setError(null);
    setNotice(null);

    try {
      const updatedDevice = await deactivateAdminDevice(activeSchool.id, device.id);
      if (issuedDevice?.device.id === device.id) setIssuedDevice(null);
      setNotice(`${updatedDevice.name} is inactive. Its last issued key is now rejected.`);
      setReloadToken((token) => token + 1);
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'Unable to deactivate this device. Try again before removing it from service.'
      );
    } finally {
      setDeviceAction(null);
      setDeactivateTarget(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const payload = await fetchAdminDevices(activeSchool.id, {
        page: 1,
        pageSize: EXPORT_ROW_CAP,
        search: query.debouncedSearch || undefined,
        sort: query.sort,
        dir: query.dir,
        status: (query.filters.status || undefined) as 'active' | 'inactive' | undefined
      });
      downloadCsvColumns(
        `${activeSchool.slug}-devices-${new Date().toISOString().slice(0, 10)}.csv`,
        deviceExportColumns,
        selectedExportColumns,
        payload.devices
      );
      if (payload.total > payload.devices.length) {
        setNotice(
          `Exported the first ${payload.devices.length} of ${payload.total} matching devices (export is capped at ${EXPORT_ROW_CAP} rows).`
        );
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export devices.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="admin-shell">
      <div className="section-heading">
        <div>
          <p className="panel-label">Hardware access</p>
          <h2>Devices</h2>
          <p className="section-copy">
            Register school-scoped scanners, keep the active roster visible, and hand off each issued key once.
          </p>
        </div>
      </div>

      <div className="stats-row stats-row--admin">
        <article className="preview-panel stat-panel">
          <p className="panel-label">Matching devices</p>
          <strong>{total}</strong>
          <p>{counts.active} active on this page, across the current search and filters.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Issued key policy</p>
          <strong>One-time reveal</strong>
          <p>Only the newly created key is shown in full. Stored records keep the last four digits only.</p>
        </article>
        <article className="preview-panel stat-panel">
          <p className="panel-label">Scan auth</p>
          <strong><code>X-Device-Key</code></strong>
          <p>Use the returned key in the header when a device posts scans to the attendance API.</p>
        </article>
      </div>

      <div>
        <article className="preview-panel">
          <div className="admin-form__header">
            <div>
              <p className="panel-label">Device roster</p>
              <h3>Registered scanners</h3>
            </div>
            <div className="table-actions">
              <span className="status-pill status-pill--muted">{counts.active} active on page</span>
              {canEdit ? <button className="secondary-button" type="button" onClick={openRegistration}>
                Register scanner
              </button> : (
                <span className="status-pill status-pill--muted">Read-only support view</span>
              )}
            </div>
          </div>

          {error && !registrationOpen ? (
            <InlineAlert tone="error" message={error} />
          ) : notice ? (
            <InlineAlert message={notice} />
          ) : (
            <InlineAlert message="The roster below is the durable view after provisioning. Full device keys are never reloaded from storage." />
          )}

          <ListToolbar
            activeFilterCount={query.activeFilterCount}
            exportColumns={deviceExportColumns}
            exportDisabled={listStatus === 'loading' || exporting}
            onClear={query.clear}
            onExport={() => void handleExport()}
            onExportColumnsChange={setSelectedExportColumns}
            onSearchChange={query.setSearch}
            resultCount={total}
            resultLabel={total === 1 ? 'device' : 'devices'}
            search={query.search}
            searchLabel="Search device, location, ID, or key suffix"
            selectedExportColumns={selectedExportColumns}
          >
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

          {issuedDevice ? (
            <div className="device-key-banner" role="status" aria-live="polite">
              <div>
                <p className="panel-label">Issued just now</p>
                <h4>{issuedDevice.device.name}</h4>
                <p>
                  Save this key before leaving the page. Future views will only show the last four digits.
                </p>
              </div>
              <code>{issuedDevice.deviceKey}</code>
            </div>
          ) : null}

          <div className="device-list">
            {listStatus === 'loading' ? (
              Array.from({ length: 4 }).map((_, index) => <div className="table-skeleton" key={`device-skeleton-${index}`} />)
            ) : listStatus === 'error' ? (
              <div className="empty-state empty-state--error" role="alert">
                <h3>Unable to load the device roster</h3>
                <p>{listError ?? 'Try again in a moment.'}</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="empty-state">
                <h3>{query.activeFilterCount > 0 ? 'No matching devices' : 'No devices registered yet'}</h3>
                <p>
                  {query.activeFilterCount > 0
                    ? 'Adjust or clear the filters to broaden the scanner roster.'
                    : 'Create the first scanner profile from the registration form on this page.'}
                </p>
              </div>
            ) : (
              devices.map((device) => (
                <article className="device-card" key={device.id}>
                  <div className="device-card__header">
                    <div>
                      <h4>{device.name}</h4>
                      <p>{device.location}</p>
                    </div>
                    <span className={`status-pill ${device.isActive ? 'status-pill--admitted' : 'status-pill--denied'}`}>
                      {device.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <dl className="device-card__meta">
                    <div>
                      <dt>Device ID</dt>
                      <dd>{device.id}</dd>
                    </div>
                    <div>
                      <dt>Saved key</dt>
                      <dd>•••• {device.keyLastFour}</dd>
                    </div>
                  </dl>
                  {device.isActive && canEdit ? (
                    <div className="device-card__actions" aria-label={`Security actions for ${device.name}`}>
                      <button
                        className="secondary-button secondary-button--compact"
                        type="button"
                        disabled={deviceAction !== null}
                        onClick={() => setRotateTarget(device)}
                      >
                        {deviceAction?.deviceId === device.id && deviceAction.type === 'rotate'
                          ? 'Rotating key…'
                          : 'Rotate key'}
                      </button>
                      <button
                        className="secondary-button secondary-button--danger secondary-button--compact"
                        type="button"
                        disabled={deviceAction !== null}
                        onClick={() => setDeactivateTarget(device)}
                      >
                        {deviceAction?.deviceId === device.id && deviceAction.type === 'deactivate'
                          ? 'Deactivating…'
                          : 'Deactivate'}
                      </button>
                    </div>
                  ) : !device.isActive ? (
                    <p className="device-card__inactive-note">Key revoked. Register a new device to restore service.</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
          {listStatus === 'ready' ? (
            <Pagination
              itemLabel="devices"
              onPageChange={query.setPage}
              page={query.page}
              pageSize={query.pageSize}
              totalItems={total}
            />
          ) : null}
        </article>
      </div>

      <Modal
        description="The device key is revealed once after registration."
        onClose={requestCloseRegistration}
        open={registrationOpen}
        title="Register a new scanner"
      >
        <form className="admin-form modal-form" onSubmit={handleSubmit}>
          {error ? (
            <div className="form-message form-message--error" role="alert">
              {error}
            </div>
          ) : null}

          <label className="field">
            <span>Device name</span>
            <input
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              placeholder="North Gate Reader"
              required
            />
          </label>

          <label className="field">
            <span>Location</span>
            <input
              type="text"
              value={formState.location}
              onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
              placeholder="Building A lobby"
              required
            />
          </label>

          <div className="empty-state">
            <h3>Provisioning handoff</h3>
            <p>
              After registration, copy the one-time key into the device client or simulator and send scans using the
              <code>X-Device-Key</code> header.
            </p>
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Registering device…' : 'Register device'}
            </button>
            <button className="secondary-button" type="button" onClick={requestCloseRegistration}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        description="Closing now will lose the device name and location you entered."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={closeRegistration}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      <ConfirmDialog
        open={rotateTarget !== null}
        title={rotateTarget ? `Rotate ${rotateTarget.name}'s key?` : 'Rotate device key?'}
        description={
          issuedDevice
            ? "The currently displayed one-time key will be replaced. Its current key will stop working immediately."
            : "Its current key will stop working immediately."
        }
        confirmLabel="Rotate key"
        tone="danger"
        onConfirm={() => {
          if (rotateTarget) void handleRotateKey(rotateTarget);
        }}
        onCancel={() => setRotateTarget(null)}
      />

      <ConfirmDialog
        open={deactivateTarget !== null}
        title={deactivateTarget ? `Deactivate ${deactivateTarget.name}?` : 'Deactivate device?'}
        description="Its device key will stop working immediately and cannot be reactivated here."
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
