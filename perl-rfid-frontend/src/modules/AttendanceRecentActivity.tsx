import {
  attendanceVerdictLabel,
  formatAttendanceTimestamp
} from '../lib/attendancePresentation';
import type { AttendanceLogListItem } from '../types/attendance';

export const AttendanceRecentActivity = ({
  records
}: {
  records: AttendanceLogListItem[];
}) => {
  if (records.length === 0) {
    return (
      <div className="empty-state">
        <h3>No scans yet</h3>
        <p>Use the simulator on this screen or a device client to start streaming attendance events.</p>
      </div>
    );
  }

  return (
    <div className="activity-list">
      {records.slice(0, 5).map((record) => (
        <article className="activity-row" key={record.log.id}>
          <div>
            <strong>
              {record.student
                ? `${record.student.firstName} ${record.student.lastName}`
                : 'Unknown card'}
            </strong>
            <p>{record.log.message}</p>
          </div>
          <div className="activity-row__meta">
            <span className={`status-pill status-pill--${record.log.verdict.toLowerCase()}`}>
              {attendanceVerdictLabel[record.log.verdict]}
            </span>
            <time dateTime={record.log.scannedAt}>
              {formatAttendanceTimestamp(record.log.scannedAt)}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
};
