import { Env } from './types';
import { handleSecureRequest } from './handlers/secure';
import { handleFlagRequest } from './handlers/flag';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Route: /secure
    if (pathname === '/secure') {
      return handleSecureRequest(request, env);
    }

    // Route: /secure/:country
    const flagMatch = pathname.match(/^\/secure\/([a-zA-Z]{2,3})$/);
    if (flagMatch) {
      const countryCode = flagMatch[1];
      return handleFlagRequest(countryCode, env);
    }

    // Route: Root / or welcome info
    if (pathname === '/') {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Cloudflare Worker</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; text-align: center; }
    a { color: #38bdf8; text-decoration: underline; font-weight: bold; }
    .box { max-width: 500px; margin: 2rem auto; padding: 2rem; background: #1e293b; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Cloudflare Identity Worker</h1>
    <p>Visit the authenticated endpoint:</p>
    <p><a href="/secure">Go to /secure</a></p>
  </div>
</body>
</html>`,
        {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }

    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }
};
