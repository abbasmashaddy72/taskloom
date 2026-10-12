import 'server-only';
import type { NextRequest } from 'next/server';

/** Defense against cross-origin form/fetch requests to the local S3 write endpoints.
 * This is not authentication; do not expose Taskloom publicly without proper auth.
 */
export function writeFromSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hosts = [
      request.headers.get('host'),
      request.headers.get('x-forwarded-host'),
      request.nextUrl.host,
    ];
    return ['http:', 'https:'].includes(url.protocol) && hosts.includes(url.host);
  } catch {
    return false;
  }
}
