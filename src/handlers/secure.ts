import { Env } from '../types';
import { extractUserIdentity } from '../utils/identity';

/**
 * Handles GET /secure
 * Returns HTML body containing:
 * "${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}"
 * where ${COUNTRY} is an HTML link navigating to /secure/${COUNTRY}.
 */
export async function handleSecureRequest(request: Request, env: Env): Promise<Response> {
  const identity = extractUserIdentity(request, env);

  const countryLink = `<a class="country-link" href="/secure/${identity.country}">${identity.country}</a>`;
  const identityLine = `${identity.email} authenticated at ${identity.timestamp} from ${countryLink}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cloudflare Secure Identity</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem 1rem;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 640px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #38bdf8;
      letter-spacing: -0.02em;
    }
    .identity-text {
      font-size: 1.25rem;
      line-height: 1.6;
      color: #f1f5f9;
      padding: 1.25rem;
      background: #0f172a;
      border-radius: 8px;
      border: 1px solid #334155;
      word-break: break-word;
    }
    a.country-link {
      color: #38bdf8;
      text-decoration: underline;
      font-weight: 700;
      transition: color 0.15s ease-in-out;
    }
    a.country-link:hover {
      color: #7dd3fc;
    }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      background: #334155;
      border-radius: 9999px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Identity Information</h1>
    <div class="identity-text">
      ${identityLine}
    </div>
    <div class="badge">Source: ${identity.source}</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
