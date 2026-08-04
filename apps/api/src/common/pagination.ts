/** A page of `items` out of `total` matching rows, per the requested `page`/`pageSize`. */
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Builds a {@link PaginatedResult} from a page of rows and the total
 * matching count.
 * @param items the rows for the requested page
 * @param total the total number of matching rows across all pages
 * @param page the requested (1-indexed) page number
 * @param pageSize the requested page size
 * @returns the paginated result envelope
 */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
