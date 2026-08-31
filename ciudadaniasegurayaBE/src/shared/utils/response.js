export function success(request, data, extraMeta = {}) {
  return {
    success: true,
    data,
    meta: {
      ...extraMeta,
      requestId: request.id,
    },
  };
}

export function paginated(request, data, { page, pageSize, total }) {
  return success(request, data, {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  });
}
