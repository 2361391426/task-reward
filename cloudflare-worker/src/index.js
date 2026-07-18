const DEFAULT_ORIGIN = 'https://task-reward-vert.vercel.app'

const buildCorsHeaders = (request) => ({
  'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type,Authorization,x-device-id',
  'Access-Control-Max-Age': '86400'
})

const copyResponseHeaders = (response, corsHeaders) => {
  const headers = new Headers(response.headers)
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value))
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.delete('set-cookie')
  return headers
}

export default {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const incomingUrl = new URL(request.url)
    const origin = String(env.ORIGIN_BASE_URL || DEFAULT_ORIGIN).replace(/\/$/, '')
    const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, origin)
    const upstreamRequest = new Request(upstreamUrl, request)

    try {
      const response = await fetch(upstreamRequest, {
        redirect: 'manual',
        cf: {
          cacheEverything: false
        }
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: copyResponseHeaders(response, corsHeaders)
      })
    } catch (error) {
      return Response.json({
        code: 5001,
        message: '生产接口暂时无法访问',
        data: null
      }, {
        status: 502,
        headers: corsHeaders
      })
    }
  }
}
