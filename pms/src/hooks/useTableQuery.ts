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
