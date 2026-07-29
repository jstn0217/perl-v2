import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { ListToolbar } from '../components/ListToolbar';
import { Pagination } from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
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
const emptyDeviceFilters = {
  search: '',
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

const sortDevices = (devices: ManagedDevice[]) =>
  [...devices].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

export const DeviceManagementPage = () => {
  const { user } = useAuth();
  const { activeSchool } = useTenantContext();
  const canEdit = canManageSchool(user?.role);
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [formState, setFormState] = useState<DeviceFormState>(createEmptyForm);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issuedDevice, setIssuedDevice] = useState<RegisteredDeviceResponse | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [deviceAction, setDeviceAction] = useState<{
    deviceId: string;
    type: 'rotate' | 'deactivate';
  } | null>(null);
  const [filters, setFilters] = useState(emptyDeviceFilters);
  const [selectedExportColumns, setSelectedExportColumns] = useState(
    defaultDeviceExportColumns
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    void fetchAdminDevices(activeSchool.id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setDevices(sortDevices(payload));
        setStatus('ready');
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load school devices.');
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, user]);

  const counts = useMemo(
    () => ({
      total: devices.length,
      active: devices.filter((device) => device.isActive).length
    }),
    [devices]
  );
  const filteredDevices = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase();
    return devices.filter((device) => {
      if (filters.status && (filters.status === 'active') !== device.isActive) return false;
      if (!search) return true;
      return [device.name, device.location, device.id, device.keyLastFour]
        .some((value) => value.toLocaleLowerCase().includes(search));
    });
  }, [devices, filters]);
  const devicePagination = usePagination(filteredDevices, DEVICE_PAGE_SIZE);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    setNotice(null);

    try {
      const result = await createAdminDevice(activeSchool.id, {
        name: formState.name,
        location: formState.location
      });

      setDevices((current) => sortDevices([result.device, ...current]));
      setIssuedDevice(result);
      setNotice(`${result.device.name} is now registered for ${result.device.location}.`);
      setFormState(createEmptyForm());
      setRegistrationOpen(false);
      setStatus('ready');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to register this device.');
      setStatus('ready');
    }
  };

  const replaceDevice = (updatedDevice: ManagedDevice) => {
    setDevices((current) =>
      sortDevices(current.map((device) => (device.id === updatedDevice.id ? updatedDevice : device)))
    );
  };

  const handleRotateKey = async (device: ManagedDevice) => {
    const replacesVisibleKey = issuedDevice !== null;
    const confirmed = window.confirm(
      `${replacesVisibleKey ? 'The currently displayed one-time key will be replaced. ' : ''}` +
        `Rotate ${device.name}'s key? Its current key will stop working immediately.`
    );

    if (!confirmed) return;

    setDeviceAction({ deviceId: device.id, type: 'rotate' });
    setError(null);
    setNotice(null);

    try {
      const result = await rotateAdminDeviceKey(activeSchool.id, device.id);
      replaceDevice(result.device);
      setIssuedDevice(result);
      setNotice(`${result.device.name}'s previous key is revoked. Save the replacement key now.`);
    } catch (rotateError) {
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : 'Unable to rotate this key. The existing key remains unchanged.'
      );
    } finally {
      setDeviceAction(null);
    }
  };

  const handleDeactivate = async (device: ManagedDevice) => {
    const confirmed = window.confirm(
      `Deactivate ${device.name}? Its device key will stop working immediately and cannot be reactivated here.`
    );

    if (!confirmed) return;

    setDeviceAction({ deviceId: device.id, type: 'deactivate' });
    setError(null);
    setNotice(null);

    try {
      const updatedDevice = await deactivateAdminDevice(activeSchool.id, device.id);
      replaceDevice(updatedDevice);
      if (issuedDevice?.device.id === device.id) setIssuedDevice(null);
      setNotice(`${updatedDevice.name} is inactive. Its last issued key is now rejected.`);
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'Unable to deactivate this device. Try again before removing it from service.'
      );
    } finally {
      setDeviceAction(null);
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
          <p className="panel-label">Registered devices</p>
          <strong>{counts.total}</strong>
          <p>{counts.active} active scanners currently mapped to this school.</p>
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
              <span className="status-pill status-pill--muted">{counts.active} active</span>
              {canEdit ? <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setRegistrationOpen(true);
                }}
              >
                Register scanner
              </button> : (
                <span className="status-pill status-pill--muted">Read-only support view</span>
              )}
            </div>
          </div>

          {error && !registrationOpen ? (
            <div className="form-message form-message--error" role="alert">
              {error}
            </div>
          ) : notice ? (
            <div className="form-message" role="status">
              {notice}
            </div>
          ) : (
            <div className="form-message">
              The roster below is the durable view after provisioning. Full device keys are never reloaded from storage.
            </div>
          )}

          <ListToolbar
            activeFilterCount={activeFilterCount}
            exportColumns={deviceExportColumns}
            exportDisabled={status === 'loading'}
            onClear={() => {
              setFilters(emptyDeviceFilters);
              devicePagination.setPage(1);
            }}
            onExport={() =>
              downloadCsvColumns(
                `${activeSchool.slug}-devices-${new Date().toISOString().slice(0, 10)}.csv`,
                deviceExportColumns,
                selectedExportColumns,
                filteredDevices
              )
            }
            onExportColumnsChange={setSelectedExportColumns}
            onSearchChange={(value) => {
              setFilters((current) => ({ ...current, search: value }));
              devicePagination.setPage(1);
            }}
            resultCount={filteredDevices.length}
            resultLabel={filteredDevices.length === 1 ? 'device' : 'devices'}
            search={filters.search}
            searchLabel="Search device, location, ID, or key suffix"
            selectedExportColumns={selectedExportColumns}
          >
            <label className="compact-field">
              <span>Status</span>
              <select
                value={filters.status}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, status: event.target.value }));
                  devicePagination.setPage(1);
                }}
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
            {status === 'loading' ? (
              Array.from({ length: 4 }).map((_, index) => <div className="table-skeleton" key={`device-skeleton-${index}`} />)
            ) : filteredDevices.length === 0 ? (
              <div className="empty-state">
                <h3>{activeFilterCount > 0 ? 'No matching devices' : 'No devices registered yet'}</h3>
                <p>
                  {activeFilterCount > 0
                    ? 'Adjust or clear the filters to broaden the scanner roster.'
                    : 'Create the first scanner profile from the registration form on this page.'}
                </p>
              </div>
            ) : (
              devicePagination.pageItems.map((device) => (
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
                        onClick={() => void handleRotateKey(device)}
                      >
                        {deviceAction?.deviceId === device.id && deviceAction.type === 'rotate'
                          ? 'Rotating key…'
                          : 'Rotate key'}
                      </button>
                      <button
                        className="secondary-button secondary-button--danger secondary-button--compact"
                        type="button"
                        disabled={deviceAction !== null}
                        onClick={() => void handleDeactivate(device)}
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
          {status !== 'loading' ? (
            <Pagination
              itemLabel="devices"
              onPageChange={devicePagination.setPage}
              page={devicePagination.page}
              pageSize={devicePagination.pageSize}
              totalItems={devicePagination.totalItems}
            />
          ) : null}
        </article>
      </div>

      <Modal
        description="The device key is revealed once after registration."
        onClose={() => {
          setRegistrationOpen(false);
          setError(null);
        }}
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
            <button className="primary-button" type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Registering device…' : 'Register device'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setRegistrationOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
