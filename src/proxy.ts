import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/api/:path*'],
};

export function proxy(request: NextRequest) {
  const url = new URL(request.url);

  // Allow health check without auth (for uptime monitors)
  // Allow cron endpoint (uses its own CRON_SECRET verification)
  if (url.pathname === '/api/health' || url.pathname === '/api/cron/process-emails') {
    return NextResponse.next();
  }

  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;

  // If credentials are not configured, skip auth (dev mode)
  if (!username || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Licitaciones Dashboard"' },
    });
  }

  const base64Credentials = authHeader.slice('Basic '.length);
  const decoded = atob(base64Credentials);
  const [providedUser, providedPass] = decoded.split(':');

  if (providedUser !== username || providedPass !== password) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Licitaciones Dashboard"' },
    });
  }

  return NextResponse.next();
}
