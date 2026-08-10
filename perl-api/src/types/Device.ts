export interface DeviceRecord {
  id: string;
  schoolId: string;
  name: string;
  location: string;
  keyHash: string;
  keyLastFour: string;
  isActive: boolean;
  lastSeenAt: string | null;
}

export interface DeviceView {
  id: string;
  schoolId: string;
  name: string;
  location: string;
  keyLastFour: string;
  isActive: boolean;
  lastSeenAt: string | null;
}
