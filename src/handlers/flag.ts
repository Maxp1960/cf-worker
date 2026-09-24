import { Env } from '../types';
import { getMimeType } from '../utils/mime';

/**
 * Generates an SVG placeholder when a country flag is not found in R2.
 */
function generateFallbackSvg(countryCode: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
  <rect width="640" height="480" fill="#1e293b" rx="16"/>
  <rect x="20" y="20" width="600" height="440" fill="none" stroke="#334155" stroke-width="4" stroke-dasharray="8 8" rx="12"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="72" font-weight="bold">${countryCode}</text>
  <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui, sans-serif" font-size="24">Flag not found in R2</text>
</svg>`;
}

/**
 * Handles GET /secure/:country
 * Retrieves country flag image from private R2 bucket and returns with appropriate content type.
 */
export async function handleFlagRequest(
  countryParam: string,
  env: Env
): Promise<Response> {
  const sanitized = countryParam.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();

  if (!sanitized || sanitized.length > 3) {
    return new Response('Invalid country code', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  if (!env.FLAGS_BUCKET) {
    return new Response('R2 FLAGS_BUCKET binding is not configured', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // Try candidate keys in R2
  const candidateKeys = [
    `${sanitized.toLowerCase()}.svg`,
    `${sanitized.toUpperCase()}.svg`,
    `${sanitized.toLowerCase()}.png`,
    `${sanitized.toUpperCase()}.png`,
    `${sanitized.toLowerCase()}.webp`,
    `${sanitized}.svg`,
    sanitized
  ];

  let object: R2ObjectBody | null = null;
  let resolvedKey = '';

  for (const key of candidateKeys) {
    try {
      const found = await env.FLAGS_BUCKET.get(key);
      if (found) {
        object = found;
        resolvedKey = key;
        break;
      }
    } catch (err) {
      console.error(`Error querying R2 for key ${key}:`, err);
    }
  }

  if (object) {
    const contentType = object.httpMetadata?.contentType || getMimeType(resolvedKey);
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    if (object.httpEtag) {
      headers.set('ETag', object.httpEtag);
    }

    return new Response(object.body, {
      status: 200,
      headers
    });
  }

  // If flag is missing from R2, return 404 with SVG fallback
  return new Response(generateFallbackSvg(sanitized), {
    status: 404,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Flag-Status': 'not-found'
    }
  });
}
