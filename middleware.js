/**
 * Vercel Edge Middleware — HTTP Basic Auth
 *
 * Protects all /api/* routes except /api/health.
 * Reads credentials from DASHBOARD_USERNAME + DASHBOARD_PASSWORD env vars.
 */

export const config = {
  matcher: ['/api/:path*'],
};

export default function middleware(request) {
  const url = new URL(request.url);

  // Allow health check without auth (for uptime monitors)
  if (url.pathname === '/api/health') {
    return;
  }

  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  // If credentials are not configured, skip auth (dev mode)
  if (!username || !password) {
    return;
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Licitaciones Dashboard"' },
    });
  }

  const base64Credentials = authHeader.slice('Basic '.length);
  const decoded = atob(base64Credentials);
  const [providedUser, providedPass] = decoded.split(':');

  if (providedUser !== username || providedPass !== password) {
    return new Response('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Licitaciones Dashboard"' },
    });
  }

  // Auth passed — continue to the serverless function
  return;
}
