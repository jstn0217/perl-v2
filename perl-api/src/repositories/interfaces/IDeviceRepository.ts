export interface IDeviceRepository {
  listDeviceIds(): Promise<string[]>;
}
