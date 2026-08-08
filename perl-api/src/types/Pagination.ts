export type SortDirection = 'asc' | 'desc';

export interface PageQuery {
  page: number;
  pageSize: number;
  search?: string;
  sort?: string;
  dir?: SortDirection;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}
