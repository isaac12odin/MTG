export function paginate(page: number, pageSize: number) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.max(pageSize, 1);
  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  };
}

export function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
