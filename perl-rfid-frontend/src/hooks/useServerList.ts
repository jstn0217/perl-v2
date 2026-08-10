import { useEffect, useMemo, useState } from 'react';

export interface ServerListPayload<T> {
  items: T[];
  total: number;
}

interface UseServerListOptions<T> {
  /** Identity of the current request: page/search/sort/filters/reload token, joined. */
  requestKey: string;
  /** Skip fetching (e.g. while the session user hasn't loaded yet). */
  enabled: boolean;
  fetcher: () => Promise<ServerListPayload<T>>;
  errorMessage: string;
}

export interface ServerListResult<T> {
  items: T[];
  total: number;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}

/**
 * Shared server-paginated list state: fetches on requestKey change, keeps the
 * last known result visible during a refetch (so the UI doesn't flash empty
 * on every keystroke), and derives loading/ready/error status from whether the
 * latest resolved or failed request matches the current requestKey.
 */
export const useServerList = <T>({
  requestKey,
  enabled,
  fetcher,
  errorMessage
}: UseServerListOptions<T>): ServerListResult<T> => {
  const [listState, setListState] = useState<{ requestKey: string; items: T[]; total: number } | null>(
    null
  );
  const [listErrorState, setListErrorState] = useState<{ requestKey: string; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void fetcher()
      .then((payload) => {
        if (cancelled) return;
        setListState({ requestKey, items: payload.items, total: payload.total });
        setListErrorState(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setListErrorState({
          requestKey,
          message: loadError instanceof Error ? loadError.message : errorMessage
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled]);

  const items = useMemo(
    () => (listState?.requestKey === requestKey ? listState.items : []),
    [requestKey, listState]
  );
  const total = listState?.total ?? 0;
  const status: 'loading' | 'ready' | 'error' =
    listErrorState?.requestKey === requestKey
      ? 'error'
      : listState?.requestKey === requestKey
        ? 'ready'
        : 'loading';
  const error = listErrorState?.requestKey === requestKey ? listErrorState.message : null;

  return { items, total, status, error };
};
