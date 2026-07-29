import { StudentAvatar } from '../components/StudentAvatar';
import {
  attendanceDenialLabel,
  attendanceVerdictLabel,
  formatAttendanceTimestamp
} from '../lib/attendancePresentation';
import type { AttendanceScanResult } from '../types/attendance';

export const AttendanceEventCard = ({ event }: { event: AttendanceScanResult }) => (
  <article className={`event-card event-card--${event.verdict.toLowerCase()}`}>
    <div className="event-card__identity">
      <StudentAvatar student={event.student} />
      <div>
        <div className="event-card__meta">
          <span className={`status-pill status-pill--${event.verdict.toLowerCase()}`}>
            {attendanceVerdictLabel[event.verdict]}
          </span>
          <span className={`status-pill status-pill--direction-${event.log.direction.toLowerCase()}`}>
            {event.log.direction}
          </span>
          {event.denialReason ? (
            <span className="status-pill status-pill--muted">
              {attendanceDenialLabel[event.denialReason]}
            </span>
          ) : null}
        </div>
        <h3>
          {event.student
            ? `${event.student.firstName} ${event.student.lastName}`
            : 'Unrecognized card'}
        </h3>
        <p>{event.log.message}</p>
      </div>
    </div>

    <dl className="event-card__details">
      <div>
        <dt>Device</dt>
        <dd>{event.deviceName}</dd>
      </div>
      <div>
        <dt>Location</dt>
        <dd>{event.deviceLocation}</dd>
      </div>
      <div>
        <dt>Scanned</dt>
        <dd>{formatAttendanceTimestamp(event.log.scannedAt)}</dd>
      </div>
    </dl>
  </article>
);
