import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createAttendanceStream,
  fetchAdminDevices,
  fetchAttendanceLogs,
  scanCard
} from '../lib/api';
import { AttendanceEventCard } from '../modules/AttendanceEventCard';
import { AttendanceLiveStage } from '../modules/AttendanceLiveStage';
import { AttendanceRecentActivity } from '../modules/AttendanceRecentActivity';
import { useAuth } from '../providers/auth-context';
import { useTenantContext } from '../providers/TenantContext';
import type { ManagedDevice } from '../types/admin';
import type { AttendanceLogListItem, AttendanceScanResult } from '../types/attendance';
import {
  canUseMonitorDiagnostics,
  canViewSchoolWorkspace
} from '../lib/permissions';

const mergeEvents = (
  current: AttendanceScanResult[],
  incoming: AttendanceScanResult
) => {
  const next = [incoming, ...current.filter((event) => event.log.id !== incoming.log.id)];

  return next.slice(0, 12);
};

export const AttendanceMonitorPage = () => {
  const { user } = useAuth();
  const { activeSchool } = useTenantContext();
  const diagnosticsAllowed = canUseMonitorDiagnostics(user?.role);
  const [cardUid, setCardUid] = useState('');
  const [eventState, setEventState] = useState<{
    schoolSlug: string;
    events: AttendanceScanResult[];
  }>({
    schoolSlug: activeSchool.slug,
    events: []
  });
  const [recentRecordState, setRecentRecordState] = useState<{
    schoolSlug: string;
    records: AttendanceLogListItem[];
  }>({
    schoolSlug: activeSchool.slug,
    records: []
  });
  const [streamState, setStreamState] = useState<{
    schoolSlug: string;
    status: 'connecting' | 'live' | 'offline';
  }>({
    schoolSlug: activeSchool.slug,
    status: 'connecting'
  });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deviceState, setDeviceState] = useState<{
    schoolId: string | null;
    devices: ManagedDevice[];
  }>({
    schoolId: activeSchool.id,
    devices: []
  });
  const events = useMemo(
    () => (eventState.schoolSlug === activeSchool.slug ? eventState.events : []),
    [activeSchool.slug, eventState]
  );
  const recentRecords = useMemo(
    () =>
      diagnosticsAllowed && recentRecordState.schoolSlug === activeSchool.slug
        ? recentRecordState.records
        : [],
    [activeSchool.slug, diagnosticsAllowed, recentRecordState]
  );
  const streamStatus = useMemo(
    () => (streamState.schoolSlug === activeSchool.slug ? streamState.status : 'connecting'),
    [activeSchool.slug, streamState]
  );
  const registeredDevices = useMemo(
    () =>
      user &&
      canViewSchoolWorkspace(user.role) &&
      deviceState.schoolId === activeSchool.id
        ? deviceState.devices
        : [],
    [activeSchool.id, deviceState, user]
  );
  const currentEvent = events[0] ?? null;
  const earlierEvents = events.slice(1, 5);

  useEffect(() => {
    if (!diagnosticsAllowed) return;

    let cancelled = false;

    void fetchAttendanceLogs({
      schoolSlug: activeSchool.slug,
      page: 1,
      pageSize: 5
    })
      .then((payload) => {
        if (!cancelled) {
          setRecentRecordState({
            schoolSlug: activeSchool.slug,
            records: payload.records
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentRecordState({
            schoolSlug: activeSchool.slug,
            records: []
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.slug, diagnosticsAllowed]);

  useEffect(() => {
    if (!user || !canViewSchoolWorkspace(user.role)) {
      return;
    }

    let cancelled = false;

    void fetchAdminDevices(activeSchool.id)
      .then((devices) => {
        if (!cancelled) {
          setDeviceState({
            schoolId: activeSchool.id,
            devices
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeviceState({
            schoolId: activeSchool.id,
            devices: []
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSchool.id, user]);

  useEffect(() => {
    const close = createAttendanceStream(activeSchool.slug, {
      onOpen: () =>
        setStreamState({
          schoolSlug: activeSchool.slug,
          status: 'live'
        }),
      onError: () =>
        setStreamState({
          schoolSlug: activeSchool.slug,
          status: 'offline'
        }),
      onEvent: (event) => {
        setStreamState({
          schoolSlug: activeSchool.slug,
          status: 'live'
        });
        setEventState((current) => ({
          schoolSlug: activeSchool.slug,
          events: mergeEvents(
            current.schoolSlug === activeSchool.slug ? current.events : [],
            event
          )
        }));
        setRecentRecordState((current) => {
          const nextRecord: AttendanceLogListItem = {
            log: event.log,
            student: event.student,
            device: {
              id: event.deviceId,
              name: event.deviceName,
              location: event.deviceLocation
            }
          };

          return {
            schoolSlug: activeSchool.slug,
            records: [
              nextRecord,
              ...(current.schoolSlug === activeSchool.slug ? current.records : []).filter(
                (record) => record.log.id !== event.log.id
              )
            ].slice(0, 5)
          };
        });
      }
    });

    return () => {
      close();
    };
  }, [activeSchool.slug]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitStatus('submitting');

    try {
      const result = await scanCard({
        schoolSlug: activeSchool.slug,
        cardUid
      });

      setEventState((current) => ({
        schoolSlug: activeSchool.slug,
        events: mergeEvents(
          current.schoolSlug === activeSchool.slug ? current.events : [],
          result
        )
      }));
      setRecentRecordState((current) => {
        const nextRecord: AttendanceLogListItem = {
          log: result.log,
          student: result.student,
          device: {
            id: result.deviceId,
            name: result.deviceName,
            location: result.deviceLocation
          }
        };

        return {
          schoolSlug: activeSchool.slug,
          records: [
            nextRecord,
            ...(current.schoolSlug === activeSchool.slug ? current.records : []).filter(
              (record) => record.log.id !== result.log.id
            )
          ].slice(0, 5)
        };
      });
      setCardUid('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit scan.');
    } finally {
      setSubmitStatus('idle');
    }
  };

  return (
    <section className="attendance-grid">
      <AttendanceLiveStage
        currentEvent={currentEvent}
        schoolName={activeSchool.name}
        streamStatus={streamStatus}
      />

      {diagnosticsAllowed ? (
        <aside className="login-card">
          <div className="login-card__header">
            <p className="panel-label">Support diagnostic</p>
            <h3>Simulate a scan</h3>
            <p className="login-card__hint">
              Test a card UID and inspect admit or denial behavior inside the selected support context.
            </p>
          </div>

          <form className="stack-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Card UID</span>
              <input
                type="text"
                value={cardUid}
                onChange={(event) => setCardUid(event.target.value)}
                placeholder="Scan or paste the RFID card UID"
                autoComplete="off"
                required
              />
            </label>

            {submitError ? (
              <div className="form-message form-message--error" role="alert">
                {submitError}
              </div>
            ) : (
              <div className="form-message">
                Diagnostic scans are saved and appear in the system support log preview below.
              </div>
            )}

            <button className="primary-button" type="submit" disabled={submitStatus === 'submitting'}>
              {submitStatus === 'submitting' ? 'Sending scan…' : 'Send diagnostic scan'}
            </button>
          </form>
        </aside>
      ) : null}

      {canViewSchoolWorkspace(user?.role) ? (
        <aside className="preview-panel device-sidecar">
          <div className="admin-form__header">
            <div>
              <p className="panel-label">Registered devices</p>
              <h3>Provisioned scanners</h3>
            </div>
            <Link className="secondary-button secondary-button--link" to="/admin/devices">
              {user?.role === 'SUPPORT' ? 'View devices' : 'Manage devices'}
            </Link>
          </div>

          {registeredDevices.length === 0 ? (
            <div className="empty-state">
              <h3>No devices on file</h3>
              <p>Register the first scanner to issue a key and move from browser simulation to device-authenticated scans.</p>
            </div>
          ) : (
            <div className="device-sidecar__list">
              {registeredDevices.slice(0, 4).map((device) => (
                <article className="device-sidecar__item" key={device.id}>
                  <div>
                    <strong>{device.name}</strong>
                    <p>{device.location}</p>
                  </div>
                  <span className="status-pill status-pill--muted">•••• {device.keyLastFour}</span>
                </article>
              ))}
            </div>
          )}

          <p className="device-sidecar__footnote">
            Full keys are shown only when the device is created. This monitor keeps the active roster visible during attendance operations.
          </p>
        </aside>
      ) : null}

      <section className="monitor-column">
        <div className="section-heading">
          <div>
            <p className="panel-label">Previous activity</p>
            <h3>Earlier scans in this session</h3>
          </div>
        </div>

        <div className="event-list">
          {earlierEvents.length === 0 ? (
            <div className="empty-state">
              <h3>No earlier scans</h3>
              <p>After the next scan, the current result moves here for quick reference.</p>
            </div>
          ) : (
            earlierEvents.map((event) => <AttendanceEventCard key={event.log.id} event={event} />)
          )}
        </div>
      </section>

      {diagnosticsAllowed ? (
        <section className="preview-panel">
          <div className="section-heading">
            <div>
              <p className="panel-label">Support verification</p>
              <h3>Latest saved records</h3>
            </div>
          </div>

          <AttendanceRecentActivity records={recentRecords} />
        </section>
      ) : null}
    </section>
  );
};
