import { useMemo } from "react";

const MIN_PER_PAGE = 10;
const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 25;

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export interface TableSearchState {
  q?: string;
  page?: number;
  perPage?: number;
  [key: string]: string | number | undefined;
}

export function normalizeTableSearch<T extends TableSearchState>(input: T): T {
  const page = Number(input.page) > 0 ? Math.floor(Number(input.page)) : 1;
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(MIN_PER_PAGE, Number(input.perPage) || DEFAULT_PER_PAGE),
  );
  return { ...input, page, perPage };
}

export interface Paginated<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
}

export function paginate<T>(items: T[], page: number, perPage: number): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    totalItems,
    totalPages,
    page: safePage,
    perPage,
  };
}

export function useFilteredList<T>(
  items: T[],
  predicate: (item: T) => boolean,
  deps: React.DependencyList,
): T[] {
  return useMemo(() => items.filter(predicate), [items, ...deps]);
}
