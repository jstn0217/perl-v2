interface PaginationProps {
  itemLabel: string;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalItems: number;
}

const pageWindow = (page: number, totalPages: number) => {
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const Pagination = ({
  itemLabel,
  onPageChange,
  page,
  pageSize,
  totalItems
}: PaginationProps) => {
  if (totalItems === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  return (
    <nav className="pagination" aria-label={`${itemLabel} pagination`}>
      <p>
        <strong>{firstItem}–{lastItem}</strong> of {totalItems} {itemLabel}
      </p>
      <div className="pagination__controls">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={`Previous ${itemLabel} page`}
        >
          Previous
        </button>
        {pageWindow(safePage, totalPages).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={pageNumber === safePage ? 'pagination__page--active' : undefined}
            aria-current={pageNumber === safePage ? 'page' : undefined}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={`Next ${itemLabel} page`}
        >
          Next
        </button>
      </div>
    </nav>
  );
};
