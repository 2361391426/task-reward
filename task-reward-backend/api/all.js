const app = require('../runtime/app')

module.exports = (req, res) => {
  const rawPath = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+/, '')
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  requestUrl.searchParams.delete('path')
  req.url = `/api/${rawPath}${requestUrl.search}`
  return app(req, res)
}
