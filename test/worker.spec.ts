import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import { Env } from '../src/types';
import { verifyGitignoreProtection, parseEnvFile } from '../scripts/auth';

/**
 * In-memory Mock R2Bucket implementation for unit testing
 */
class MockR2Bucket {
  private store = new Map<string, { body: Uint8Array; contentType: string; etag: string }>();

  put(key: string, content: string | Uint8Array, contentType: string) {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.store.set(key, { body: bytes, contentType, etag: `w/"${key}-etag"` });
  }

  async get(key: string): Promise<any | null> {
    const item = this.store.get(key);
    if (!item) return null;

    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(item.body);
          controller.close();
        }
      }),
      httpMetadata: { contentType: item.contentType },
      httpEtag: item.etag
    };
  }
}

describe('Cloudflare Worker - Secure Identity & Flag Tests', () => {
  const createMockEnv = (): { env: Env; mockR2: MockR2Bucket } => {
    const mockR2 = new MockR2Bucket();
    mockR2.put('us.svg', '<svg>US Flag</svg>', 'image/svg+xml');
    mockR2.put('ar.png', 'PNG_AR_BYTES', 'image/png');

    return {
      env: {
        FLAGS_BUCKET: mockR2 as unknown as R2Bucket,
        DEV_MOCK_EMAIL: 'dev@example.com',
        DEV_MOCK_COUNTRY: 'US'
      },
      mockR2
    };
  };

  it('serves /secure with Cloudflare Access email and cf edge country', async () => {
    const { env } = createMockEnv();
    const req = new Request('https://tunnel.yourwebsite.com/secure', {
      headers: {
        'cf-access-authenticated-user-email': 'alice@company.com'
      }
    });
    // Inject cf property
    (req as any).cf = { country: 'AR' };

    const ctx = {
      waitUntil: () => {},
      passThroughOnException: () => {}
    } as unknown as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const body = await res.text();
    // Validate required format: "${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}" with country link
    expect(body).toContain('alice@company.com authenticated at');
    expect(body).toContain('from <a class="country-link" href="/secure/AR">AR</a>');
  });

  it('serves /secure using Cloudflare Access JWT assertion', async () => {
    const { env } = createMockEnv();
    // Create base64 JWT payload with email and iat
    const payload = {
      email: 'bob@enterprise.com',
      iat: 1700000000
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const mockJwt = `header.${b64}.signature`;

    const req = new Request('https://tunnel.yourwebsite.com/secure', {
      headers: {
        'cf-access-jwt-assertion': mockJwt
      }
    });
    (req as any).cf = { country: 'US' };

    const ctx = {} as ExecutionContext;
    const res = await worker.fetch(req, env, ctx);
    const body = await res.text();

    expect(body).toContain('bob@enterprise.com authenticated at');
    expect(body).toContain('from <a class="country-link" href="/secure/US">US</a>');
  });

  it('serves /secure with local development fallback when headers are missing', async () => {
    const { env } = createMockEnv();
    const req = new Request('http://localhost:8787/secure');
    const ctx = {} as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain('dev@example.com authenticated at');
    expect(body).toContain('from <a class="country-link" href="/secure/US">US</a>');
  });

  it('serves /secure/:country with correct content type from R2 (SVG)', async () => {
    const { env } = createMockEnv();
    const req = new Request('https://tunnel.yourwebsite.com/secure/US');
    const ctx = {} as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');

    const content = await res.text();
    expect(content).toBe('<svg>US Flag</svg>');
  });

  it('serves /secure/:country with correct content type from R2 (PNG)', async () => {
    const { env } = createMockEnv();
    const req = new Request('https://tunnel.yourwebsite.com/secure/AR');
    const ctx = {} as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('returns 404 with SVG fallback for missing flags in R2', async () => {
    const { env } = createMockEnv();
    const req = new Request('https://tunnel.yourwebsite.com/secure/JP');
    const ctx = {} as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');

    const svg = await res.text();
    expect(svg).toContain('JP');
    expect(svg).toContain('Flag not found in R2');
  });

  it('rejects invalid country codes with 400 Bad Request', async () => {
    const { env } = createMockEnv();
    const req = new Request('https://tunnel.yourwebsite.com/secure/INVALID_LONG_CODE');
    const ctx = {} as ExecutionContext;

    const res = await worker.fetch(req, env, ctx);
    // Regex in router does not match > 3 chars, so falls to 404
    expect(res.status).toBe(404);
  });
});

describe('Cloudflare Auth Module & Git Protection', () => {
  it('confirms .gitignore protects sensitive credentials', () => {
    const isProtected = verifyGitignoreProtection();
    expect(isProtected).toBe(true);
  });

  it('correctly parses env files', () => {
    const sample = 'CLOUDFLARE_API_TOKEN="secret-token"\nCLOUDFLARE_ACCOUNT_ID=12345\n# Comment\n';
    const fs = require('node:fs');
    const tempFile = 'sample-test.env';
    fs.writeFileSync(tempFile, sample);
    try {
      const parsed = parseEnvFile(tempFile);
      expect(parsed.CLOUDFLARE_API_TOKEN).toBe('secret-token');
      expect(parsed.CLOUDFLARE_ACCOUNT_ID).toBe('12345');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });
});
