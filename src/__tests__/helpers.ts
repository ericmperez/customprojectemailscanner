import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for testing App Router route handlers.
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}
