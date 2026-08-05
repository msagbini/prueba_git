import type { JSX } from 'react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Prev/next pager for a `PaginatedResult<T>` list, shared across every
 * operational page.
 * @param props the current page state and a page-change handler
 * @param props.page the current (1-indexed) page
 * @param props.totalPages the total number of pages
 * @param props.total the total number of matching rows across all pages
 * @param props.onPageChange called with the newly requested page
 * @returns the pager element
 */
export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps): JSX.Element {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-1 py-3 text-xs text-gray-500">
      <span>{total} total</span>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="px-2 py-1"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          className="px-2 py-1"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
