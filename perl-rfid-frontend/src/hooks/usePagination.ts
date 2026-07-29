import { useMemo, useState } from 'react';

export const usePagination = <Item,>(items: Item[], pageSize: number) => {
  const [requestedPage, setRequestedPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageItems = useMemo(() => {
    const offset = (page - 1) * pageSize;

    return items.slice(offset, offset + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageItems,
    pageSize,
    setPage: setRequestedPage,
    totalItems: items.length,
    totalPages
  };
};
