import type { FastifyInstance } from 'fastify'

// The API only serves JSON (and the auth endpoints), so its CSP can forbid everything: nothing
// it returns should ever load, run or be framed. The SPA's own policy lives in docker/app/nginx.conf.
const HEADERS = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-site',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

/**
 * Hardening headers on every response (OWASP A05), plus HSTS once a request arrived over
 * HTTPS. TLS ends at the reverse proxy, so `request.protocol` comes from X-Forwarded-Proto
 * (`trustProxy`); HSTS over plain HTTP would be ignored by browsers anyway.
 */
export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    reply.headers(HEADERS)
    if (request.protocol === 'https') {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains')
    }
  })
}
