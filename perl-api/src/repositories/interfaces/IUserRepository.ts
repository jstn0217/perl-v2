export interface IUserRepository {
  listUserIds(): Promise<string[]>;
}
