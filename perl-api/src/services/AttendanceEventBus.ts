import { EventEmitter } from 'node:events';
import type { AttendanceScanResult } from '../types/Attendance.js';

class AttendanceEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: AttendanceScanResult) {
    this.emitter.emit(event.schoolId, event);
  }

  subscribe(schoolId: string, listener: (event: AttendanceScanResult) => void) {
    this.emitter.on(schoolId, listener);

    return () => {
      this.emitter.off(schoolId, listener);
    };
  }
}

export const attendanceEventBus = new AttendanceEventBus();
