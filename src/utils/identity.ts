import { Env, UserIdentity } from '../types';

/**
 * Decodes the payload of a JSON Web Token without cryptographic verification.
 * Cloudflare Access passes this in `Cf-Access-Jwt-Assertion`.
 */
function decodeJwtPayload(jwt: string): Record<string, any> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonString = atob(base64);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Extracts authenticated identity information from incoming request headers and Cloudflare properties.
 */
export function extractUserIdentity(request: Request, env: Env): UserIdentity {
  const headers = request.headers;

  // 1. Extract Email
  let email = headers.get('cf-access-authenticated-user-email');
  let authTimestamp: string | null = null;

  // Try parsing Cloudflare Access JWT assertion if available
  const jwtAssertion = headers.get('cf-access-jwt-assertion');
  if (jwtAssertion) {
    const payload = decodeJwtPayload(jwtAssertion);
    if (payload) {
      if (!email && payload.email) {
        email = payload.email;
      }
      if (payload.iat && typeof payload.iat === 'number') {
        authTimestamp = new Date(payload.iat * 1000).toUTCString();
      }
    }
  }

  // Fallback email for local development or manual header overrides
  if (!email) {
    email = headers.get('x-user-email') || env.DEV_MOCK_EMAIL || 'anonymous@example.com';
  }

  // 2. Extract Timestamp
  const timestamp = authTimestamp || new Date().toUTCString();

  // 3. Extract Country
  // Cloudflare provides request.cf.country (ISO-3166-1 alpha-2) at the edge
  const cf = (request as any).cf;
  let country: string | undefined = cf?.country || headers.get('cf-ipcountry') || headers.get('x-user-country');

  if (!country || country === 'XX' || country === 'T1') {
    country = env.DEV_MOCK_COUNTRY || 'US';
  }

  country = country.toUpperCase();

  const isAccess = !!headers.get('cf-access-authenticated-user-email') || !!jwtAssertion;

  return {
    email,
    timestamp,
    country,
    source: isAccess ? 'cloudflare-access' : (cf?.country ? 'cf-edge' : 'local-dev')
  };
}
