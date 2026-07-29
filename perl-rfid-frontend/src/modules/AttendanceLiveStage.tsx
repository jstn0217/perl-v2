import { useEffect, useState } from 'react';
import { StudentAvatar } from '../components/StudentAvatar';
import {
  attendanceDenialLabel,
  attendanceVerdictLabel,
  formatAttendanceTimestamp
} from '../lib/attendancePresentation';
import type { AttendanceScanResult } from '../types/attendance';

type StreamStatus = 'connecting' | 'live' | 'offline';

interface AttendanceLiveStageProps {
  currentEvent: AttendanceScanResult | null;
  schoolName: string;
  streamStatus: StreamStatus;
}

const formatClockTime = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).format(value);

const formatClockDate = (value: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(value);

const LiveClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="live-clock" aria-label={`Current time: ${formatClockTime(now)}`}>
      <time dateTime={now.toISOString()} aria-live="off">{formatClockTime(now)}</time>
      <span>{formatClockDate(now)}</span>
    </div>
  );
};

export const AttendanceLiveStage = ({
  currentEvent,
  schoolName,
  streamStatus
}: AttendanceLiveStageProps) => (
  <section
    className={`live-attendance-stage${currentEvent ? ` live-attendance-stage--${currentEvent.verdict.toLowerCase()}` : ''}`}
  >
    <header className="live-attendance-stage__header">
      <div className="live-attendance-stage__status">
        <span className={`stream-indicator stream-indicator--${streamStatus}`}>
          <span className="stream-indicator__dot" aria-hidden="true" />
          {streamStatus === 'connecting'
            ? 'Connecting'
            : streamStatus === 'live'
              ? 'Monitor live'
              : 'Reconnecting'}
        </span>
        <span>{schoolName}</span>
      </div>
      <LiveClock />
    </header>

    {currentEvent ? (
      <>
        <div className="live-attendance-stage__student" role="status" aria-live="polite" aria-atomic="true">
          <StudentAvatar student={currentEvent.student} variant="live" />
          <div className="live-attendance-stage__verdicts">
            <span className={`live-verdict live-verdict--${currentEvent.verdict.toLowerCase()}`}>
              {attendanceVerdictLabel[currentEvent.verdict]}
            </span>
            <span className="live-direction">
              {currentEvent.log.direction === 'IN' ? 'Time in' : 'Time out'}
            </span>
          </div>
          <h2>
            {currentEvent.student
              ? `${currentEvent.student.firstName} ${currentEvent.student.lastName}`
              : 'Unrecognized card'}
          </h2>
          {currentEvent.student ? (
            <p className="live-student-context">
              {[currentEvent.student.gradeLevel, currentEvent.student.section]
                .filter(Boolean)
                .join(' • ') || 'Student'}
            </p>
          ) : null}
          <p className="live-attendance-stage__message">{currentEvent.log.message}</p>
          {currentEvent.denialReason ? (
            <span className="live-denial-reason">
              {attendanceDenialLabel[currentEvent.denialReason]}
            </span>
          ) : null}
        </div>

        <dl className="live-attendance-stage__details">
          <div>
            <dt>Scanner</dt>
            <dd>{currentEvent.deviceName}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{currentEvent.deviceLocation}</dd>
          </div>
          <div>
            <dt>Recorded</dt>
            <dd>{formatAttendanceTimestamp(currentEvent.log.scannedAt)}</dd>
          </div>
        </dl>
      </>
    ) : (
      <div className="live-attendance-stage__waiting">
        <div className="scan-ready-mark" aria-hidden="true">
          <span />
        </div>
        <p className="panel-label">Ready for the next scan</p>
        <h2>Waiting for a card scan</h2>
        <p>The card holder and attendance details will appear here as soon as a card is read.</p>
      </div>
    )}
  </section>
);
