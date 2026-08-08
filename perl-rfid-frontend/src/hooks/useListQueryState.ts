import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SortDirection = 'asc' | 'desc';

interface UseListQueryStateOptions<Filters extends Record<string, string>> {
  pageSize: number;
  defaultSort: string;
  defaultFilters: Filters;
  debounceMs?: number;
}

export interface ListQueryState<Filters extends Record<string, string>> {
  page: number;
  pageSize: number;
  search: string;
  debouncedSearch: string;
  sort: string;
  dir: SortDirection;
  filters: Filters;
  activeFilterCount: number;
  setPage: (page: number) => void;
  setSearch: (value: string) => void;
  setSort: (sort: string, dir?: SortDirection) => void;
  setFilter: (key: keyof Filters, value: string) => void;
  clear: () => void;
}

/**
 * One list-query contract for pagination, search, sort, and filters, persisted in the URL
 * (shareable/restorable) with the search term debounced before it drives a refetch.
 */
export const useListQueryState = <Filters extends Record<string, string>>({
  pageSize,
  defaultSort,
  defaultFilters,
  debounceMs = 300
}: UseListQueryStateOptions<Filters>): ListQueryState<Filters> => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKeys = useMemo(() => Object.keys(defaultFilters) as (keyof Filters)[], [defaultFilters]);

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const search = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? defaultSort;
  const dir: SortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const filters = useMemo(() => {
    const next = { ...defaultFilters };
    filterKeys.forEach((key) => {
      const value = searchParams.get(String(key));
      if (value) next[key] = value as Filters[typeof key];
    });
    return next;
  }, [defaultFilters, filterKeys, searchParams]);
  const activeFilterCount =
    (search ? 1 : 0) + filterKeys.filter((key) => filters[key] !== defaultFilters[key]).length;

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => window.clearTimeout(timeout);
  }, [search, debounceMs]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          });
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return {
    page,
    pageSize,
    search,
    debouncedSearch,
    sort,
    dir,
    filters,
    activeFilterCount,
    setPage: (nextPage: number) => updateParams({ page: nextPage > 1 ? String(nextPage) : null }),
    setSearch: (value: string) => updateParams({ q: value || null }, true),
    setSort: (nextSort: string, nextDir: SortDirection = 'asc') =>
      updateParams(
        {
          sort: nextSort === defaultSort ? null : nextSort,
          dir: nextDir === 'asc' ? null : nextDir
        },
        true
      ),
    setFilter: (key: keyof Filters, value: string) => updateParams({ [String(key)]: value || null }, true),
    clear: () =>
      updateParams(
        {
          q: null,
          sort: null,
          dir: null,
          ...Object.fromEntries(filterKeys.map((key) => [String(key), null]))
        },
        true
      )
  };
};
