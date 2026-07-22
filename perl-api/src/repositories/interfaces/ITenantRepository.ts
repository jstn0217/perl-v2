export interface ITenantRepository {
  listSchoolIds(): Promise<string[]>;
}
