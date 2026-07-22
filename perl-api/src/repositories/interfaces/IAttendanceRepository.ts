export interface IAttendanceRepository {
  listAttendanceIds(): Promise<string[]>;
}
