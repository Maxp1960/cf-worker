# Cloudflare Worker: Secure Identity & Country Flags

This repository implements a **Cloudflare Worker** built with TypeScript, Cloudflare Wrangler CLI, and Cloudflare R2, designed to run behind **Cloudflare Access** and **Cloudflare Tunnel** at `tunnel.yourwebsite.com/secure`.

---

## 📋 Requirements Fulfilled

1. **Identity Endpoint (`/secure`)**:
   - Served on `tunnel.yourwebsite.com/secure`.
   - Returns identity information for the authenticated user as HTML (`text/html; charset=utf-8`).
   - Response body contains:
     ```text
     ${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}
     ```
   - `${COUNTRY}` is rendered as an HTML link navigating to `tunnel.yourwebsite.com/secure/${COUNTRY}`.
   - Parses Cloudflare Access headers (`Cf-Access-Authenticated-User-Email`, `Cf-Access-Jwt-Assertion`) and Cloudflare Edge geolocation (`request.cf.country`).

2. **Flag Endpoint (`/secure/${COUNTRY}`)**:
   - Displays the appropriate country flag asset retrieved from a **private Cloudflare R2 bucket** (`FLAGS_BUCKET` binding).
   - Returns the image using the appropriate content type (`image/svg+xml` or `image/png`).
   - Serves an SVG fallback if a requested country flag has not yet been uploaded.

3. **Secure Auth Module for Cloudflare Credentials**:
   - Dedicated local CLI utility (`npm run auth` & `npm run auth:check`) to configure, verify, and store credentials.
   - Credentials are saved locally to `.env` and `.dev.vars`, protected by strict `.gitignore` rules so **no secrets are ever pushed to the public Git repository**.

---

## 🛠️ Project Structure

```text
cf-worker/
├── .gitignore               # Strict exclusion of .env, .dev.vars, .wrangler/, etc.
├── .env.example             # Template for API token and account configuration
├── .dev.vars.example        # Template for local Wrangler Worker dev secrets
├── package.json             # Scripts (dev, deploy, test, auth, upload-flags)
├── tsconfig.json            # TypeScript configuration
├── wrangler.jsonc           # Wrangler Worker config with R2 binding
├── assets/
│   └── flags/               # Country flag SVG assets (US, AR, ES, GB, etc.)
├── scripts/
│   ├── auth.ts              # Secure Cloudflare Account Auth Module
│   └── upload-flags.ts      # Automated R2 flag asset upload utility
├── src/
│   ├── index.ts             # Main Worker router
│   ├── handlers/
│   │   ├── secure.ts        # /secure HTML identity endpoint
│   │   └── flag.ts          # /secure/:country R2 flag endpoint
│   ├── utils/
│   │   ├── identity.ts      # Cloudflare Access & cf edge parser
│   │   └── mime.ts          # MIME content-type resolver
│   └── types.ts             # TypeScript definitions and bindings
└── test/
    └── worker.spec.ts       # Vitest unit test suite (9 tests passing)
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your Cloudflare Credentials (Auth Module)
Run the built-in interactive Auth module:
```bash
npm run auth
```
This utility:
- Prompts for your **Cloudflare API Token** (or prompts you to keep existing).
- Validates the token against the Cloudflare REST API (`https://api.cloudflare.com/client/v4/user/tokens/verify`).
- Discovers your accessible **Cloudflare Account ID(s)**.
- Safely writes secrets to `.env` and `.dev.vars`.
- Verifies `.gitignore` ensures credentials are never committed.

You can verify your token status at any time:
```bash
npm run auth:check
```

Alternatively, you can manually copy `.env.example` to `.env` and `.dev.vars.example` to `.dev.vars`:
```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
```

---

### 3. Create Private R2 Bucket & Upload Country Flags

1. Create the private R2 bucket using Wrangler:
   ```bash
   npx wrangler r2 bucket create country-flags
   ```
2. Upload the country flag assets to your private R2 bucket:
   ```bash
   npm run upload-flags
   ```
   *(For local emulation testing, you can also use `npm run upload-flags -- --local`)*.

---

### 4. Run Unit Tests
A full test suite tests the identity extraction, HTML output format, country links, R2 flag streaming, and MIME types:
```bash
npm test
```

---

### 5. Local Development
Start the local Worker development server with Wrangler:
```bash
npm run dev
```
Open your browser or test via curl:
- Identity endpoint: [http://localhost:8787/secure](http://localhost:8787/secure)
- Country flag endpoint: [http://localhost:8787/secure/US](http://localhost:8787/secure/US) or [http://localhost:8787/secure/AR](http://localhost:8787/secure/AR)

In local development, headers can be simulated with:
```bash
curl -H "cf-access-authenticated-user-email: developer@example.com" -H "cf-ipcountry: AR" http://localhost:8787/secure
```

---

### 6. Deployment to Cloudflare
Deploy the Worker to Cloudflare:
```bash
npm run deploy
```

---

## 🔒 Cloudflare Tunnel & Access Integration

To route `tunnel.yourwebsite.com/secure` to this Worker:

1. **Cloudflare Tunnel (Public Hostname)**:
   - In Cloudflare Zero Trust Dashboard > **Networks** > **Tunnels**, configure a public hostname:
     - **Hostname**: `tunnel.yourwebsite.com`
     - **Path**: `/secure*` (or route via Worker Route / Custom Domain `tunnel.yourwebsite.com/secure*` in Cloudflare Dashboard > Workers & Pages).
2. **Cloudflare Access (Zero Trust)**:
   - Add an Access Application protecting `tunnel.yourwebsite.com/secure*`.
   - Access enforces authentication (Google, Okta, One-Time PIN, etc.) before the request reaches the Worker.
   - Upon successful authentication, Cloudflare Access automatically injects:
     - `Cf-Access-Authenticated-User-Email`
     - `Cf-Access-Jwt-Assertion`
   - Cloudflare CDN edge automatically injects:
     - `request.cf.country` (ISO-3166-1 alpha-2 code).