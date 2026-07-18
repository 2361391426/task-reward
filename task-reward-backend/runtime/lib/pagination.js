const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const normalizePagination = (query = {}, options = {}) => {
  const page = parsePositiveInt(query.page, options.defaultPage || DEFAULT_PAGE);
  const rawPageSize = parsePositiveInt(query.page_size, options.defaultPageSize || DEFAULT_PAGE_SIZE);
  const maxPageSize = options.maxPageSize || MAX_PAGE_SIZE;
  const pageSize = Math.min(rawPageSize, maxPageSize);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
};

module.exports = {
  normalizePagination,
  parsePositiveInt
};
